import { BrowserWindow } from 'electron'
import { createConnection, Socket } from 'net'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { net } from 'electron'

import type { DiscordState, DiscordParticipant } from '../../shared/types'

// ─── DiscordRpcTransport ────────────────────────────────────────────────────────

interface PendingRequest {
  resolve(v: unknown): void
  reject(e: Error): void
}

class DiscordRpcTransport extends EventEmitter {
  private socket: Socket | null = null
  private buffer = Buffer.alloc(0)
  private pending = new Map<string, PendingRequest>()
  logFn?: (level: 'info' | 'warn' | 'error', msg: string) => void

  async connect(clientId: string): Promise<void> {
    // Try pipes 0–9 sequentially
    for (let i = 0; i < 10; i++) {
      try {
        this.logFn?.('info', `Discord: trying IPC pipe discord-ipc-${i}`)
        const socket = await this.openPipe(i)
        this.socket = socket
        this.setupSocket()

        this.logFn?.('info', `Discord: opened pipe discord-ipc-${i}, sending handshake (clientId: ${clientId})`)
        // Send HANDSHAKE frame
        this.send(0, { v: 1, client_id: clientId })

        // Wait for READY event
        return new Promise((resolve, reject) => {
          const onReady = () => {
            this.off('ready', onReady)
            this.off('error', onError)
            this.logFn?.('info', `Discord: received READY on pipe discord-ipc-${i}`)
            resolve()
          }
          const onError = (e: Error) => {
            this.off('ready', onReady)
            this.off('error', onError)
            reject(e)
          }
          this.once('ready', onReady)
          this.once('error', onError)
        })
      } catch (e) {
        this.logFn?.('warn', `Discord: pipe discord-ipc-${i} failed: ${e instanceof Error ? e.message : String(e)}`)
        if (this.socket) {
          this.socket.destroy()
          this.socket = null
        }
        continue
      }
    }
    throw new Error('Failed to connect to Discord IPC pipe (tried pipes 0–9; is Discord running?)')
  }

  private openPipe(index: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const pipePath = `\\\\?\\pipe\\discord-ipc-${index}`
      const socket = createConnection(pipePath, () => {
        resolve(socket)
      })
      socket.on('error', reject)
      setTimeout(() => {
        if (!socket.connecting) reject(new Error('Connection timeout'))
        else socket.destroy()
      }, 500)
    })
  }

  private setupSocket() {
    if (!this.socket) return

    this.socket.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      this.parseFrames()
    })

    this.socket.on('close', () => {
      this.emit('close')
    })

    this.socket.on('error', (e: Error) => {
      this.emit('error', e)
    })
  }

  private parseFrames() {
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0)
      const length = this.buffer.readUInt32LE(4)
      if (this.buffer.length < 8 + length) break

      const body = this.buffer.slice(8, 8 + length)
      this.buffer = this.buffer.slice(8 + length)

      try {
        const frame = JSON.parse(body.toString('utf8'))
        this.handleFrame(frame, opcode)
      } catch (e) {
        this.logFn?.('warn', `Discord: malformed IPC frame (opcode ${opcode}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  private handleFrame(frame: any, opcode: number) {
    // Handle responses to requests
    if (frame.nonce && this.pending.has(frame.nonce)) {
      const cb = this.pending.get(frame.nonce)!
      this.pending.delete(frame.nonce)
      if (frame.evt === 'ERROR') {
        const msg = frame.data?.message ?? 'RPC error'
        this.logFn?.('error', `Discord: RPC error for cmd=${frame.cmd}: ${msg} (code=${frame.data?.code})`)
        cb.reject(new Error(msg))
      } else {
        cb.resolve(frame.data)
      }
      return
    }

    // Handle dispatch events — READY is a special dispatch that unblocks connect()
    if (frame.cmd === 'DISPATCH') {
      if (frame.evt === 'READY') {
        this.emit('ready')
      } else {
        this.emit(`event:${frame.evt}`, frame.data)
      }
      return
    }
  }

  send(opcode: number, payload: object): void {
    if (!this.socket) throw new Error('Socket not connected')
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    const header = Buffer.allocUnsafe(8)
    header.writeUInt32LE(opcode, 0)
    header.writeUInt32LE(body.length, 4)
    this.socket.write(Buffer.concat([header, body]))
  }

  request(cmd: string, args?: object): Promise<unknown> {
    const nonce = randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(nonce, { resolve, reject })
      try {
        this.send(1, { cmd, args, nonce })
      } catch (e) {
        this.pending.delete(nonce)
        reject(e)
      }
    })
  }

  subscribe(evt: string, args?: object): Promise<void> {
    const nonce = randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(nonce, { resolve, reject })
      try {
        this.send(1, { cmd: 'SUBSCRIBE', evt, args: args ?? {}, nonce })
      } catch (e) {
        this.pending.delete(nonce)
        reject(e)
      }
    }).then(() => undefined)
  }

  unsubscribe(evt: string, args?: object): Promise<void> {
    const nonce = randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(nonce, { resolve, reject })
      try {
        this.send(1, { cmd: 'UNSUBSCRIBE', evt, args: args ?? {}, nonce })
      } catch (e) {
        this.pending.delete(nonce)
        reject(e)
      }
    }).then(() => undefined)
  }

  destroy(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.pending.clear()
    this.removeAllListeners()
  }
}

// ─── Token Persistence ──────────────────────────────────────────────────────────

interface TokenCache {
  access_token: string
  expires_at: number
}

function tokenCachePath(): string {
  return join(app.getPath('userData'), 'discord-token.json')
}

function loadCachedToken(): string | null {
  try {
    const raw = JSON.parse(readFileSync(tokenCachePath(), 'utf8')) as TokenCache
    if (Date.now() < raw.expires_at - 60_000) return raw.access_token
    return null
  } catch {
    return null
  }
}

function saveCachedToken(token: string, expiresInSeconds: number): void {
  const cache: TokenCache = {
    access_token: token,
    expires_at: Date.now() + expiresInSeconds * 1000,
  }
  writeFileSync(tokenCachePath(), JSON.stringify(cache), 'utf8')
}

function clearCachedToken(): void {
  try {
    unlinkSync(tokenCachePath())
  } catch {
    // Ignore
  }
}

// ─── OAuth Helper ───────────────────────────────────────────────────────────────

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  logFn?: (level: 'info' | 'warn' | 'error', msg: string) => void,
): Promise<{ access_token: string; expires_in: number }> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://127.0.0.1',
      client_id: clientId,
      client_secret: clientSecret,
    })
    logFn?.('info', `Discord: POST discord.com/api/oauth2/token (grant_type=authorization_code, client_id=${clientId})`)

    const req = net.request({
      method: 'POST',
      url: 'https://discord.com/api/oauth2/token',
    })

    let responseData = ''

    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => {
        responseData += chunk.toString('utf8')
      })

      res.on('end', () => {
        try {
          logFn?.('info', `Discord: OAuth token endpoint responded with HTTP ${res.statusCode}`)
          if (res.statusCode !== 200) {
            logFn?.('error', `Discord: OAuth exchange failed — HTTP ${res.statusCode}, body: ${responseData}`)
            reject(new Error(`OAuth exchange failed: HTTP ${res.statusCode} — ${responseData}`))
            return
          }
          const parsed = JSON.parse(responseData) as {
            access_token?: string
            expires_in?: number
            error?: string
            error_description?: string
          }
          if (parsed.error) {
            logFn?.('error', `Discord: OAuth error: ${parsed.error} — ${parsed.error_description}`)
            reject(new Error(`OAuth error: ${parsed.error} — ${parsed.error_description}`))
            return
          }
          if (!parsed.access_token || !parsed.expires_in) {
            logFn?.('error', `Discord: OAuth response missing access_token or expires_in: ${responseData}`)
            reject(new Error('Invalid OAuth response: missing access_token or expires_in'))
            return
          }
          resolve({ access_token: parsed.access_token, expires_in: parsed.expires_in })
        } catch (e) {
          logFn?.('error', `Discord: failed to parse OAuth response: ${e instanceof Error ? e.message : String(e)}, raw: ${responseData}`)
          reject(e)
        }
      })
    })

    req.on('error', (e) => {
      logFn?.('error', `Discord: OAuth HTTP request error: ${e instanceof Error ? e.message : String(e)}`)
      reject(e)
    })
    req.setHeader('Content-Type', 'application/x-www-form-urlencoded')
    req.write(params.toString())
    req.end()
  })
}

// ─── DiscordService ─────────────────────────────────────────────────────────────

export class DiscordService {
  private window: BrowserWindow | null = null
  private clientId: string = ''
  private clientSecret: string = ''
  private transport: DiscordRpcTransport | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private stopped = true
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

  setWindow(win: BrowserWindow) {
    this.window = win
  }

  setLogEmitter(fn: (level: 'info' | 'warn' | 'error', msg: string) => void) {
    this.logFn = fn
  }

  setStateChangeNotifier(fn: () => void) {
    this.stateChangeFn = fn
  }

  setClientId(id: string) {
    this.clientId = id
  }

  setClientSecret(secret: string) {
    this.clientSecret = secret
  }

  getState(): DiscordState {
    return this.state
  }

  isAvailable(): boolean {
    return this.state.available && this.state.authenticated
  }

  start() {
    this.stopped = false
    this.connect()
  }

  stop() {
    this.stopped = true
    this.clearReconnectTimer()
    this.destroyTransport()
    this.state = {
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
    this.push()
  }

  async connect() {
    if (this.stopped) return

    // Guard on required credentials
    if (!this.clientId || !this.clientSecret) {
      this.logFn?.('warn', `Discord: missing credentials — clientId=${this.clientId ? 'set' : 'MISSING'}, clientSecret=${this.clientSecret ? 'set' : 'MISSING'}`)
      this.state = {
        ...this.state,
        available: false,
        authenticated: false,
        error: 'Client ID and Client Secret are required',
      }
      this.push()
      return
    }

    this.logFn?.('info', `Discord: starting connection (clientId: ${this.clientId})`)

    try {
      this.destroyTransport()

      const transport = new DiscordRpcTransport()
      transport.logFn = this.logFn ?? undefined
      this.transport = transport

      transport.on('close', () => this.handleDisconnect())
      transport.on('error', (e: Error) => this.handleDisconnect(e))

      await transport.connect(this.clientId)
      this.logFn?.('info', 'Discord: IPC transport established')
      this.state = { ...this.state, available: true, authenticated: false }
      this.push()

      // Check for cached token
      const cachedToken = loadCachedToken()
      if (cachedToken) {
        this.logFn?.('info', 'Discord: found cached token, skipping OAuth flow')
        await this.authenticate(cachedToken)
      } else {
        this.logFn?.('info', 'Discord: no cached token, starting OAuth authorization flow')
        await this.authorize()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logFn?.('error', `Discord: connect failed: ${msg}`)
      if (msg.startsWith('Failed to connect to Discord IPC pipe')) {
        // Discord app is not running — don't retry, just surface the error
        this.state = {
          ...this.state,
          available: false,
          authenticated: false,
          error: 'Discord is not running',
          voiceChannel: null,
          participants: [],
        }
        this.push()
      } else {
        this.handleDisconnect(e instanceof Error ? e : new Error(msg))
      }
    }
  }

  private async authorize() {
    if (!this.transport) return

    try {
      this.logFn?.('info', `Discord: sending AUTHORIZE RPC (scopes: rpc, rpc.voice.read, rpc.voice.write)`)
      const response = (await this.transport.request('AUTHORIZE', {
        client_id: this.clientId,
        scopes: ['rpc', 'rpc.voice.read', 'rpc.voice.write'],
      })) as { code?: string }

      if (!response.code) throw new Error('No authorization code received from Discord RPC')
      this.logFn?.('info', 'Discord: received authorization code, exchanging for access token')

      const { access_token, expires_in } = await exchangeCode(
        response.code,
        this.clientId,
        this.clientSecret,
        this.logFn ?? undefined,
      )

      this.logFn?.('info', `Discord: token exchange succeeded (expires_in: ${expires_in}s), caching token`)
      saveCachedToken(access_token, expires_in)
      await this.authenticate(access_token)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Authorization failed'
      this.logFn?.('error', `Discord: authorize() failed: ${msg}`)
      clearCachedToken()
      this.state = {
        ...this.state,
        authenticated: false,
        error: msg,
      }
      this.push()
    }
  }

  private async authenticate(token: string) {
    if (!this.transport) return

    try {
      this.logFn?.('info', 'Discord: sending AUTHENTICATE RPC')
      await this.transport.request('AUTHENTICATE', { access_token: token })
      this.logFn?.('info', 'Discord: authenticated successfully')

      this.state = {
        ...this.state,
        authenticated: true,
        error: null,
      }
      this.push()

      // Load initial voice settings
      const voiceSettings = (await this.transport.request('GET_VOICE_SETTINGS')) as {
        mute?: boolean
        deaf?: boolean
        input?: { volume?: number }
        output?: { volume?: number }
      }

      this.state = {
        ...this.state,
        selfMuted: voiceSettings.mute ?? false,
        selfDeafened: voiceSettings.deaf ?? false,
        inputVolume: voiceSettings.input?.volume ?? 100,
        outputVolume: voiceSettings.output?.volume ?? 100,
      }

      // Subscribe to voice events
      await this.transport.subscribe('VOICE_CHANNEL_SELECT')
      await this.transport.subscribe('VOICE_SETTINGS_UPDATE')

      // Check if already in a channel (null when not in one)
      const selectedChannel = (await this.transport.request('GET_SELECTED_VOICE_CHANNEL')) as {
        id?: string
      } | null

      if (selectedChannel?.id) {
        await this.handleChannelJoin(selectedChannel.id)
      }

      this.push()

      // Setup event listeners
      this.transport.on('event:VOICE_CHANNEL_SELECT', (data: any) => {
        if (data.channel_id) {
          this.handleChannelJoin(data.channel_id)
        } else {
          this.handleChannelLeave()
        }
      })

      this.transport.on('event:VOICE_STATE_CREATE', (data: any) => {
        this.handleVoiceStateCreate(data)
      })

      this.transport.on('event:VOICE_STATE_UPDATE', (data: any) => {
        this.handleVoiceStateUpdate(data)
      })

      this.transport.on('event:VOICE_STATE_DELETE', (data: any) => {
        this.handleVoiceStateDelete(data)
      })

      this.transport.on('event:SPEAKING_START', (data: any) => {
        this.handleSpeakingStart(data)
      })

      this.transport.on('event:SPEAKING_STOP', (data: any) => {
        this.handleSpeakingStop(data)
      })

      this.transport.on('event:VOICE_SETTINGS_UPDATE', (data: any) => {
        this.state = {
          ...this.state,
          selfMuted: data.mute ?? this.state.selfMuted,
          selfDeafened: data.deaf ?? this.state.selfDeafened,
          inputVolume: data.input?.volume ?? this.state.inputVolume,
          outputVolume: data.output?.volume ?? this.state.outputVolume,
        }
        this.push()
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Authentication failed'
      this.logFn?.('error', `Discord: authenticate() failed: ${msg}`)
      clearCachedToken()
      this.state = {
        ...this.state,
        authenticated: false,
        error: msg,
      }
      this.push()
    }
  }

  private async handleChannelJoin(channelId: string) {
    if (!this.transport) return

    try {
      const channelData = (await this.transport.request('GET_CHANNEL', {
        channel_id: channelId,
      })) as {
        name?: string
        guild_id?: string
        voice_states?: Array<{ user: any; mute?: boolean; deaf?: boolean }>
      }

      let guildName = 'Direct Message'
      if (channelData.guild_id) {
        const guildData = (await this.transport.request('GET_GUILD', {
          guild_id: channelData.guild_id,
        })) as { name?: string }
        guildName = guildData.name ?? 'Unknown Server'
      }

      const participants = (channelData.voice_states ?? []).map((vs) => ({
        userId: vs.user.id,
        username: vs.user.username,
        nick: vs.user.username,
        muted: vs.mute ?? false,
        deafened: vs.deaf ?? false,
        localMuted: false,
        localVolume: 100,
        speaking: false,
        avatar: null,
      }))

      this.state = {
        ...this.state,
        voiceChannel: {
          id: channelId,
          name: channelData.name ?? 'Unknown Channel',
          guildName,
        },
        participants,
      }

      // Subscribe to channel-specific events
      await this.transport.subscribe('VOICE_STATE_CREATE', { channel_id: channelId })
      await this.transport.subscribe('VOICE_STATE_UPDATE', { channel_id: channelId })
      await this.transport.subscribe('VOICE_STATE_DELETE', { channel_id: channelId })
      await this.transport.subscribe('SPEAKING_START', { channel_id: channelId })
      await this.transport.subscribe('SPEAKING_STOP', { channel_id: channelId })

      this.push()
    } catch (e) {
      this.logFn?.('warn', `Failed to join channel: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  private async handleChannelLeave() {
    if (!this.transport || !this.state.voiceChannel) return

    try {
      const channelId = this.state.voiceChannel.id
      await this.transport.unsubscribe('VOICE_STATE_CREATE', { channel_id: channelId })
      await this.transport.unsubscribe('VOICE_STATE_UPDATE', { channel_id: channelId })
      await this.transport.unsubscribe('VOICE_STATE_DELETE', { channel_id: channelId })
      await this.transport.unsubscribe('SPEAKING_START', { channel_id: channelId })
      await this.transport.unsubscribe('SPEAKING_STOP', { channel_id: channelId })
    } catch {
      // Ignore unsubscribe errors
    }

    this.state = {
      ...this.state,
      voiceChannel: null,
      participants: [],
    }
    this.push()
  }

  private handleVoiceStateCreate(data: any) {
    const participant = this.parseParticipant(data)
    if (!this.state.participants.find((p) => p.userId === participant.userId)) {
      this.state.participants.push(participant)
      this.push()
    }
  }

  private handleVoiceStateUpdate(data: any) {
    const participant = this.parseParticipant(data)
    const existing = this.state.participants.find((p) => p.userId === participant.userId)
    if (existing) {
      Object.assign(existing, participant)
    } else {
      this.state.participants.push(participant)
    }
    this.push()
  }

  private handleVoiceStateDelete(data: any) {
    const userId = data.user?.id
    if (userId) {
      this.state.participants = this.state.participants.filter((p) => p.userId !== userId)
      this.push()
    }
  }

  private handleSpeakingStart(data: any) {
    const userId = data.user_id
    if (userId) {
      const p = this.state.participants.find((x) => x.userId === userId)
      if (p) {
        p.speaking = true
        this.push()
      }
    }
  }

  private handleSpeakingStop(data: any) {
    const userId = data.user_id
    if (userId) {
      const p = this.state.participants.find((x) => x.userId === userId)
      if (p) {
        p.speaking = false
        this.push()
      }
    }
  }

  private parseParticipant(data: any): DiscordParticipant {
    return {
      userId: data.user.id,
      username: data.user.username,
      nick: data.user.username,
      muted: data.mute ?? false,
      deafened: data.deaf ?? false,
      localMuted: false,
      localVolume: 100,
      speaking: false,
      avatar: null,
    }
  }

  async setSelfMute(muted: boolean) {
    if (!this.transport) return
    this.state = { ...this.state, selfMuted: muted }
    this.push()
    await this.transport.request('SET_VOICE_SETTINGS', { mute: muted })
  }

  async setSelfDeaf(deafened: boolean) {
    if (!this.transport) return
    this.state = { ...this.state, selfDeafened: deafened }
    this.push()
    await this.transport.request('SET_VOICE_SETTINGS', { deaf: deafened })
  }

  async setInputVolume(volume: number) {
    if (!this.transport) return
    const v = Math.max(0, Math.min(100, Math.round(volume)))
    this.state = { ...this.state, inputVolume: v }
    this.push()
    await this.transport.request('SET_VOICE_SETTINGS', { input: { volume: v } })
  }

  async setOutputVolume(volume: number) {
    if (!this.transport) return
    const v = Math.max(0, Math.min(100, Math.round(volume)))
    this.state = { ...this.state, outputVolume: v }
    this.push()
    await this.transport.request('SET_VOICE_SETTINGS', { output: { volume: v } })
  }

  async setLocalVolume(userId: string, volume: number) {
    if (!this.transport) return
    const v = Math.max(0, Math.min(200, Math.round(volume)))
    const p = this.state.participants.find((x) => x.userId === userId)
    if (p) {
      p.localVolume = v
      this.push()
    }
    await this.transport.request('SET_USER_VOICE_SETTINGS', { user_id: userId, volume: v })
  }

  async setLocalMute(userId: string, muted: boolean) {
    if (!this.transport) return
    const p = this.state.participants.find((x) => x.userId === userId)
    if (p) {
      p.localMuted = muted
      this.push()
    }
    await this.transport.request('SET_USER_VOICE_SETTINGS', { user_id: userId, mute: muted })
  }

  reconnect() {
    clearCachedToken()
    this.destroyTransport()
    this.connect()
  }

  private handleDisconnect(error?: Error) {
    if (error) {
      this.logFn?.('warn', `Discord: disconnected with error: ${error.message}`)
    } else {
      this.logFn?.('info', 'Discord: disconnected')
    }
    this.state = {
      ...this.state,
      available: false,
      authenticated: false,
      voiceChannel: null,
      participants: [],
    }
    this.push()

    if (!this.stopped) {
      this.logFn?.('info', 'Discord: scheduling reconnect in 10s')
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      if (!this.stopped) {
        this.connect()
      }
    }, 10_000)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private destroyTransport() {
    if (this.transport) {
      this.transport.destroy()
      this.transport = null
    }
  }

  private push() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('discord:stateChange', this.state)
    }
    this.stateChangeFn?.()
  }
}
