import type { BrowserWindow } from 'electron'
import { createConnection } from 'net'
import { Client } from 'discord-rpc'
import { IPC_CHANNELS } from '../../shared/types'
import type { DiscordState, DiscordParticipant } from '../../shared/types'

// Type assertion for request method which exists at runtime
declare module 'discord-rpc' {
  interface Client {
    request(command: string, args?: Record<string, unknown>): Promise<unknown>
  }
}

/**
 * Connects to the Discord desktop client via the discord-rpc IPC socket
 * (\\.\pipe\discord-ipc-{0-9}) and proxies voice state read/write IPC calls.
 *
 * Event-driven: subscribes to VOICE_CHANNEL_SELECT, VOICE_STATE_UPDATE, SPEAKING_START/STOP.
 * Authentication: OAuth with scopes rpc + rpc.voice.read + rpc.voice.write.
 * Auto-reconnects when the Discord client restarts.
 */
export class DiscordService {
  private client: Client | null = null
  private clientSeq = 0  // [DEBUG] incremented per connect attempt to track which instance fires events
  private window: BrowserWindow | null = null
  private clientId = ''
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private lastAvailable = false

  private logFn: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null
  private stateChangeFn: (() => void) | null = null

  private state: DiscordState = {
    available: false,
    authenticated: false,
    error: null,
    voiceChannel: null,
    participants: [],
    selfMuted: false,
    selfDeafened: false,
    inputVolume: 100,
    outputVolume: 100,
  }

  // ── Dependency injection ───────────────────────────────────────────────────

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  setLogEmitter(fn: (level: 'info' | 'warn' | 'error', msg: string) => void): void {
    this.logFn = fn
  }

  setStateChangeNotifier(fn: () => void): void {
    this.stateChangeFn = fn
  }

  setClientId(clientId: string): void {
    this.clientId = clientId
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    this.clearReconnectTimer()
    this.destroyClient()
    if (this.state.available || this.state.authenticated) {
      this.state = {
        ...this.state,
        available: false,
        authenticated: false,
        voiceChannel: null,
        participants: [],
      }
      this.push()
    }
  }

  isAvailable(): boolean {
    return this.state.available
  }

  getState(): DiscordState {
    return this.state
  }

  // ── Public write commands ──────────────────────────────────────────────────

  async setSelfMute(muted: boolean): Promise<void> {
    if (!this.client || !this.state.authenticated) return
    try {
      this.log('info', `Microphone: ${muted ? 'muted' : 'unmuted'}`)
      await this.client.request('SET_VOICE_SETTINGS', { mute: muted })
      this.state = { ...this.state, selfMuted: muted }
      this.push()
    } catch (err) {
      this.log('warn', `Discord: setSelfMute failed — ${String(err)}`)
    }
  }

  async setSelfDeaf(deafened: boolean): Promise<void> {
    if (!this.client || !this.state.authenticated) return
    try {
      this.log('info', `Deafen: ${deafened ? 'on' : 'off'}`)
      await this.client.request('SET_VOICE_SETTINGS', { deaf: deafened })
      this.state = { ...this.state, selfDeafened: deafened }
      this.push()
    } catch (err) {
      this.log('warn', `Discord: setSelfDeaf failed — ${String(err)}`)
    }
  }

  async setInputVolume(volume: number): Promise<void> {
    if (!this.client || !this.state.authenticated) return
    const clamped = Math.max(0, Math.min(100, Math.round(volume)))
    try {
      this.log('info', `Microphone volume: ${clamped}%`)
      await this.client.request('SET_VOICE_SETTINGS', {
        input: { volume: clamped },
      })
      this.state = { ...this.state, inputVolume: clamped }
      this.push()
    } catch (err) {
      this.log('warn', `Discord: setInputVolume failed — ${String(err)}`)
    }
  }

  async setOutputVolume(volume: number): Promise<void> {
    if (!this.client || !this.state.authenticated) return
    const clamped = Math.max(0, Math.min(100, Math.round(volume)))
    try {
      this.log('info', `Speaker volume: ${clamped}%`)
      await this.client.request('SET_VOICE_SETTINGS', {
        output: { volume: clamped },
      })
      this.state = { ...this.state, outputVolume: clamped }
      this.push()
    } catch (err) {
      this.log('warn', `Discord: setOutputVolume failed — ${String(err)}`)
    }
  }

  async setLocalVolume(userId: string, volume: number): Promise<void> {
    if (!this.client || !this.state.authenticated) return
    const clamped = Math.max(0, Math.min(200, Math.round(volume)))
    try {
      const participant = this.state.participants.find((p) => p.userId === userId)
      this.log('info', `${participant?.nick ?? 'User'}: volume ${clamped}%`)
      await this.client.request('SET_LOCAL_VOLUME', { user_id: userId, volume: clamped })
      this.state = {
        ...this.state,
        participants: this.state.participants.map((p) =>
          p.userId === userId ? { ...p, localVolume: clamped } : p
        ),
      }
      this.push()
    } catch (err) {
      this.log('warn', `Discord: setLocalVolume(${userId}) failed — ${String(err)}`)
    }
  }

  async setLocalMute(userId: string, muted: boolean): Promise<void> {
    if (!this.client || !this.state.authenticated) return
    try {
      const participant = this.state.participants.find((p) => p.userId === userId)
      this.log('info', `${participant?.nick ?? 'User'}: ${muted ? 'locally muted' : 'locally unmuted'}`)
      await this.client.request('SET_LOCAL_MUTE', { user_id: userId, mute: muted })
      this.state = {
        ...this.state,
        participants: this.state.participants.map((p) =>
          p.userId === userId ? { ...p, localMuted: muted } : p
        ),
      }
      this.push()
    } catch (err) {
      this.log('warn', `Discord: setLocalMute(${userId}) failed — ${String(err)}`)
    }
  }

  async reconnect(): Promise<void> {
    this.destroyClient()
    this.connect()
  }

  // ── Private connection logic ───────────────────────────────────────────────

  // [DEBUG] probe whether any discord-ipc-N pipe exists (confirms Discord is running)
  private async probeDiscordPipes(): Promise<string> {
    const results: string[] = []
    const checks = Array.from({ length: 10 }, (_, i) =>
      new Promise<string>((resolve) => {
        const pipePath = `\\\\.\\pipe\\discord-ipc-${i}`
        const sock = createConnection(pipePath)
        sock.once('connect', () => { sock.destroy(); resolve(`discord-ipc-${i}: reachable`) })
        sock.once('error', (e: NodeJS.ErrnoException) => resolve(`discord-ipc-${i}: ${e.code ?? e.message}`))
        setTimeout(() => { sock.destroy(); resolve(`discord-ipc-${i}: timeout`) }, 500)
      })
    )
    const r = await Promise.all(checks)
    for (const line of r) results.push(line)
    return results.join(', ')
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    if (!this.clientId) {
      this.log('warn', 'Discord: no Client ID configured — set one in Discord settings')
      this.state = {
        ...this.state,
        available: false,
        error: 'No Client ID configured',
      }
      this.push()
      return
    }

    const seq = ++this.clientSeq
    this.log('info', `Discord [#${seq}]: connecting to Discord client via RPC...`)

    // [DEBUG] check which IPC pipes are reachable before we try to connect
    this.probeDiscordPipes().then((summary) => {
      this.log('info', `Discord [#${seq}]: pipe probe — ${summary}`)
    })

    this.destroyClient()
    this.log('info', `Discord [#${seq}]: previous client destroyed, creating new Client`)

    const client = new Client({ transport: 'ipc' })
    this.client = client

    client.on('ready', async () => {
      this.log('info', `Discord [#${seq}]: 'ready' event fired — seq matches current: ${seq === this.clientSeq}`)
      if (this.stopped) return
      this.log('info', `Discord [#${seq}]: RPC socket connected — authenticating with clientId=${this.clientId}...`)
      try {
        this.log('info', `Discord [#${seq}]: calling login() with scopes [rpc, rpc.voice.read, rpc.voice.write] redirectUri=http://127.0.0.1`)
        await client.login({
          clientId: this.clientId,
          scopes: ['rpc', 'rpc.voice.read', 'rpc.voice.write'],
          redirectUri: 'http://127.0.0.1',
        })
        this.log('info', `Discord [#${seq}]: login() resolved — authenticated`)

        const settings = (await client.request('GET_VOICE_SETTINGS', {})) as {
          mute?: boolean
          deaf?: boolean
          input?: { volume?: number }
          output?: { volume?: number }
        }

        this.state = {
          ...this.state,
          available: true,
          authenticated: true,
          error: null,
          selfMuted: settings.mute ?? false,
          selfDeafened: settings.deaf ?? false,
          inputVolume: settings.input?.volume ?? 100,
          outputVolume: settings.output?.volume ?? 100,
        }
        this.push()

        await this.subscribeToVoiceEvents(client)

        try {
          const channelRaw = (await client.request('GET_SELECTED_VOICE_CHANNEL', {})) as
            | { id?: string; name?: string; guild_id?: string }
            | null
          if (channelRaw?.id) {
            await this.handleVoiceChannelSelect(client, channelRaw.id)
          }
        } catch {
          // Not in a channel — that's fine
        }
      } catch (err) {
        const e = err as NodeJS.ErrnoException
        this.log('error', `Discord [#${seq}]: login() failed — ${e.message ?? String(err)} | code=${e.code ?? 'n/a'} | name=${e.name ?? 'n/a'}`)
        if (e.stack) this.log('error', `Discord [#${seq}]: stack — ${e.stack}`)
        this.state = {
          ...this.state,
          available: true,
          authenticated: false,
          error: `Auth failed: ${e.message ?? String(err)}`,
        }
        this.push()
      }
    })

    client.on('disconnected', () => {
      this.log('warn', `Discord [#${seq}]: 'disconnected' event fired — seq matches current: ${seq === this.clientSeq}`)
      if (this.stopped) return
      this.state = {
        ...this.state,
        available: false,
        authenticated: false,
        voiceChannel: null,
        participants: [],
      }
      this.push()
      this.scheduleReconnect()
    })

    try {
      this.log('info', `Discord [#${seq}]: calling client.connect(${this.clientId})...`)
      await client.connect(this.clientId)
      this.log('info', `Discord [#${seq}]: client.connect() resolved without error`)
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      this.log('warn', `Discord [#${seq}]: connect() failed — message=${e.message ?? String(err)} | code=${e.code ?? 'n/a'} | name=${e.name ?? 'n/a'}`)
      if (e.stack) this.log('warn', `Discord [#${seq}]: stack — ${e.stack}`)
      this.state = {
        ...this.state,
        available: false,
        error: `Connect failed: ${e.message ?? String(err)}`,
      }
      this.push()
      this.scheduleReconnect()
    }
  }

  private async subscribeToVoiceEvents(client: Client): Promise<void> {
    await client.subscribe('VOICE_CHANNEL_SELECT', {})

    client.on('VOICE_CHANNEL_SELECT', (data: { channel_id: string | null }) => {
      void this.handleVoiceChannelSelect(client, data.channel_id)
    })
  }

  private async handleVoiceChannelSelect(
    client: Client,
    channelId: string | null,
  ): Promise<void> {
    if (!channelId) {
      this.state = { ...this.state, voiceChannel: null, participants: [] }
      this.push()
      return
    }

    try {
      const channel = (await client.request('GET_CHANNEL', { channel_id: channelId })) as {
        id: string
        name: string
        guild_id: string
        voice_states?: Array<{
          user: { id: string; username: string; avatar: string | null }
          nick: string
          mute: boolean
          deaf: boolean
          self_mute: boolean
          self_deaf: boolean
          suppress: boolean
          volume: number
        }>
      }

      let guildName = ''
      try {
        const guild = (await client.request('GET_GUILD', { guild_id: channel.guild_id })) as {
          name?: string
        }
        guildName = guild.name ?? ''
      } catch {
        // DMs / group calls have no guild
      }

      const participants: DiscordParticipant[] = (channel.voice_states ?? []).map((vs) => ({
        userId: vs.user.id,
        username: vs.user.username,
        nick: vs.nick ?? vs.user.username,
        muted: vs.self_mute || vs.mute,
        deafened: vs.self_deaf || vs.deaf,
        localMuted: vs.suppress,
        localVolume: vs.volume ?? 100,
        speaking: false,
        avatar: vs.user.avatar
          ? `https://cdn.discordapp.com/avatars/${vs.user.id}/${vs.user.avatar}.webp?size=64`
          : null,
      }))

      this.state = {
        ...this.state,
        voiceChannel: { id: channelId, name: channel.name, guildName },
        participants,
      }
      this.push()

      await client.subscribe('VOICE_STATE_UPDATE', { channel_id: channelId })
      await client.subscribe('SPEAKING_START', { channel_id: channelId })
      await client.subscribe('SPEAKING_STOP', { channel_id: channelId })

      client.on(
        'VOICE_STATE_UPDATE',
        (data: {
          user: { id: string; username: string; avatar: string | null }
          nick: string
          mute: boolean
          self_mute: boolean
          deaf: boolean
          self_deaf: boolean
          suppress: boolean
          volume: number
        }) => {
          const userId = data.user.id
          const existing = this.state.participants.find((p) => p.userId === userId)
          const updated: DiscordParticipant = {
            userId,
            username: data.user.username,
            nick: data.nick ?? data.user.username,
            muted: data.self_mute || data.mute,
            deafened: data.self_deaf || data.deaf,
            localMuted: data.suppress,
            localVolume: data.volume ?? existing?.localVolume ?? 100,
            speaking: existing?.speaking ?? false,
            avatar: data.user.avatar
              ? `https://cdn.discordapp.com/avatars/${userId}/${data.user.avatar}.webp?size=64`
              : null,
          }
          const alreadyInList = this.state.participants.some((p) => p.userId === userId)
          this.state = {
            ...this.state,
            participants: alreadyInList
              ? this.state.participants.map((p) => (p.userId === userId ? updated : p))
              : [...this.state.participants, updated],
          }
          this.push()
        },
      )

      client.on('SPEAKING_START', (data: { user_id: string }) => {
        this.state = {
          ...this.state,
          participants: this.state.participants.map((p) =>
            p.userId === data.user_id ? { ...p, speaking: true } : p
          ),
        }
        this.push()
      })

      client.on('SPEAKING_STOP', (data: { user_id: string }) => {
        this.state = {
          ...this.state,
          participants: this.state.participants.map((p) =>
            p.userId === data.user_id ? { ...p, speaking: false } : p
          ),
        }
        this.push()
      })
    } catch (err) {
      this.log('warn', `Discord: failed to load channel ${channelId} — ${String(err)}`)
    }
  }

  // ── Reconnect / cleanup ────────────────────────────────────────────────────

  private scheduleReconnect(delayMs = 10_000): void {
    this.clearReconnectTimer()
    if (this.stopped) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delayMs)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private destroyClient(): void {
    if (this.client) {
      try {
        this.client.destroy()
      } catch {
        // ignore
      }
      this.client = null
    }
  }

  // ── Log / push helpers ─────────────────────────────────────────────────────

  private log(level: 'info' | 'warn' | 'error', msg: string): void {
    this.logFn?.(level, msg)
  }

  private push(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.DISCORD_STATE_CHANGE, this.state)
    }
    const nowAvailable = this.state.available
    if (nowAvailable !== this.lastAvailable) {
      this.lastAvailable = nowAvailable
      this.stateChangeFn?.()
    }
  }
}
