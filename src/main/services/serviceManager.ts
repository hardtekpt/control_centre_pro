import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../../shared/types'
import type { ServiceInfo, ServiceConfig, LogEntry, ArctisState } from '../../shared/types'

// ─── Service registry ─────────────────────────────────────────────────────────

interface ServiceDef {
  id: string
  name: string
  description: string
  script: string
}

/** Registration for a non-Python "native" service managed externally */
interface NativeServiceRegistration {
  id: string
  name: string
  description: string
  onEnable: () => void
  onDisable: () => void
  /** Returns true when the service has an active connection / is operational */
  isRunning: () => boolean
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    id: 'arctis-hid',
    name: 'Arctis Nova Pro HID',
    description: 'Direct USB HID control for the SteelSeries Arctis Nova Pro Wireless headset',
    script: 'arctis_hid_service.py',
  },
]

// ─── Persisted config shape ───────────────────────────────────────────────────

interface SavedConfig {
  pythonPath?: string
  services?: Record<string, boolean>
}

// ─── Service Manager ──────────────────────────────────────────────────────────

export class ServiceManager {
  private processes = new Map<string, ChildProcess | null>()
  private enabled: Record<string, boolean> = {}
  private pythonPath = 'python'
  private configPath: string
  private window: BrowserWindow | null = null
  private lastArctisState: ArctisState | null = null
  private nativeServices: NativeServiceRegistration[] = []

  constructor() {
    this.configPath = join(app.getPath('userData'), 'services.json')
    this.loadConfig()
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  private push(channel: string, ...args: unknown[]): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, ...args)
    }
  }

  private servicesDir(): string {
    return is.dev
      ? join(app.getAppPath(), 'resources', 'services')
      : join(process.resourcesPath, 'services')
  }

  private loadConfig(): void {
    if (existsSync(this.configPath)) {
      const saved = JSON.parse(readFileSync(this.configPath, 'utf-8')) as SavedConfig
      this.pythonPath = saved.pythonPath ?? 'python'
      const svcMap = saved.services ?? {}
      // Load ALL saved service states so native services also restore their enabled/disabled flag
      for (const [id, val] of Object.entries(svcMap)) {
        this.enabled[id] = val
      }
      // Apply defaults for Python services not yet in the saved config
      for (const def of SERVICE_DEFS) {
        if (!(def.id in this.enabled)) this.enabled[def.id] = true
      }
    } else {
      for (const def of SERVICE_DEFS) {
        this.enabled[def.id] = true
      }
    }
  }

  private saveConfig(): void {
    const payload: SavedConfig = {
      pythonPath: this.pythonPath,
      services: { ...this.enabled },
    }
    writeFileSync(this.configPath, JSON.stringify(payload, null, 2), 'utf-8')
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register a non-Python service so it appears in the service list, the About
   * terminal, and the Settings enable/disable toggle alongside Python services.
   * Must be called before startAll().
   */
  registerNativeService(reg: NativeServiceRegistration): void {
    this.nativeServices.push(reg)
    if (!(reg.id in this.enabled)) this.enabled[reg.id] = true
  }

  /** Emit a log entry on behalf of a native service — appears in the About terminal */
  emitNativeLog(id: string, name: string, level: 'info' | 'warn' | 'error', message: string): void {
    this.emitLog(id, name, level, message)
  }

  /** Re-broadcast the service list (call when a native service's running state changes) */
  broadcastServiceState(): void {
    this.push(IPC_CHANNELS.SERVICES_STATE_CHANGE, this.getServiceList())
  }

  getServiceList(): ServiceInfo[] {
    const pythonList: ServiceInfo[] = SERVICE_DEFS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      enabled: this.enabled[def.id] ?? true,
      running: (this.processes.get(def.id) ?? null) !== null,
    }))
    const nativeList: ServiceInfo[] = this.nativeServices.map((ns) => ({
      id: ns.id,
      name: ns.name,
      description: ns.description,
      enabled: this.enabled[ns.id] ?? true,
      running: ns.isRunning(),
    }))
    return [...pythonList, ...nativeList]
  }

  getServiceConfig(): ServiceConfig {
    return { pythonPath: this.pythonPath }
  }

  getArctisState(): ArctisState | null {
    return this.lastArctisState
  }

  sendArctisCmd(cmd: string, value: unknown): void {
    const child = this.processes.get('arctis-hid')
    if (!child?.stdin?.writable) return
    child.stdin.write(JSON.stringify({ cmd, value }) + '\n')
  }

  setEnabled(id: string, enabled: boolean): void {
    this.enabled[id] = enabled
    this.saveConfig()

    // Native service — delegate entirely to its callbacks and return early
    const nativeSvc = this.nativeServices.find((ns) => ns.id === id)
    if (nativeSvc) {
      if (enabled) nativeSvc.onEnable()
      else nativeSvc.onDisable()
      this.push(IPC_CHANNELS.SERVICES_STATE_CHANGE, this.getServiceList())
      return
    }

    // Python subprocess service
    if (enabled) {
      this.startService(id)
    } else {
      this.stopService(id)
      if (id === 'arctis-hid') {
        this.lastArctisState = null
        this.push(IPC_CHANNELS.ARCTIS_DISCONNECTED)
      }
    }
    this.push(IPC_CHANNELS.SERVICES_STATE_CHANGE, this.getServiceList())
  }

  setPythonPath(path: string): void {
    this.pythonPath = path
    this.saveConfig()
    // Restart all running services so they pick up the new interpreter
    for (const def of SERVICE_DEFS) {
      if (this.enabled[def.id]) {
        this.startService(def.id)
      }
    }
  }

  startAll(): void {
    for (const def of SERVICE_DEFS) {
      if (this.enabled[def.id] ?? true) {
        this.startService(def.id)
      }
    }
    for (const ns of this.nativeServices) {
      if (this.enabled[ns.id] ?? true) {
        ns.onEnable()
      }
    }
  }

  stopAll(): void {
    for (const def of SERVICE_DEFS) {
      this.stopService(def.id)
    }
    for (const ns of this.nativeServices) {
      ns.onDisable()
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private startService(id: string): void {
    this.stopService(id)

    const def = SERVICE_DEFS.find((d) => d.id === id)!
    const scriptPath = join(this.servicesDir(), def.script)

    const child = spawn(this.pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.processes.set(id, child)
    this.emitLog(id, def.name, 'info', 'Service started')
    this.push(IPC_CHANNELS.SERVICES_STATE_CHANGE, this.getServiceList())

    let buf = ''
    child.stdout!.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop()!
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          this.handleMessage(id, def.name, JSON.parse(line) as Record<string, unknown>)
        } catch {
          // malformed JSON from subprocess — ignore
        }
      }
    })

    child.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) this.emitLog(id, def.name, 'error', text)
    })

    child.on('exit', (code) => {
      this.processes.set(id, null)
      this.emitLog(id, def.name, 'info', `Service process exited (code ${code ?? 'unknown'})`)
      this.push(IPC_CHANNELS.SERVICES_STATE_CHANGE, this.getServiceList())
    })
  }

  private stopService(id: string): void {
    const child = this.processes.get(id)
    if (child) {
      child.kill()
      this.processes.set(id, null)
    }
  }

  private handleMessage(id: string, name: string, msg: Record<string, unknown>): void {
    switch (msg.type as string) {
      case 'log':
        this.emitLog(id, name, msg.level as 'info' | 'warn' | 'error', msg.message as string)
        break
      case 'connected': {
        const state = msg.data as ArctisState
        this.lastArctisState = state
        this.emitLog(id, name, 'info', 'Device connected')
        this.push(IPC_CHANNELS.ARCTIS_CONNECTED, state)
        break
      }
      case 'disconnected':
        this.lastArctisState = null
        this.push(IPC_CHANNELS.ARCTIS_DISCONNECTED)
        break
      case 'event': {
        const eventName = msg.event as string
        const eventData = msg.data as Record<string, unknown>
        if (this.lastArctisState) {
          // Update state for all events that carry state — not just ConnectivityEvent
          this.lastArctisState = { ...this.lastArctisState, ...eventData }
        }
        this.push(IPC_CHANNELS.ARCTIS_EVENT, eventName, eventData)
        break
      }
      case 'fatal':
        this.emitLog(id, name, 'error', msg.message as string)
        break
    }
  }

  private emitLog(
    serviceId: string,
    serviceName: string,
    level: 'info' | 'warn' | 'error',
    message: string,
  ): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      serviceId,
      serviceName,
      level,
      message,
    }
    this.push(IPC_CHANNELS.SERVICE_LOG, entry)
  }
}
