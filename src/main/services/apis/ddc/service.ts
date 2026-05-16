import type { DdcMonitor } from '../../../shared/types'

let ddcci: any = null
try {
  // eslint-disable-next-line import/no-unresolved
  ddcci = require('@hensm/ddcci')
} catch {
  // @hensm/ddcci not available (not installed or platform-specific)
}

export class DdcService {
  private preferredKeys = new Map<string, string>()
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

    let raw: any[]
    try {
      raw = ddcci.getAllMonitors('accurate', false, true)
    } catch (err) {
      this.log('error', `Failed to enumerate monitors: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }

    if (!Array.isArray(raw) || raw.length === 0) {
      this.log('info', 'No DDC-capable monitors found')
      return []
    }

    const monitors: DdcMonitor[] = []

    for (let i = 0; i < raw.length; i++) {
      const rawMon = raw[i]
      const monitorName = rawMon.fullName || rawMon.id || `Monitor ${i + 1}`

      // Resolve preferred key (cached or discover)
      let preferredKey = this.preferredKeys.get(monitorName)
      if (!preferredKey) {
        preferredKey = await this.discoverKey(rawMon)
        if (preferredKey) {
          this.preferredKeys.set(monitorName, preferredKey)
        }
      }

      if (!preferredKey) {
        continue // couldn't find a working key for this monitor
      }

      const monitor: DdcMonitor = {
        monitor_id: i + 1,
        name: monitorName,
        brightness: 0,
        contrast: 0,
        supports: [],
      }

      // Read brightness (VCP code 0x10)
      try {
        const brt = ddcci.getVCP(preferredKey, 0x10)
        if (brt && typeof brt.current === 'number') {
          monitor.brightness = Math.max(0, Math.min(100, Math.round((brt.current / (brt.maximum || 100)) * 100)))
          monitor.supports.push('brightness')
        }
      } catch {
        // brightness not supported or read failed
      }

      // Read contrast (VCP code 0x12)
      try {
        const con = ddcci.getVCP(preferredKey, 0x12)
        if (con && typeof con.current === 'number') {
          monitor.contrast = Math.max(0, Math.min(100, Math.round((con.current / (con.maximum || 100)) * 100)))
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

  private async discoverKey(rawMon: any): Promise<string | null> {
    // Build candidate keys from all string values and array elements
    const candidates = new Set<string>()

    for (const val of Object.values(rawMon)) {
      if (typeof val === 'string' && val.trim()) {
        candidates.add(val.trim())
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string' && item.trim()) {
            candidates.add(item.trim())
          }
        }
      }
    }

    // Try each candidate with a VCP read
    for (const key of candidates) {
      try {
        ddcci.getVCP(key, 0x10) // Brightness
        return key
      } catch {
        // This key didn't work, try next
      }
      try {
        ddcci.getVCP(key, 0x12) // Contrast
        return key
      } catch {
        // This key didn't work, try next
      }
    }

    return null
  }

  setBrightness(monitorName: string, value: number): void {
    if (!this.available || !this.running) return

    const preferredKey = this.preferredKeys.get(monitorName)
    if (!preferredKey) {
      this.log('warn', `No preferred key found for monitor: ${monitorName}`)
      return
    }

    try {
      const normalizedValue = Math.max(0, Math.min(100, Math.round(value)))
      ddcci.setVCP(preferredKey, 0x10, normalizedValue)
    } catch (err) {
      this.log('error', `Failed to set brightness: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  getPreferredKey(monitorName: string): string | null {
    return this.preferredKeys.get(monitorName) ?? null
  }
}
