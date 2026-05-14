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
} from '../../shared/types'

// ─── SonarService ─────────────────────────────────────────────────────────────

/**
 * Polls the GG Sonar local HTTP REST API and proxies read/write IPC calls.
 * Discovery: GET https://127.0.0.1:6327/subApps (HTTPS, ignore cert)
 * Fast poll (1 s): mode, volumes, chatMix
 * Slow poll (5 s): configs, routing
 */
export class SonarService {
  private baseUrl: string | null = null
  private window: BrowserWindow | null = null
  private fastTimer: ReturnType<typeof setInterval> | null = null
  private slowTimer: ReturnType<typeof setInterval> | null = null
  private discovering = false
  private lastAvailable = false
  private pendingMode: SonarMode | null = null
  private pendingModeExpiry = 0

  // Callbacks wired by main/index.ts so SonarService can emit into the service infrastructure
  private logFn: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null
  private stateChangeFn: (() => void) | null = null

  private pollingConfig: SonarPollingConfig = {
    fastIntervalMs: 1000,
    slowIntervalMs: 5000,
  }

  private state: SonarState = {
    available: false,
    mode: 'classic',
    classic: null,
    streamer: null,
    configs: [],
    routing: [],
    chatMix: null,
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
    // Restart timers with new intervals if service is running
    if (this.fastTimer !== null || this.slowTimer !== null) {
      this.stop()
      this.start()
    }
  }

  start(): void {
    // Prevent timer accumulation if called more than once (e.g. re-enable from settings)
    this.stop()
    this.pollFast()
    this.pollSlow()
    this.fastTimer = setInterval(() => this.pollFast(), this.pollingConfig.fastIntervalMs)
    this.slowTimer = setInterval(() => this.pollSlow(), this.pollingConfig.slowIntervalMs)
  }

  stop(): void {
    if (this.fastTimer !== null) { clearInterval(this.fastTimer); this.fastTimer = null }
    if (this.slowTimer !== null) { clearInterval(this.slowTimer); this.slowTimer = null }
  }

  // ── Write commands ──────────────────────────────────────────────────────────

  async setVolume(channel: SonarChannel, value: number): Promise<void> {
    if (!this.baseUrl) return
    const clamped = Math.max(0, Math.min(1, value))
    await this.httpPut(`${this.baseUrl}/volumeSettings/classic/${channel}/Volume/${clamped}`)
    this.applyClassicPatch(channel, { volume: clamped })
    this.push()
  }

  async setMute(channel: SonarChannel, muted: boolean): Promise<void> {
    if (!this.baseUrl) return
    await this.httpPut(`${this.baseUrl}/volumeSettings/classic/${channel}/Mute/${muted}`)
    this.applyClassicPatch(channel, { muted })
    this.push()
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
  }

  async setMode(mode: SonarMode): Promise<void> {
    if (!this.baseUrl) return
    try {
      await this.httpPutJson(`${this.baseUrl}/mode`, JSON.stringify(mode))
      // Hold the mode for 4 s so the 1-second fast poll doesn't immediately
      // revert it if the API echoes back the old value before the change settles.
      this.pendingMode = mode
      this.pendingModeExpiry = Date.now() + 4000
      this.state = { ...this.state, mode }
      this.push()
    } catch {
      // endpoint may not exist — ignore
    }
  }

  // ── Polling ─────────────────────────────────────────────────────────────────

  private async pollFast(): Promise<void> {
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
      const [modeRaw, classicRaw, streamerRaw, chatMixRaw] = await Promise.all([
        this.httpGet(`${this.baseUrl}/mode`),
        this.httpGet(`${this.baseUrl}/volumeSettings/classic`),
        this.httpGet(`${this.baseUrl}/volumeSettings/streamer`),
        this.httpGet(`${this.baseUrl}/chatMix`),
      ])
      const polledMode = JSON.parse(modeRaw) as SonarMode
      const now = Date.now()
      const effectiveMode = (this.pendingMode !== null && now < this.pendingModeExpiry)
        ? this.pendingMode
        : (this.pendingMode = null, polledMode)
      this.state = {
        ...this.state,
        available: true,
        mode: effectiveMode,
        classic: JSON.parse(classicRaw) as SonarClassicVolumes,
        streamer: JSON.parse(streamerRaw),
        chatMix: JSON.parse(chatMixRaw),
      }
      this.push()
    } catch {
      this.baseUrl = null
      if (this.state.available) {
        this.state = { ...this.state, available: false }
        this.push()
      }
    }
  }

  private async pollSlow(): Promise<void> {
    if (!this.baseUrl) return
    try {
      const [configsRaw, selectedRaw] = await Promise.all([
        this.httpGet(`${this.baseUrl}/configs`),
        this.httpGet(`${this.baseUrl}/configs/selected`),
      ])
      const allConfigs = JSON.parse(configsRaw) as SonarConfig[]
      const selectedConfigs = JSON.parse(selectedRaw) as SonarConfig[]
      const selectedIds = new Set(selectedConfigs.map((c) => c.id))

      // Mark each config as selected or not
      const markedConfigs = allConfigs.map((c) => ({
        ...c,
        isSelected: selectedIds.has(c.id),
      }))

      this.state = {
        ...this.state,
        configs: markedConfigs,
      }
      this.push()
    } catch {
      // non-fatal — keep cached values
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
      if (addr) this.baseUrl = addr.replace(/\/$/, '')
    } catch {
      // GG not running or not responding
    } finally {
      this.discovering = false
    }
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
