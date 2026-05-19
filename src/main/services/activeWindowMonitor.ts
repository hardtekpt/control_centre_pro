import { ChildProcess, spawn } from 'child_process'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { PresetSwitcherRule } from '../../shared/types'
import type { SonarService } from './sonarService'

/**
 * Monitors the active (foreground) window on Windows and auto-applies Sonar presets
 * based on configured rules. Uses a persistent PowerShell subprocess to detect window changes.
 */
export class ActiveWindowMonitor {
  private subprocess: ChildProcess | null = null
  private currentProcessName = ''
  private activeWindowCenter: { x: number; y: number } | null = null
  private rules: PresetSwitcherRule[] = []
  private autoApplied = new Map<string, string>()
  private manualOverrides = new Set<string>()
  private appliedMonitorRules = new Set<string>()
  private enabled = true
  private applyMonitorInput: ((monitorId: number, inputValue: string) => void) | null = null

  constructor(
    private window: BrowserWindow,
    private sonarService: SonarService,
  ) {}

  setMonitorInputHandler(handler: (monitorId: number, inputValue: string) => void): void {
    this.applyMonitorInput = handler
  }

  start(): void {
    const script = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public struct RECT { public int Left, Top, Right, Bottom; }
public class FW {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int p);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
"@
$last = ""
while ($true) {
  try {
    $h = [FW]::GetForegroundWindow(); $p = 0
    [FW]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
    $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName
    $r = New-Object RECT
    [FW]::GetWindowRect($h, [ref]$r) | Out-Null
    $cx = [int](($r.Left + $r.Right) / 2); $cy = [int](($r.Top + $r.Bottom) / 2)
    $line = "{""n"":""$n"",""x"":$cx,""y"":$cy}"
    if ($n -and $line -ne $last) { $last = $line; Write-Output $line; [Console]::Out.Flush() }
  } catch {}
  Start-Sleep -Milliseconds 500
}
`
    this.subprocess = spawn('powershell', ['-NoProfile', '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const lines: string[] = []
    if (this.subprocess.stdout) {
      this.subprocess.stdout.setEncoding('utf-8')
      this.subprocess.stdout.on('data', (chunk: string) => {
        lines.push(...chunk.split('\n').filter((l) => l.trim()))
        while (lines.length > 0) {
          const line = lines.shift()
          if (line) this.onForegroundChanged(line.trim())
        }
      })
    }

    if (this.subprocess.stderr) {
      this.subprocess.stderr.on('data', (chunk) => {
        console.error('[ActiveWindowMonitor stderr]', chunk.toString())
      })
    }

    this.subprocess.on('error', (err) => {
      console.error('[ActiveWindowMonitor] spawn error:', err)
    })
  }

  stop(): void {
    if (this.subprocess) {
      this.subprocess.kill()
      this.subprocess = null
    }
  }

  setRules(rules: PresetSwitcherRule[]): void {
    this.rules = rules
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Called when renderer calls sonarSelectPreset() to detect if the user
   * manually changed a preset that we auto-applied
   */
  notifyManualPresetChange(presetId: string): void {
    const state = this.sonarService.getState()
    const config = state?.configs?.find((c) => c.id === presetId)
    if (!config) return

    const channel = config.virtualAudioDevice
    const ruleId = this.autoApplied.get(channel)
    if (ruleId) {
      this.manualOverrides.add(ruleId)
    }
  }

  getActiveWindowCenter(): { x: number; y: number } | null {
    return this.activeWindowCenter
  }

  private onForegroundChanged(line: string): void {
    let processName = line
    try {
      const parsed = JSON.parse(line) as { n: string; x: number; y: number }
      processName = parsed.n
      this.activeWindowCenter = { x: parsed.x, y: parsed.y }
    } catch {
      // fallback: treat line as plain process name (no position info)
    }

    if (processName !== this.currentProcessName) {
      this.autoApplied.clear()
      this.manualOverrides.clear()
      this.appliedMonitorRules.clear()
    }

    this.currentProcessName = processName

    this.window.webContents.send(IPC_CHANNELS.ACTIVE_WINDOW_CHANGE, {
      processName,
    })

    if (!this.enabled) return

    for (const rule of this.rules) {
      if (!rule.enabled) continue
      if (rule.appProcessName.toLowerCase() !== processName.toLowerCase()) continue
      if (this.manualOverrides.has(rule.id)) continue

      // Sonar preset action
      if (rule.channel && rule.presetId) {
        if (this.autoApplied.get(rule.channel) !== rule.id) {
          this.autoApplied.set(rule.channel, rule.id)
          this.sonarService.selectPreset(rule.presetId).catch((err) => {
            console.error('[ActiveWindowMonitor] selectPreset failed:', err)
          })
        }
      }

      // Monitor input actions (one-shot per rule per app focus)
      if (rule.monitorActions?.length && !this.appliedMonitorRules.has(rule.id)) {
        this.appliedMonitorRules.add(rule.id)
        for (const action of rule.monitorActions) {
          this.applyMonitorInput?.(action.monitorId, action.inputValue)
        }
      }
    }
  }
}
