import type { DdcMonitor } from '../../../shared/types'

let ddcci: any = null
try {
  // eslint-disable-next-line import/no-unresolved
  ddcci = require('@hensm/ddcci')
} catch {
  // @hensm/ddcci not available (not installed or platform-specific)
}

export class DdcService {
  private devicePaths = new Map<number, string>() // monitorId → device path
  private available = ddcci !== null
  private running = false
  private logEmitter: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null

  setLogEmitter(emitter: (level: 'info' | 'warn' | 'error', msg: string) => void): void {
    this.logEmitter = emitter
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logEmitter) {
      this.logEmitter(level, message)
    }
  }

  isAvailable(): boolean {
    return this.available && this.running
  }

  start(): void {
    if (!this.available) {
      this.log('warn', '@hensm/ddcci module not available — DDC control disabled')
      return
    }
    this.running = true
    this.log('info', 'DDC display control service started')
  }

  stop(): void {
    this.running = false
    this.log('info', 'DDC display control service stopped')
  }

  async listMonitors(): Promise<DdcMonitor[]> {
    if (!this.available || !this.running) return []

    let devicePaths: string[]
    try {
      devicePaths = ddcci.getMonitorList()
    } catch (err) {
      this.log('error', `Failed to enumerate monitors: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }

    if (!Array.isArray(devicePaths) || devicePaths.length === 0) {
      this.log('info', 'No DDC-capable monitors found')
      return []
    }

    const monitors: DdcMonitor[] = []
    this.devicePaths.clear()

    for (let i = 0; i < devicePaths.length; i++) {
      const devicePath = devicePaths[i]
      const monitorId = i + 1

      // Store device path for later use in setBrightness
      this.devicePaths.set(monitorId, devicePath)

      // Extract a friendly name from the device path
      // Format: \\?\DISPLAY#MODEL#...#{GUID}
      const parts = devicePath.split('#')
      const modelName = parts.length > 1 ? parts[1] : `Monitor ${monitorId}`

      const monitor: DdcMonitor = {
        monitor_id: monitorId,
        name: modelName,
        brightness: 0,
        contrast: 0,
        supports: [],
      }

      // Read brightness
      try {
        const brt = ddcci.getBrightness(devicePath)
        if (typeof brt === 'number') {
          monitor.brightness = Math.max(0, Math.min(100, Math.round(brt)))
          monitor.supports.push('brightness')
        }
      } catch {
        // brightness not supported or read failed
      }

      // Read contrast
      try {
        const con = ddcci.getContrast(devicePath)
        if (typeof con === 'number') {
          monitor.contrast = Math.max(0, Math.min(100, Math.round(con)))
          monitor.supports.push('contrast')
        }
      } catch {
        // contrast not supported or read failed
      }

      monitors.push(monitor)
    }

    if (monitors.length > 0) {
      this.log('info', `Enumerated ${monitors.length} DDC-capable monitor(s)`)
    }

    return monitors
  }

  setBrightness(monitorId: number, value: number): void {
    if (!this.available || !this.running) return

    const devicePath = this.devicePaths.get(monitorId)
    if (!devicePath) {
      this.log('warn', `No device path found for monitor ${monitorId}`)
      return
    }

    try {
      const normalizedValue = Math.max(0, Math.min(100, Math.round(value)))
      ddcci.setBrightness(devicePath, normalizedValue)
    } catch (err) {
      this.log('error', `Failed to set brightness: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  getDevicePath(monitorId: number): string | null {
    return this.devicePaths.get(monitorId) ?? null
  }
}
