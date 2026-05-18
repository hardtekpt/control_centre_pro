import * as https from 'https'
import * as http from 'http'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type {
  SonarState,
  SonarChannel,
  SonarDeviceChannel,
  SonarMode,
  SonarClassicVolumes,
  SonarChannelVolume,
  SonarConfig,
  SonarPollingConfig,
  SonarAudioDevice,
  SonarRedirections,
} from '../../shared/types'

// Maps internal SonarDeviceChannel names to the 'ChannelDict' path keys used by
// the classicRedirections write endpoint. chatRender → chat, chatCapture → mic.
const CHANNEL_DICT_KEY: Record<string, string> = {
  game: 'game',
  chatRender: 'chat',
  chatCapture: 'mic',
  media: 'media',
  aux: 'aux',
}

// ─── SonarService ─────────────────────────────────────────────────────────────

/**
 * Polls the GG Sonar local HTTP REST API and proxies read/write IPC calls.
 * Discovery: GET https://127.0.0.1:6327/subApps (HTTPS, ignore cert)
 * Polling interval (default 1s): mode, volumes, chatMix, configs, routing, devices
 */
export class SonarService {
  private baseUrl: string | null = null
  private window: BrowserWindow | null = null
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private discovering = false
  private lastAvailable = false
  private discoveryFailures = 0
  private pendingMode: SonarMode | null = null
  private pendingModeExpiry = 0

  // Callbacks wired by main/index.ts so SonarService can emit into the service infrastructure
  private logFn: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null
  private stateChangeFn: (() => void) | null = null

  private pollingConfig: SonarPollingConfig = {
    pollingIntervalMs: 1000,
  }

  private state: SonarState = {
    available: false,
    mode: 'classic',
    classic: null,
    streamer: null,
    configs: [],
    routing: [],
    chatMix: null,
    audioDevices: [],
    redirections: {},
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  /** Wire a log callback so events appear in the About page terminal */
  setLogEmitter(fn: (level: 'info' | 'warn' | 'error', msg: string) => void): void {
    this.logFn = fn
  }

  /** Wire a callback that fires whenever availability flips so the service list refreshes */
  setStateChangeNotifier(fn: () => void): void {
    this.stateChangeFn = fn
  }

  getState(): SonarState {
    return this.state
  }

  isAvailable(): boolean {
    return this.state.available
  }

  getPollingConfig(): SonarPollingConfig {
    return { ...this.pollingConfig }
  }

  setPollingConfig(config: SonarPollingConfig): void {
    this.pollingConfig = { ...config }
    // Restart timer with new interval if service is running
    if (this.pollingTimer !== null) {
      this.stop()
      this.start()
    }
  }

  start(): void {
    // Prevent timer accumulation if called more than once (e.g. re-enable from settings)
    this.stop()
    this.poll()
    this.pollingTimer = setInterval(() => this.poll(), this.pollingConfig.pollingIntervalMs)
  }

  stop(): void {
    if (this.pollingTimer !== null) { clearInterval(this.pollingTimer); this.pollingTimer = null }
    if (this.refreshTimer !== null) { clearTimeout(this.refreshTimer); this.refreshTimer = null }
  }

  // ── Write commands ──────────────────────────────────────────────────────────

  async setVolume(channel: SonarChannel, value: number): Promise<void> {
    if (!this.baseUrl) return
    const clamped = Math.max(0, Math.min(1, value))
    const percent = Math.round(clamped * 100)
    this.log('info', `${channel}: volume ${percent}%`)
    await this.httpPut(`${this.baseUrl}/volumeSettings/classic/${channel}/Volume/${clamped}`)
    this.applyClassicPatch(channel, { volume: clamped })
    this.push()
    this.scheduleRefresh()
  }

  async setMute(channel: SonarChannel, muted: boolean): Promise<void> {
    if (!this.baseUrl) return
    this.log('info', `${channel}: ${muted ? 'muted' : 'unmuted'}`)
    await this.httpPut(`${this.baseUrl}/volumeSettings/classic/${channel}/Mute/${muted}`)
    this.applyClassicPatch(channel, { muted })
    this.push()
    this.scheduleRefresh()
  }

  async selectPreset(id: string): Promise<void> {
    if (!this.baseUrl) return
    const raw = await this.httpPut(`${this.baseUrl}/configs/${id}/select`)
    try {
      const selected = JSON.parse(raw) as SonarConfig
      this.log('info', `GG Sonar: ${selected.virtualAudioDevice} → preset "${selected.name}"`)
      // Replace matching config in list to reflect any updated fields
      this.state = {
        ...this.state,
        configs: this.state.configs.map((c) => (c.id === selected.id ? selected : c)),
      }
    } catch {
      // non-fatal — list will refresh on next slow poll
    }
    this.push()
    this.scheduleRefresh()
  }

  async setMode(mode: SonarMode): Promise<void> {
    if (!this.baseUrl) return
    try {
      // API path key: 'classic' → 'classic', 'streamer' → 'stream'
      const modeKey = mode === 'streamer' ? 'stream' : 'classic'
      this.log('info', `Mode: ${mode}`)
      await this.httpPut(`${this.baseUrl}/mode/${modeKey}`)
      // Hold the mode for 4 s so the 1-second fast poll doesn't immediately
      // revert it if the API echoes back the old value before the change settles.
      this.pendingMode = mode
      this.pendingModeExpiry = Date.now() + 4000
      this.state = { ...this.state, mode }
      this.push()
      this.scheduleRefresh()
    } catch {
      // endpoint may not exist — ignore
    }
  }

  async setRedirection(channel: SonarDeviceChannel, deviceId: string): Promise<void> {
    if (!this.baseUrl) return
    // Correct path: PUT /classicRedirections/{channelDictKey}/deviceId/{deviceId}
    // ChannelDict uses 'chat' for chatRender and 'mic' for chatCapture
    const channelKey = CHANNEL_DICT_KEY[channel] ?? channel
    const device = this.state.audioDevices.find((d) => d.id === deviceId)
    this.log('info', `${channel}: route to "${device?.name ?? deviceId}"`)
    await this.httpPut(`${this.baseUrl}/classicRedirections/${channelKey}/deviceId/${deviceId}`)
    // Optimistic update: resolve the full device from audioDevices so the dropdown
    // immediately shows the correct name without waiting for the next poll
    if (device) {
      this.state = {
        ...this.state,
        redirections: { ...this.state.redirections, [channel]: device },
      }
    }
    this.push()
    this.scheduleRefresh()
  }

  async refreshDevices(): Promise<void> {
    if (!this.baseUrl) return
    await this.fetchDevices()
    this.push()
  }

  async routeProcess(processId: number, targetChannel: string): Promise<void> {
    if (!this.baseUrl) return
    const targetRoute = this.state.routing.find((r) => r.role === targetChannel)
    if (!targetRoute) return
    // Correct path: PUT /AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}
    // dataFlow is 'capture' for the mic channel, 'render' for everything else
    const dataFlow = targetChannel === 'chatCapture' ? 'capture' : 'render'
    await this.httpPut(`${this.baseUrl}/AudioDeviceRouting/${dataFlow}/${targetRoute.deviceId}/${processId}`)
    // Optimistic: move the session from its current route to the target route
    const session = this.state.routing.flatMap((r) => r.audioSessions).find((s) => s.processId === processId)
    if (session) {
      this.state = {
        ...this.state,
        routing: this.state.routing.map((r) => {
          if (r.role === targetChannel) {
            return { ...r, audioSessions: [...r.audioSessions, session] }
          }
          return { ...r, audioSessions: r.audioSessions.filter((s) => s.processId !== processId) }
        }),
      }
    }
    this.push()
    this.scheduleRefresh()
  }

  // ── Polling ─────────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.baseUrl) {
      await this.discover()
      if (!this.baseUrl) {
        if (this.state.available) {
          this.state = { ...this.state, available: false }
          this.push()
        }
        return
      }
    }
    try {
      // Fetch all state in parallel
      const [modeRaw, classicRaw, streamerRaw, chatMixRaw, configsRaw, routingRaw, selectedRaw] = await Promise.all([
        this.httpGet(`${this.baseUrl}/mode`),
        this.httpGet(`${this.baseUrl}/volumeSettings/classic`),
        this.httpGet(`${this.baseUrl}/volumeSettings/streamer`),
        this.httpGet(`${this.baseUrl}/chatMix`),
        this.httpGet(`${this.baseUrl}/configs`),
        this.httpGet(`${this.baseUrl}/AudioDeviceRouting`).catch(() => '[]'),
        this.httpGet(`${this.baseUrl}/configs/selected`).catch(() => '[]'),
      ])

      const polledMode = JSON.parse(modeRaw) as SonarMode
      const now = Date.now()
      const effectiveMode = (this.pendingMode !== null && now < this.pendingModeExpiry)
        ? this.pendingMode
        : (this.pendingMode = null, polledMode)

      const allConfigs = JSON.parse(configsRaw) as SonarConfig[]
      const selectedIds = new Set(
        (JSON.parse(selectedRaw) as SonarConfig[]).map((c) => c.id)
      )
      const configs = allConfigs.map((c) => ({ ...c, isSelected: selectedIds.has(c.id) }))

      const wasUnavailable = !this.state.available
      this.state = {
        ...this.state,
        available: true,
        mode: effectiveMode,
        classic: JSON.parse(classicRaw) as SonarClassicVolumes,
        streamer: JSON.parse(streamerRaw),
        chatMix: JSON.parse(chatMixRaw),
        configs,
        routing: JSON.parse(routingRaw),
      }

      // Fetch device data separately so a failure there doesn't block other endpoints
      await this.fetchDevices()

      this.push()
    } catch {
      this.baseUrl = null
      if (this.state.available) {
        this.state = { ...this.state, available: false }
        this.push()
      }
    }
  }

  // Fetch /audioDevices and /classicRedirections, cross-reference them at the service level,
  // and store the resolved SonarAudioDevice per channel in state.redirections.
  // Called immediately on first connect and on every slow poll.
  private async fetchDevices(): Promise<void> {
    if (!this.baseUrl) return
    const firstFetch = this.state.audioDevices.length === 0

    let audioDevicesRaw = '[]'
    let redirectionsRaw = '{}'
    try {
      ;[audioDevicesRaw, redirectionsRaw] = await Promise.all([
        this.httpGet(`${this.baseUrl}/audioDevices`),
        this.httpGet(`${this.baseUrl}/classicRedirections`),
      ])
    } catch (err) {
      this.log('warn', `GG Sonar: device endpoints unavailable — ${String(err)}`)
      return
    }

    if (firstFetch) {
      try {
        const deviceCount = (JSON.parse(audioDevicesRaw) as unknown[]).length
        this.log('info', `GG Sonar: /audioDevices — ${deviceCount} device(s)`)
      } catch {
        this.log('warn', `GG Sonar: /audioDevices non-JSON: ${audioDevicesRaw.slice(0, 120)}`)
      }
      try {
        JSON.parse(redirectionsRaw)
        this.log('info', `GG Sonar: /classicRedirections — ${redirectionsRaw.slice(0, 300)}`)
      } catch {
        this.log('warn', `GG Sonar: /classicRedirections non-JSON: ${redirectionsRaw.slice(0, 120)}`)
      }
    }

    const audioDevices = this.parseAudioDevices(audioDevicesRaw)
    const rawIds = this.parseRawRedirections(redirectionsRaw) // channel → raw id string

    // Build a normalised-id → device lookup for cross-referencing
    const byNormId = new Map<string, SonarAudioDevice>()
    const byName = new Map<string, SonarAudioDevice>()
    for (const d of audioDevices) {
      byNormId.set(this.normalise(d.id), d)
      byName.set(d.name.toLowerCase(), d)
    }

    // Resolve each channel to a full SonarAudioDevice
    const redirections: SonarRedirections = {}
    for (const [channel, rawId] of Object.entries(rawIds)) {
      const byId = byNormId.get(this.normalise(rawId))
      if (byId) {
        redirections[channel] = byId
      } else {
        // ID match failed — try name match as fallback
        const byNameMatch = byName.get(rawId.toLowerCase())
        if (byNameMatch) {
          redirections[channel] = byNameMatch
        } else {
          // No match at all — keep the raw value visible (not silent "Default")
          redirections[channel] = { id: rawId, name: rawId }
          if (firstFetch && rawId) {
            this.log('warn', `GG Sonar: no audioDevice matched "${rawId}" for channel "${channel}"`)
          }
        }
      }
    }

    this.state = { ...this.state, audioDevices, redirections }
  }

  // Normalise a device identifier for comparison: lowercase, strip surrounding braces.
  private normalise(raw: string): string {
    return raw.replace(/^\{/, '').replace(/\}$/, '').toLowerCase()
  }

  private parseAudioDevices(raw: string): SonarAudioDevice[] {
    try {
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) {
        this.log('warn', `GG Sonar: /audioDevices is not an array (got ${typeof data})`)
        return this.state.audioDevices
      }
      // role === 'none' identifies physical Windows audio devices vs Sonar virtual channels
      const parsed = (data as Record<string, unknown>[])
        .filter((d) => d.role === 'none')
        .map((d) => ({
          id: String(d.id ?? d.deviceId ?? ''),
          name: String(d.friendlyName ?? d.name ?? d.deviceName ?? 'Unknown'),
        }))
        .filter((d) => d.id.length > 0)
      if (parsed.length === 0 && (data as unknown[]).length > 0) {
        this.log('warn', `GG Sonar: /audioDevices entries lack id/deviceId — first: ${JSON.stringify((data as unknown[])[0])}`)
      }
      return parsed
    } catch (err) {
      this.log('warn', `GG Sonar: failed to parse /audioDevices — ${String(err)}`)
      return this.state.audioDevices
    }
  }

  // Maps API channel names to internal SonarDeviceChannel names
  private readonly CHANNEL_NAME_MAP: Record<string, string> = {
    chat: 'chatRender',
    mic: 'chatCapture',
  }

  // Returns channel → raw id string; cross-referencing with audioDevices happens in fetchDevices.
  private parseRawRedirections(raw: string): Record<string, string> {
    try {
      const data = JSON.parse(raw)
      const result: Record<string, string> = {}

      if (Array.isArray(data)) {
        // Shape: [{ id: "game", deviceId: "..." }, ...]  (id = channel name)
        for (const entry of data as Record<string, unknown>[]) {
          const apiChannel = String(entry.id ?? entry.role ?? entry.channel ?? '')
          const channel = this.CHANNEL_NAME_MAP[apiChannel] ?? apiChannel
          const rawId = String(entry.deviceId ?? '')
          if (channel && rawId) result[channel] = rawId
        }
      } else if (data && typeof data === 'object') {
        // Shape: { game: "...", ... }  or { game: { deviceId|id: "..." }, ... }
        for (const [apiChannel, val] of Object.entries(data as Record<string, unknown>)) {
          const channel = this.CHANNEL_NAME_MAP[apiChannel] ?? apiChannel
          if (typeof val === 'string') {
            result[channel] = val
          } else if (val && typeof val === 'object') {
            const v = val as Record<string, unknown>
            const rawId = String(v.deviceId ?? v.id ?? '')
            if (rawId) result[channel] = rawId
          }
        }
      } else {
        this.log('warn', `GG Sonar: unexpected /classicRedirections shape: ${typeof data}`)
      }

      return result
    } catch (err) {
      this.log('warn', `GG Sonar: failed to parse /classicRedirections — ${String(err)}`)
      return {}
    }
  }

  // ── Discovery ───────────────────────────────────────────────────────────────

  private async discover(): Promise<void> {
    if (this.discovering) return
    this.discovering = true
    try {
      const raw = await this.httpsGet('https://127.0.0.1:6327/subApps')
      const data = JSON.parse(raw) as {
        subApps?: { sonar?: { metadata?: { webServerAddress?: string } } }
      }
      const addr = data.subApps?.sonar?.metadata?.webServerAddress
      if (addr) {
        this.baseUrl = addr.replace(/\/$/, '')
        if (this.discoveryFailures > 0) {
          this.log('info', `GG Sonar discovered at ${addr}`)
          this.discoveryFailures = 0
        }
      } else {
        this.discoveryFailures++
        if (this.discoveryFailures === 1) {
          this.log('warn', 'GG Sonar: subApps response missing sonar metadata')
        }
      }
    } catch (err) {
      this.discoveryFailures++
      if (this.discoveryFailures === 1) {
        this.log('error', `GG Sonar discovery failed: ${String(err)} — is GG running?`)
      }
    } finally {
      this.discovering = false
    }
  }

  // ── Post-write refresh ──────────────────────────────────────────────────────

  // Coalescing 100 ms refresh — multiple rapid writes collapse into one poll.
  private scheduleRefresh(delayMs = 100): void {
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer)
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      this.poll().catch(() => {})
    }, delayMs)
  }

  // ── State helpers ───────────────────────────────────────────────────────────

  private applyClassicPatch(channel: SonarChannel, patch: Partial<SonarChannelVolume>): void {
    if (!this.state.classic) return
    const classic = this.state.classic
    if (channel === 'master') {
      this.state = {
        ...this.state,
        classic: {
          ...classic,
          masters: {
            ...classic.masters,
            classic: { ...classic.masters.classic, ...patch },
          },
        },
      }
    } else {
      const ch = channel as SonarDeviceChannel
      this.state = {
        ...this.state,
        classic: {
          ...classic,
          devices: {
            ...classic.devices,
            [ch]: {
              ...classic.devices[ch],
              classic: { ...classic.devices[ch].classic, ...patch },
            },
          },
        },
      }
    }
  }

  private log(level: 'info' | 'warn' | 'error', msg: string): void {
    this.logFn?.(level, msg)
  }

  private push(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.SONAR_STATE_CHANGE, this.state)
    }
    // Detect availability transitions and notify the service infrastructure
    const nowAvailable = this.state.available
    if (nowAvailable !== this.lastAvailable) {
      this.lastAvailable = nowAvailable
      this.log('info', nowAvailable ? 'Connected to GG Sonar' : 'GG Sonar disconnected')
      this.stateChangeFn?.()
    }
  }

  // ── HTTP helpers ────────────────────────────────────────────────────────────

  private httpsGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const agent = new https.Agent({ rejectUnauthorized: false })
      const req = https.get(url, { agent }, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
    })
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
    })
  }

  private httpPut(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: { 'Content-Length': '0' },
      }
      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
      req.end()
    })
  }

  private httpPutJson(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const buf = Buffer.from(body, 'utf-8')
      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': buf.length.toString(),
        },
      }
      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
      req.write(buf)
      req.end()
    })
  }
}
