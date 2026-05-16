import type { DdcMonitor } from '../../../../shared/types'

let ddcci: any = null
try {
  // eslint-disable-next-line import/no-unresolved
  ddcci = require('@hensm/ddcci')
} catch {
  // @hensm/ddcci not available (not installed or platform-specific)
}

// Common input source hex codes to friendly names
const INPUT_NAME_MAP: Record<string, string> = {
  '0x01': 'VGA 1',
  '0x02': 'VGA 2',
  '0x03': 'DVI 1',
  '0x04': 'DVI 2',
  '0x0F': 'DisplayPort 1',
  '0x10': 'DisplayPort 2',
  '0x11': 'HDMI 1',
  '0x12': 'HDMI 2',
  '0x1B': 'USB-C',
}

export class DdcService {
  private devicePaths = new Map<number, string>() // monitorId → device path
  private cachedMonitors: DdcMonitor[] = []
  private cacheTimestamp = 0
  private available = ddcci !== null
  private running = false
  private logEmitter: ((level: 'info' | 'warn' | 'error', msg: string) => void) | null = null
  private stateChangedCallback: ((monitors: DdcMonitor[]) => void) | null = null

  setLogEmitter(emitter: (level: 'info' | 'warn' | 'error', msg: string) => void): void {
    this.logEmitter = emitter
  }

  setStateChangedCallback(callback: (monitors: DdcMonitor[]) => void): void {
    this.stateChangedCallback = callback
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logEmitter) {
      this.logEmitter(level, message)
    }
  }

  private notifyStateChanged(): void {
    if (this.stateChangedCallback) {
      this.stateChangedCallback(this.cachedMonitors)
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

  getCachedMonitors(): DdcMonitor[] {
    return this.cachedMonitors
  }

  async refreshMonitors(): Promise<DdcMonitor[]> {
    if (!this.available || !this.running) return []

    let devicePaths: string[]
    try {
      devicePaths = ddcci.getMonitorList()
    } catch (err) {
      this.log('error', `Failed to enumerate monitors: ${err instanceof Error ? err.message : String(err)}`)
      return this.cachedMonitors
    }

    if (!Array.isArray(devicePaths) || devicePaths.length === 0) {
      this.log('info', 'No DDC-capable monitors found')
      this.cachedMonitors = []
      this.cacheTimestamp = Date.now()
      return []
    }

    const monitors: DdcMonitor[] = []
    this.devicePaths.clear()

    for (let i = 0; i < devicePaths.length; i++) {
      const devicePath = devicePaths[i]
      const monitorId = i + 1

      this.devicePaths.set(monitorId, devicePath)

      const parts = devicePath.split('#')
      const modelName = parts.length > 1 ? parts[1] : `Monitor ${monitorId}`

      const monitor: DdcMonitor = {
        monitor_id: monitorId,
        name: modelName,
        brightness: 0,
        contrast: 0,
        input_source: '',
        available_inputs: [],
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

      // Read input source (VCP code 0x60)
      try {
        const inputData = ddcci._getVCP(devicePath, 0x60)
        if (Array.isArray(inputData) && inputData.length >= 1) {
          const currentInput = inputData[0]
          const inputHex = '0x' + currentInput.toString(16).padStart(2, '0')
          monitor.input_source = inputHex
          monitor.supports.push('input_source')

          // Try to discover available inputs from the monitor's capabilities
          try {
            // For now, we'll just list common inputs that might be available
            // A more sophisticated approach would query the monitor's capabilities
            monitor.available_inputs = ['0x01', '0x03', '0x0F', '0x11', '0x12'].filter(
              (inp) => INPUT_NAME_MAP[inp]
            )
          } catch {
            // If we can't discover inputs, at least include the current one
            monitor.available_inputs = [inputHex]
          }
        }
      } catch {
        // input not supported or read failed
      }

      monitors.push(monitor)
    }

    if (monitors.length > 0) {
      this.log('info', `Enumerated ${monitors.length} DDC-capable monitor(s)`)
    }

    this.cachedMonitors = monitors
    this.cacheTimestamp = Date.now()
    this.notifyStateChanged()

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

      const monitor = this.cachedMonitors.find((m) => m.monitor_id === monitorId)
      if (monitor) {
        monitor.brightness = normalizedValue
        this.notifyStateChanged()
      }
    } catch (err) {
      this.log('error', `Failed to set brightness: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  setInputSource(monitorId: number, inputValue: string): void {
    if (!this.available || !this.running) return

    const devicePath = this.devicePaths.get(monitorId)
    if (!devicePath) {
      this.log('warn', `No device path found for monitor ${monitorId}`)
      return
    }

    try {
      // Parse hex string (e.g., "0x11" -> 17)
      const inputCode = parseInt(inputValue, 16)
      if (isNaN(inputCode)) {
        this.log('error', `Invalid input value: ${inputValue}`)
        return
      }

      ddcci._setVCP(devicePath, 0x60, inputCode)

      const monitor = this.cachedMonitors.find((m) => m.monitor_id === monitorId)
      if (monitor) {
        monitor.input_source = inputValue
        this.notifyStateChanged()
      }
    } catch (err) {
      this.log('error', `Failed to set input source: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  getInputName(inputHex: string): string {
    return INPUT_NAME_MAP[inputHex] || inputHex
  }

  getDevicePath(monitorId: number): string | null {
    return this.devicePaths.get(monitorId) ?? null
  }
}
