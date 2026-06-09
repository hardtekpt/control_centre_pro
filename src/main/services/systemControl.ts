import { exec } from 'child_process'

// Windows virtual key codes for media control
const VK_MEDIA_NEXT_TRACK = 0xb0
const VK_MEDIA_PREV_TRACK = 0xb1
const VK_MEDIA_PLAY_PAUSE = 0xb3

// P/Invoke stubs compiled once per PowerShell process
const WIN_API_TYPE = `Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public class WinApi {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, int lParam);
}
'@
`

/** Run a PowerShell script via -EncodedCommand (avoids all quoting issues). Fire-and-forget. */
function runPs(script: string): void {
  const full = WIN_API_TYPE + script
  const encoded = Buffer.from(full, 'utf16le').toString('base64')
  exec(`powershell -NoProfile -EncodedCommand ${encoded}`, () => { /* fire and forget */ })
}

function mediaKey(vk: number): void {
  // Press + release
  runPs(`[WinApi]::keybd_event(${vk}, 0, 0, 0); [WinApi]::keybd_event(${vk}, 0, 2, 0)`)
}

export const systemControl = {
  powerOff(): void {
    exec('shutdown /s /t 0')
  },

  sleep(): void {
    // SetSuspendState(hibernate=0, forceCritical=1, disableWakeEvent=0)
    exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')
  },

  lock(): void {
    exec('rundll32.exe user32.dll,LockWorkStation')
  },

  monitorsOff(): void {
    // WM_SYSCOMMAND (0x0112) / SC_MONITORPOWER (0xF170) / lParam 2 = off
    runPs(`[WinApi]::PostMessage([IntPtr]::new(-1), 0x0112, [IntPtr]::new(0xF170), 2)`)
  },

  mediaPlayPause(): void {
    mediaKey(VK_MEDIA_PLAY_PAUSE)
  },

  mediaNext(): void {
    mediaKey(VK_MEDIA_NEXT_TRACK)
  },

  mediaPrev(): void {
    mediaKey(VK_MEDIA_PREV_TRACK)
  },
}

export type SystemControl = typeof systemControl
