import { spawn, ChildProcess } from 'child_process'

// Persistent PowerShell process to avoid ~300ms startup on every call
let _ps: ChildProcess | null = null
let _buffer = ''
let _pendingResolve: ((v: number) => void) | null = null

const INIT_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class _WinFocus {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
}
'@ -ErrorAction SilentlyContinue
Write-Host "READY"
while ($true) {
  $line = Read-Host
  if ($line -eq "GET") {
    Write-Host ([int64][_WinFocus]::GetForegroundWindow())
  } elseif ($line -match "^SET (\\d+)$") {
    [void][_WinFocus]::AllowSetForegroundWindow(-1)
    [void][_WinFocus]::SetForegroundWindow([IntPtr][int64]$Matches[1])
    Write-Host "OK"
  }
}
`

function getPs(): ChildProcess {
  if (_ps && !_ps.killed) return _ps

  _ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', INIT_SCRIPT], {
    stdio: ['pipe', 'pipe', 'ignore'],
  })

  _ps.stdout?.setEncoding('utf8')
  _ps.stdout?.on('data', (chunk: string) => {
    _buffer += chunk
    const lines = _buffer.split(/\r?\n/)
    _buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'READY' || trimmed === 'OK') continue
      const n = parseInt(trimmed, 10)
      if (!isNaN(n) && _pendingResolve) {
        const resolve = _pendingResolve
        _pendingResolve = null
        resolve(n)
      }
    }
  })

  _ps.on('exit', () => { _ps = null })

  return _ps
}

/** Asynchronously returns the current foreground window handle (0 on failure). */
export function getForegroundWindow(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const ps = getPs()
      _pendingResolve = resolve
      ps.stdin?.write('GET\n')
      setTimeout(() => {
        if (_pendingResolve === resolve) {
          _pendingResolve = null
          resolve(0)
        }
      }, 2000)
    } catch {
      resolve(0)
    }
  })
}

/** Asks the persistent PS process to call SetForegroundWindow(hwnd). Fire-and-forget. */
export function restoreForegroundWindow(hwnd: number): void {
  if (!hwnd) return
  try {
    const ps = getPs()
    ps.stdin?.write(`SET ${hwnd}\n`)
  } catch { /* ignore */ }
}

/** Shut down the persistent PowerShell process on app quit. */
export function destroyFocusHelper(): void {
  if (_ps) {
    _ps.kill()
    _ps = null
  }
}
