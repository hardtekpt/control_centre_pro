import { execFile } from 'child_process'
import type { AppSettings, KvmState, MonitorInputAction, UsbDevice } from '../../shared/types'

const POLL_INTERVAL_MS = 2000
const IDENTIFY_POLL_MS = 350
const IDENTIFY_TIMEOUT_MS = 30_000

export class KvmDetector {
  private pollTimer: NodeJS.Timeout | null = null
  private lastConnected: boolean | null = null
  private settings: AppSettings

  private identifyTimer: NodeJS.Timeout | null = null
  private identifyTimeout: NodeJS.Timeout | null = null
  private identifySnapshot: UsbDevice[] = []
  private identifyCallback: ((device: UsbDevice | null) => void) | null = null

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
      this.lastConnected = null
      return
    }

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

  // ── Identify flow ───────────────────────────────────────────────────────────

  async startIdentify(onResult: (device: UsbDevice | null) => void): Promise<void> {
    this.cancelIdentify()
    this.identifyCallback = onResult
    this.identifySnapshot = await this.queryDevices()

    // Auto-cancel after timeout
    this.identifyTimeout = setTimeout(() => {
      this.cancelIdentify()
    }, IDENTIFY_TIMEOUT_MS)

    this.scheduleIdentifyPoll()
  }

  cancelIdentify(): void {
    if (this.identifyTimer) { clearTimeout(this.identifyTimer); this.identifyTimer = null }
    if (this.identifyTimeout) { clearTimeout(this.identifyTimeout); this.identifyTimeout = null }
    if (this.identifyCallback) {
      const cb = this.identifyCallback
      this.identifyCallback = null
      cb(null)
    }
    this.identifySnapshot = []
  }

  private scheduleIdentifyPoll(): void {
    this.identifyTimer = setTimeout(() => { this.identifyPoll().catch(console.error) }, IDENTIFY_POLL_MS)
  }

  private async identifyPoll(): Promise<void> {
    if (!this.identifyCallback) return

    const current = await this.queryDevices()
    const currentIds = new Set(current.map((d) => d.instanceId.toLowerCase()))
    const disappeared = this.identifySnapshot.find(
      (d) => !currentIds.has(d.instanceId.toLowerCase()),
    )

    if (disappeared) {
      if (this.identifyTimeout) { clearTimeout(this.identifyTimeout); this.identifyTimeout = null }
      const cb = this.identifyCallback
      this.identifyCallback = null
      this.identifySnapshot = []
      cb(disappeared)
      return
    }

    this.scheduleIdentifyPoll()
  }

  // ── Connection polling ──────────────────────────────────────────────────────

  private schedulePoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.poll().catch(console.error)
  }

  private reschedule(): void {
    if (!this.settings.kvmEnabled) return
    this.pollTimer = setTimeout(() => { this.poll().catch(console.error) }, POLL_INTERVAL_MS)
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
        if (actions.length > 0) this.onSwitchInputs(actions)
      }
    } catch {
      // Swallow — device may be temporarily unavailable
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
          if (err || !stdout.trim()) { resolve([]); return }
          try {
            const raw = JSON.parse(stdout.trim())
            const items: Array<{ FriendlyName: string | null; InstanceId: string }> = Array.isArray(raw) ? raw : [raw]
            resolve(
              items
                .filter((d) => d.InstanceId)
                .map((d) => ({ instanceId: d.InstanceId, friendlyName: d.FriendlyName ?? d.InstanceId }))
                .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName)),
            )
          } catch {
            resolve([])
          }
        },
      )
    })
  }
}
