import WebSocket from 'ws'
import * as https from 'https'
import * as http from 'http'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { HaEntity, HaState, HaServiceCall } from '../../shared/types'

const RECONNECT_BASE_MS = 2_000
const RECONNECT_MAX_MS  = 30_000
const WS_TIMEOUT_MS     = 10_000

export class HomeAssistantService {
  private window: BrowserWindow | null = null
  private ws: WebSocket | null = null
  private url = ''
  private token = ''
  private enabled = false
  private entities = new Map<string, HaEntity>()
  private msgId = 1
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectDelay = RECONNECT_BASE_MS
  private stopped = false
  private logFn: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null
  private stateChangeFn: (() => void) | null = null
  private status: HaState['status'] = 'disabled'
  private lastError: string | null = null

  setWindow(win: BrowserWindow): void { this.window = win }
  setLogEmitter(fn: (level: 'info' | 'warn' | 'error', msg: string) => void): void { this.logFn = fn }
  setStateChangeNotifier(fn: () => void): void { this.stateChangeFn = fn }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    this.stopped = false
    this.enabled = true
    this.connect()
  }

  stop(): void {
    this.stopped = true
    this.enabled = false
    this.clearReconnect()
    this.ws?.close()
    this.ws = null
    this.status = 'disabled'
    this.lastError = null
    this.pushState()
    this.stateChangeFn?.()
  }

  isAvailable(): boolean {
    return this.status === 'connected'
  }

  applySettings(url: string, token: string): void {
    const changed = this.url !== url || this.token !== token
    this.url = url
    this.token = token
    if (changed && this.enabled) {
      this.ws?.close()
      this.clearReconnect()
      this.reconnectDelay = RECONNECT_BASE_MS
      this.connect()
    }
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  private connect(): void {
    if (this.stopped || !this.url || !this.token) {
      if (!this.url || !this.token) {
        this.log('warn', 'No URL or token configured — enter credentials in Settings → Plugins → Home Assistant')
      }
      this.status = 'installed'
      this.pushState()
      return
    }
    this.status = 'installed'
    this.pushState()

    const wsUrl = this.url.replace(/^http/, 'ws') + '/api/websocket'

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (err) {
      this.handleError(`Invalid URL: ${err}`)
      return
    }
    this.ws = ws

    const timeout = setTimeout(() => ws.terminate(), WS_TIMEOUT_MS)

    ws.on('open', () => {
      clearTimeout(timeout)
      this.log('info', 'WebSocket connected, waiting for auth_required')
    })

    ws.on('message', (data: WebSocket.RawData) => {
      clearTimeout(timeout)
      void this.handleMessage(JSON.parse(data.toString()) as Record<string, unknown>)
    })

    ws.on('close', () => {
      clearTimeout(timeout)
      if (!this.stopped) {
        this.log('warn', 'Connection closed, scheduling reconnect')
        this.status = 'installed'
        this.lastError = null
        this.pushState()
        this.scheduleReconnect()
      }
    })

    ws.on('error', (err: Error) => {
      clearTimeout(timeout)
      this.handleError(err.message)
    })
  }

  // ── Message handling ────────────────────────────────────────────────────────

  private async handleMessage(msg: Record<string, unknown>): Promise<void> {
    switch (msg.type) {
      case 'auth_required':
        this.send({ type: 'auth', access_token: this.token })
        break

      case 'auth_ok':
        this.log('info', 'Authenticated')
        await this.fetchEntities()
        this.subscribeEvents()
        break

      case 'auth_invalid':
        this.handleError('Authentication failed — check your long-lived access token')
        this.ws?.close()
        this.stopped = true  // don't reconnect on auth failure
        break

      case 'event': {
        const event = msg.event as Record<string, unknown>
        if (event?.event_type === 'state_changed') {
          const newState = (event.data as Record<string, unknown>)?.new_state as HaEntity | undefined
          if (newState?.entity_id) {
            this.entities.set(newState.entity_id, newState)
            this.pushState()
          }
        }
        break
      }

      case 'result':
        break
    }
  }

  // ── REST: fetch all entities ────────────────────────────────────────────────

  private fetchEntities(): Promise<void> {
    return new Promise((resolve) => {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(this.url)
      } catch {
        this.handleError('Invalid Home Assistant URL')
        resolve()
        return
      }

      const opts: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: '/api/states',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
      const lib = parsedUrl.protocol === 'https:' ? https : http
      const req = lib.request(opts, (res) => {
        let body = ''
        res.on('data', (chunk: string) => { body += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as HaEntity[]
            this.entities.clear()
            for (const e of parsed) this.entities.set(e.entity_id, e)
            this.status = 'connected'
            this.lastError = null
            this.reconnectDelay = RECONNECT_BASE_MS
            this.log('info', `Loaded ${this.entities.size} entities`)
            this.pushState()
            this.stateChangeFn?.()
          } catch (err) {
            this.handleError(`Failed to parse entities: ${err}`)
          }
          resolve()
        })
      })
      req.on('error', (err: Error) => {
        this.handleError(`REST fetch failed: ${err.message}`)
        resolve()
      })
      req.end()
    })
  }

  // ── WebSocket subscriptions ─────────────────────────────────────────────────

  private subscribeEvents(): void {
    this.send({ id: this.nextId(), type: 'subscribe_events', event_type: 'state_changed' })
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getState(): HaState {
    return {
      status: this.status,
      error: this.lastError,
      entityCount: this.entities.size,
      entities: Array.from(this.entities.values()),
    }
  }

  callService(call: HaServiceCall): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('HA not connected'))
    }
    this.send({
      id: this.nextId(),
      type: 'call_service',
      domain: call.domain,
      service: call.service,
      service_data: call.serviceData ?? {},
    })
    return Promise.resolve()
  }

  testConnection(url: string, token: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      let wsUrl: string
      try {
        wsUrl = url.replace(/^http/, 'ws') + '/api/websocket'
        new URL(url)  // validate
      } catch {
        resolve({ ok: false, error: 'Invalid URL' })
        return
      }

      let settled = false
      const settle = (result: { ok: boolean; error?: string }): void => {
        if (settled) return
        settled = true
        try { testWs.close() } catch { /* ignore */ }
        resolve(result)
      }

      const testWs = new WebSocket(wsUrl)
      const timeout = setTimeout(() => settle({ ok: false, error: 'Connection timed out' }), 8_000)

      testWs.on('message', (data: WebSocket.RawData) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>
        if (msg.type === 'auth_required') {
          testWs.send(JSON.stringify({ type: 'auth', access_token: token }))
        } else if (msg.type === 'auth_ok') {
          clearTimeout(timeout)
          settle({ ok: true })
        } else if (msg.type === 'auth_invalid') {
          clearTimeout(timeout)
          settle({ ok: false, error: 'Invalid access token' })
        }
      })
      testWs.on('error', (err: Error) => {
        clearTimeout(timeout)
        settle({ ok: false, error: err.message })
      })
      testWs.on('close', () => {
        clearTimeout(timeout)
        settle({ ok: false, error: 'Connection closed unexpectedly' })
      })
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private nextId(): number { return this.msgId++ }

  private pushState(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.HA_STATE_CHANGE, this.getState())
    }
  }

  private log(level: 'info' | 'warn' | 'error', msg: string): void {
    this.logFn?.(level, `HA: ${msg}`)
  }

  private handleError(msg: string): void {
    this.status = 'error'
    this.lastError = msg
    this.log('error', msg)
    this.pushState()
    this.stateChangeFn?.()
    if (!this.stopped) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    this.clearReconnect()
    this.reconnectTimer = setTimeout(() => { this.connect() }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
