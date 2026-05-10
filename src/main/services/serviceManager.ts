import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../../shared/types'
import type { ServiceInfo, LogEntry, ArctisState } from '../../shared/types'

// ─── Service registry ─────────────────────────────────────────────────────────

interface ServiceDef {
  id: string
  name: string
  description: string
  script: string
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    id: 'arctis-hid',
    name: 'Arctis Nova Pro HID',
    description: 'Direct USB HID control for the SteelSeries Arctis Nova Pro Wireless headset',
    script: 'arctis_hid_service.py',
  },
]

// ─── Service Manager ──────────────────────────────────────────────────────────

export class ServiceManager {
  private processes = new Map<string, ChildProcess | null>()
  private config: Record<string, boolean> = {}
  private configPath: string
  private window: BrowserWindow | null = null
  private lastArctisState: ArctisState | null = null

  constructor() {
    this.configPath = join(app.getPath('userData'), 'services.json')
    this.loadConfig()
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  private push(channel: string, ...args: unknown[]): void {
    this.window?.webContents.send(channel, ...args)
  }

  private servicesDir(): string {
    return is.dev
      ? join(app.getAppPath(), 'resources', 'services')
      : join(process.resourcesPath, 'services')
  }

  private loadConfig(): void {
    if (existsSync(this.configPath)) {
      const saved = JSON.parse(readFileSync(this.configPath, 'utf-8')) as Record<string, boolean>
      for (const def of SERVICE_DEFS) {
        this.config[def.id] = saved[def.id] ?? true
      }
    } else {
      for (const def of SERVICE_DEFS) {
        this.config[def.id] = true
      }
    }
  }

  private saveConfig(): void {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
  }

  getServiceList(): ServiceInfo[] {
    return SERVICE_DEFS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      enabled: this.config[def.id] ?? true,
      running: (this.processes.get(def.id) ?? null) !== null,
    }))
  }

  getArctisState(): ArctisState | null {
    return this.lastArctisState
  }

  setEnabled(id: string, enabled: boolean): void {
    this.config[id] = enabled
    this.saveConfig()
    if (enabled) {
      this.startService(id)
    } else {
      this.stopService(id)
      // If disabling the arctis service, also clear its state
      if (id === 'arctis-hid') {
        this.lastArctisState = null
        this.push(IPC_CHANNELS.ARCTIS_DISCONNECTED)
      }
    }
    this.push(IPC_CHANNELS.SERVICES_STATE_CHANGE, this.getServiceList())
  }

  startAll(): void {
    for (const def of SERVICE_DEFS) {
      if (this.config[def.id] ?? true) {
        this.startService(def.id)
      }
    }
  }

  stopAll(): void {
    for (const def of SERVICE_DEFS) {
      this.stopService(def.id)
    }
  }

  private startService(id: string): void {
    this.stopService(id)

    const def = SERVICE_DEFS.find((d) => d.id === id)!
    const scriptPath = join(this.servicesDir(), def.script)

    const child = spawn('python', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.processes.set(id, child)
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
      case 'event':
        this.push(IPC_CHANNELS.ARCTIS_EVENT, msg.event as string, msg.data)
        break
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
