import { Worker } from 'worker_threads'
import { join } from 'path'
import type { DdcMonitor } from '../../../../shared/types'

const INPUT_NAME_MAP: Record<string, string> = {
  '0x01': 'VGA 1',
  '0x02': 'VGA 2',
  '0x03': 'DVI 1',
  '0x04': 'DVI 2',
  '0x0f': 'DisplayPort 1',
  '0x10': 'DisplayPort 2',
  '0x11': 'HDMI 1',
  '0x12': 'HDMI 2',
  '0x1b': 'USB-C',
}

type WorkerOutMsg =
  | { type: 'refreshDone'; id: number; monitors: DdcMonitor[]; devicePaths: Array<[number, string]> }
  | { type: 'setPrimaryDone'; id: number; monitors: DdcMonitor[]; devicePaths: Array<[number, string]> }
  | { type: 'error'; id: number; message: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

export class DdcService {
  private worker: Worker | null = null
  private devicePaths = new Map<number, string>()
  private cachedMonitors: DdcMonitor[] = []
  private cacheTimestamp = 0
  private available = false
  private running = false
  private logEmitter: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null
  private stateChangedCallback: ((monitors: DdcMonitor[]) => void) | null = null

  private pendingCallbacks = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private nextId = 1

  setLogEmitter(emitter: (level: 'info' | 'warn' | 'error', msg: string) => void): void {
    this.logEmitter = emitter
  }

  setStateChangedCallback(callback: (monitors: DdcMonitor[]) => void): void {
    this.stateChangedCallback = callback
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    this.logEmitter?.(level, message)
  }

  private notifyStateChanged(): void {
    this.stateChangedCallback?.(this.cachedMonitors)
  }

  isAvailable(): boolean {
    return this.available && this.running
  }

  start(): void {
    if (this.worker) return

    const workerPath = join(__dirname, 'ddcWorker.js')
    this.worker = new Worker(workerPath)
    this.available = true
    this.running = true

    this.worker.on('message', (msg: WorkerOutMsg) => {
      if (msg.type === 'log') {
        this.log(msg.level, msg.message)
        return
      }

      const pending = this.pendingCallbacks.get(msg.id)
      if (!pending) return
      this.pendingCallbacks.delete(msg.id)

      if (msg.type === 'error') {
        pending.reject(new Error(msg.message))
        return
      }

      // refreshDone or setPrimaryDone — update local state then resolve
      this.devicePaths = new Map(msg.devicePaths)
      this.cachedMonitors = msg.monitors
      this.cacheTimestamp = Date.now()
      this.notifyStateChanged()
      pending.resolve(msg.monitors)
    })

    this.worker.on('error', (err) => {
      this.log('error', `DDC worker error: ${err.message}`)
      // Reject all in-flight requests
      for (const [, cb] of this.pendingCallbacks) cb.reject(err)
      this.pendingCallbacks.clear()
    })

    this.worker.on('exit', (code) => {
      if (code !== 0) this.log('warn', `DDC worker exited with code ${code}`)
      this.worker = null
      this.available = false
    })

    this.log('info', 'DDC Display Control initialized')
  }

  stop(): void {
    this.running = false
    this.worker?.terminate()
    this.worker = null
    this.log('info', 'DDC display control service stopped')
  }

  getCachedMonitors(): DdcMonitor[] {
    return this.cachedMonitors
  }

  async refreshMonitors(): Promise<DdcMonitor[]> {
    if (!this.available || !this.running || !this.worker) return []

    const id = this.nextId++
    return new Promise<DdcMonitor[]>((resolve, reject) => {
      this.pendingCallbacks.set(id, { resolve, reject })
      this.worker!.postMessage({ type: 'refresh', id })
    })
  }

  setBrightness(monitorId: number, value: number): void {
    if (!this.available || !this.running || !this.worker) return

    const devicePath = this.devicePaths.get(monitorId)
    if (!devicePath) {
      this.log('warn', `No device path for monitor ${monitorId}`)
      return
    }

    const normalizedValue = Math.max(0, Math.min(100, Math.round(value)))
    const monitor = this.cachedMonitors.find((m) => m.monitor_id === monitorId)
    this.log('info', `Monitor ${monitor?.name || `#${monitorId}`}: brightness ${normalizedValue}%`)

    this.worker.postMessage({ type: 'setBrightness', devicePath, value: normalizedValue })

    // Optimistic cache update
    if (monitor) {
      monitor.brightness = normalizedValue
      this.notifyStateChanged()
    }
  }

  setInputSource(monitorId: number, inputValue: string): void {
    if (!this.available || !this.running || !this.worker) return

    const devicePath = this.devicePaths.get(monitorId)
    if (!devicePath) {
      this.log('warn', `No device path for monitor ${monitorId}`)
      return
    }

    const vcpCode = parseInt(inputValue, 16)
    if (isNaN(vcpCode) || vcpCode < 0 || vcpCode > 255) {
      this.log('error', `Invalid input value: ${inputValue}`)
      return
    }

    const monitor = this.cachedMonitors.find((m) => m.monitor_id === monitorId)
    const inputName = this.getInputName(inputValue)
    this.log('info', `Monitor ${monitor?.name || `#${monitorId}`}: input ${inputName}`)

    this.worker.postMessage({ type: 'setInputSource', devicePath, vcpCode })

    // Optimistic cache update
    if (monitor) {
      monitor.input_source = inputValue.toLowerCase()
      this.notifyStateChanged()
    }
  }

  getInputName(inputHex: string): string {
    return INPUT_NAME_MAP[inputHex] || inputHex
  }

  getDevicePath(monitorId: number): string | null {
    return this.devicePaths.get(monitorId) ?? null
  }

  async setPrimaryMonitor(monitorId: number, multiMonitorToolPath: string): Promise<void> {
    if (!this.available || !this.running || !this.worker) return

    const monitor = this.cachedMonitors.find((m) => m.monitor_id === monitorId)
    this.log('info', `Setting primary monitor: ${monitor?.name || `#${monitorId}`}`)

    const id = this.nextId++
    await new Promise<DdcMonitor[]>((resolve, reject) => {
      this.pendingCallbacks.set(id, { resolve, reject })
      this.worker!.postMessage({ type: 'setPrimary', id, monitorId, multiMonitorToolPath })
    })
  }
}
