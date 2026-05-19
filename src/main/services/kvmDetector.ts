import { execFile } from 'child_process'
import type { AppSettings, KvmState, MonitorInputAction, UsbDevice } from '../../shared/types'

const POLL_INTERVAL_MS = 2000

export class KvmDetector {
  private pollTimer: NodeJS.Timeout | null = null
  private lastConnected: boolean | null = null
  private settings: AppSettings

  constructor(
    private readonly onStateChange: (state: KvmState) => void,
    private readonly onSwitchInputs: (actions: MonitorInputAction[]) => void,
  ) {
    this.settings = {} as AppSettings
  }

  start(settings: AppSettings): void {
    this.settings = settings
    this.schedulePoll()
  }

  stop(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  applySettings(settings: AppSettings): void {
    const wasEnabled = this.settings.kvmEnabled
    const prevDevice = this.settings.kvmDeviceInstanceId
    this.settings = settings

    if (!settings.kvmEnabled) {
      this.stop()
      // Reset tracked state so next enable triggers a fresh check
      this.lastConnected = null
      return
    }

    // Device changed — reset state so the new device triggers a transition event
    if (prevDevice !== settings.kvmDeviceInstanceId) {
      this.lastConnected = null
    }

    if (!wasEnabled && settings.kvmEnabled) {
      this.schedulePoll()
    }
  }

  getState(): KvmState {
    return {
      connected: this.lastConnected ?? false,
      deviceInstanceId: this.settings.kvmDeviceInstanceId ?? '',
    }
  }

  async listDevices(): Promise<UsbDevice[]> {
    return this.queryDevices()
  }

  private schedulePoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    // Run immediately, then on interval
    this.poll().catch(console.error)
  }

  private reschedule(): void {
    if (!this.settings.kvmEnabled) return
    this.pollTimer = setTimeout(() => {
      this.poll().catch(console.error)
    }, POLL_INTERVAL_MS)
  }

  private async poll(): Promise<void> {
    const deviceId = this.settings.kvmDeviceInstanceId
    if (!this.settings.kvmEnabled || !deviceId) {
      this.reschedule()
      return
    }

    try {
      const present = await this.isPresent(deviceId)
      if (present !== this.lastConnected) {
        this.lastConnected = present
        const state: KvmState = { connected: present, deviceInstanceId: deviceId }
        this.onStateChange(state)
        const actions = present
          ? (this.settings.kvmConnectedActions ?? [])
          : (this.settings.kvmDisconnectedActions ?? [])
        if (actions.length > 0) {
          this.onSwitchInputs(actions)
        }
      }
    } catch {
      // Swallow errors — device may be temporarily unavailable
    }

    this.reschedule()
  }

  private async isPresent(instanceId: string): Promise<boolean> {
    const devices = await this.queryDevices()
    const needle = instanceId.toLowerCase()
    return devices.some((d) => d.instanceId.toLowerCase() === needle)
  }

  private queryDevices(): Promise<UsbDevice[]> {
    return new Promise((resolve) => {
      const ps =
        "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq 'USB' -or $_.Class -eq 'HIDClass' -or $_.Class -eq 'Keyboard' -or $_.Class -eq 'Mouse' } | Select-Object FriendlyName, InstanceId | ConvertTo-Json -Compress"
      execFile(
        'powershell.exe',
        ['-NonInteractive', '-NoProfile', '-Command', ps],
        { timeout: 8000 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            resolve([])
            return
          }
          try {
            const raw = JSON.parse(stdout.trim())
            const items: Array<{ FriendlyName: string | null; InstanceId: string }> = Array.isArray(
              raw,
            )
              ? raw
              : [raw]
            const devices: UsbDevice[] = items
              .filter((d) => d.InstanceId)
              .map((d) => ({
                instanceId: d.InstanceId,
                friendlyName: d.FriendlyName ?? d.InstanceId,
              }))
              .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))
            resolve(devices)
          } catch {
            resolve([])
          }
        },
      )
    })
  }
}
