import { spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { DdcMonitor } from '../../../../shared/types'

let ddcci: any = null
try {
  // eslint-disable-next-line import/no-unresolved
  ddcci = require('@hensm/ddcci')
} catch {
  // @hensm/ddcci not available (not installed or platform-specific)
}

// Uses QueryDisplayConfig (works in non-interactive sessions) to map DDC device paths
// to their GDI device name, then checks Screen.PrimaryScreen to set is_primary.
const QUERY_DISPLAY_CONFIG_PS = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class DC {
    const uint QDC_ONLY_ACTIVE_PATHS = 2;
    [StructLayout(LayoutKind.Sequential)]
    struct LUID { public uint Low; public int High; }
    [StructLayout(LayoutKind.Sequential)]
    struct PATH_SOURCE { public LUID adapterId; public uint id; public uint modeInfoIdx; public uint statusFlags; }
    [StructLayout(LayoutKind.Sequential)]
    struct PATH_TARGET {
        public LUID adapterId; public uint id; public uint modeInfoIdx; public uint outputTech;
        public uint rotation; public uint scaling; public uint refreshNum; public uint refreshDen;
        public uint scanLine; public int targetAvailable; public uint statusFlags;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct PATH_INFO { public PATH_SOURCE sourceInfo; public PATH_TARGET targetInfo; public uint flags; }
    [StructLayout(LayoutKind.Explicit, Size=64)]
    struct MODE_INFO { }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct TARGET_NAME {
        public uint type; public uint size; public LUID adapterId; public uint id;
        public uint nameFlags; public uint outputTech; public ushort edidMfgId; public ushort edidProdId;
        public uint connectorInstance;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=64)]  public string friendlyName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string devicePath;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct SOURCE_NAME {
        public uint type; public uint size; public LUID adapterId; public uint id;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string viewGdiDeviceName;
    }
    [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint flags, out uint np, out uint nm);
    [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint flags, ref uint np, [In,Out] PATH_INFO[] paths, ref uint nm, [In,Out] MODE_INFO[] modes, IntPtr tid);
    [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetTargetName(ref TARGET_NAME req);
    [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetSourceName(ref SOURCE_NAME req);
    public struct Entry { public string DevicePath; public string GdiDeviceName; }
    public static Entry[] GetMonitorMap() {
        uint np, nm;
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out np, out nm);
        var paths = new PATH_INFO[np]; var modes = new MODE_INFO[nm];
        QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref np, paths, ref nm, modes, IntPtr.Zero);
        var result = new List<Entry>();
        for (uint i = 0; i < np; i++) {
            var tgt = new TARGET_NAME { type=2, adapterId=paths[i].targetInfo.adapterId, id=paths[i].targetInfo.id };
            tgt.size = (uint)Marshal.SizeOf(tgt); GetTargetName(ref tgt);
            var src = new SOURCE_NAME { type=1, adapterId=paths[i].sourceInfo.adapterId, id=paths[i].sourceInfo.id };
            src.size = (uint)Marshal.SizeOf(src); GetSourceName(ref src);
            result.Add(new Entry { DevicePath=tgt.devicePath, GdiDeviceName=src.viewGdiDeviceName });
        }
        return result.ToArray();
    }
}
'@
Add-Type -AssemblyName System.Windows.Forms
$primary = ([System.Windows.Forms.Screen]::PrimaryScreen).DeviceName
$out = @()
foreach ($m in [DC]::GetMonitorMap()) {
    $out += [PSCustomObject]@{ DevicePath=$m.DevicePath; IsPrimary=($m.GdiDeviceName -eq $primary) }
}
$out | ConvertTo-Json -Compress
`

function normPath(p: string): string {
  return p.toLowerCase().replace(/\\/g, '').replace(/\?/g, '')
}

function queryPrimaryDevicePath(): string | null {
  const tmpFile = join(tmpdir(), `ddc-primary-${process.pid}.ps1`)
  try {
    writeFileSync(tmpFile, '﻿' + QUERY_DISPLAY_CONFIG_PS, 'utf8')
    const res = spawnSync('powershell', ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], {
      encoding: 'utf8',
      timeout: 10000,
    })
    if (!res.stdout?.trim()) return null
    const rows = JSON.parse(res.stdout.trim())
    const entries: Array<{ DevicePath: string; IsPrimary: boolean }> = Array.isArray(rows) ? rows : [rows]
    const primary = entries.find((e) => e.IsPrimary)
    return primary?.DevicePath ?? null
  } catch {
    return null
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      // ignore
    }
  }
}

// Enhanced query that returns both DDC path and GDI device name
const QUERY_DISPLAY_WITH_GDI_PS = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class DC {
    const uint QDC_ONLY_ACTIVE_PATHS = 2;
    [StructLayout(LayoutKind.Sequential)]
    struct LUID { public uint Low; public int High; }
    [StructLayout(LayoutKind.Sequential)]
    struct PATH_SOURCE { public LUID adapterId; public uint id; public uint modeInfoIdx; public uint statusFlags; }
    [StructLayout(LayoutKind.Sequential)]
    struct PATH_TARGET {
        public LUID adapterId; public uint id; public uint modeInfoIdx; public uint outputTech;
        public uint rotation; public uint scaling; public uint refreshNum; public uint refreshDen;
        public uint scanLine; public int targetAvailable; public uint statusFlags;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct PATH_INFO { public PATH_SOURCE sourceInfo; public PATH_TARGET targetInfo; public uint flags; }
    [StructLayout(LayoutKind.Explicit, Size=64)]
    struct MODE_INFO { }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct TARGET_NAME {
        public uint type; public uint size; public LUID adapterId; public uint id;
        public uint nameFlags; public uint outputTech; public ushort edidMfgId; public ushort edidProdId;
        public uint connectorInstance;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=64)]  public string friendlyName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string devicePath;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct SOURCE_NAME {
        public uint type; public uint size; public LUID adapterId; public uint id;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string viewGdiDeviceName;
    }
    [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint flags, out uint np, out uint nm);
    [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint flags, ref uint np, [In,Out] PATH_INFO[] paths, ref uint nm, [In,Out] MODE_INFO[] modes, IntPtr tid);
    [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetTargetName(ref TARGET_NAME req);
    [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetSourceName(ref SOURCE_NAME req);
    public struct Entry { public string DevicePath; public string GdiDeviceName; }
    public static Entry[] GetMonitorMap() {
        uint np, nm;
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out np, out nm);
        var paths = new PATH_INFO[np]; var modes = new MODE_INFO[nm];
        QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref np, paths, ref nm, modes, IntPtr.Zero);
        var result = new List<Entry>();
        for (uint i = 0; i < np; i++) {
            var tgt = new TARGET_NAME { type=2, adapterId=paths[i].targetInfo.adapterId, id=paths[i].targetInfo.id };
            tgt.size = (uint)Marshal.SizeOf(tgt); GetTargetName(ref tgt);
            var src = new SOURCE_NAME { type=1, adapterId=paths[i].sourceInfo.adapterId, id=paths[i].sourceInfo.id };
            src.size = (uint)Marshal.SizeOf(src); GetSourceName(ref src);
            result.Add(new Entry { DevicePath=tgt.devicePath, GdiDeviceName=src.viewGdiDeviceName });
        }
        return result.ToArray();
    }
}
'@
$out = @()
foreach ($m in [DC]::GetMonitorMap()) {
    $out += [PSCustomObject]@{ DevicePath=$m.DevicePath; GdiDeviceName=$m.GdiDeviceName }
}
$out | ConvertTo-Json -Compress
`

function queryDeviceMap(): Map<string, string> {
  const tmpFile = join(tmpdir(), `ddc-device-map-${process.pid}.ps1`)
  const map = new Map<string, string>() // normalized DDC path → GDI device name
  try {
    writeFileSync(tmpFile, '﻿' + QUERY_DISPLAY_WITH_GDI_PS, 'utf8')
    const res = spawnSync('powershell', ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], {
      encoding: 'utf8',
      timeout: 10000,
    })
    if (!res.stdout?.trim()) return map
    const rows = JSON.parse(res.stdout.trim())
    const entries: Array<{ DevicePath: string; GdiDeviceName: string }> = Array.isArray(rows) ? rows : [rows]

    for (const entry of entries) {
      if (entry.DevicePath && entry.GdiDeviceName) {
        map.set(normPath(entry.DevicePath), entry.GdiDeviceName)
      }
    }
  } catch {
    // ignore
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      // ignore
    }
  }
  return map
}

// Common input source hex codes to friendly names (keys are lowercase)
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

export class DdcService {
  private devicePaths = new Map<number, string>() // monitorId → device path
  private gdiDeviceNames = new Map<number, string>() // monitorId → GDI device name (e.g., \\.\DISPLAY1)
  private gdiDeviceNamesByPath = new Map<string, string>() // normalized device path → GDI device name (persistent cache)
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

    const primaryRaw = queryPrimaryDevicePath()
    const primaryNorm = primaryRaw ? normPath(primaryRaw) : null
    const gdiMap = queryDeviceMap()

    // Sort devicePaths by GDI device name number (DISPLAY1, DISPLAY2, etc.)
    // so monitor IDs match the Windows device numbers
    devicePaths.sort((a, b) => {
      const gdiA = gdiMap.get(normPath(a)) || ''
      const gdiB = gdiMap.get(normPath(b)) || ''
      const numA = parseInt(gdiA.replace(/\D/g, '')) || 999
      const numB = parseInt(gdiB.replace(/\D/g, '')) || 999
      return numA - numB
    })

    const monitors: DdcMonitor[] = []
    const newDevicePaths = new Map<number, string>()
    const newGdiDeviceNames = new Map<number, string>()

    for (let i = 0; i < devicePaths.length; i++) {
      const devicePath = devicePaths[i]
      const normDevicePath = normPath(devicePath)
      const monitorId = i + 1

      newDevicePaths.set(monitorId, devicePath)

      // Try current query first, then fall back to persistent path-based cache
      let gdiName = gdiMap.get(normDevicePath)
      if (!gdiName) {
        gdiName = this.gdiDeviceNamesByPath.get(normDevicePath)
      }

      if (gdiName) {
        newGdiDeviceNames.set(monitorId, gdiName)
        this.gdiDeviceNamesByPath.set(normDevicePath, gdiName) // Update persistent cache
      }

      const parts = devicePath.split('#')
      const modelName = parts.length > 1 ? parts[1] : `Monitor ${monitorId}`

      const monitor: DdcMonitor = {
        monitor_id: monitorId,
        name: modelName,
        is_primary: primaryNorm !== null && normPath(devicePath) === primaryNorm,
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
          const inputHex = '0x' + currentInput.toString(16).padStart(2, '0').toLowerCase()
          monitor.input_source = inputHex
          monitor.supports.push('input_source')

          // List common inputs, always including the current one
          const commonInputs = ['0x01', '0x02', '0x03', '0x04', '0x0f', '0x10', '0x11', '0x12', '0x1b']
          monitor.available_inputs = Array.from(new Set([
            inputHex, // Always include the current input
            ...commonInputs.filter((inp) => INPUT_NAME_MAP[inp.toLowerCase()])
          ])).sort()
        }
      } catch (err) {
        // input not supported or read failed - but don't fail the whole refresh
        this.log('warn', `Could not read input for monitor ${monitorId}: ${err instanceof Error ? err.message : String(err)}`)
      }

      monitors.push(monitor)
    }

    // Update cached maps
    this.devicePaths = newDevicePaths
    this.gdiDeviceNames = newGdiDeviceNames

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
      if (isNaN(inputCode) || inputCode < 0 || inputCode > 255) {
        this.log('error', `Invalid input value: ${inputValue}`)
        return
      }

      ddcci._setVCP(devicePath, 0x60, inputCode)
      this.log('info', `Set monitor ${monitorId} input to ${inputValue}`)

      // Update cached state immediately (optimistic)
      const monitor = this.cachedMonitors.find((m) => m.monitor_id === monitorId)
      if (monitor) {
        monitor.input_source = inputValue.toLowerCase()
        this.notifyStateChanged()
      }
    } catch (err) {
      this.log('error', `Failed to set input source to ${inputValue}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  getInputName(inputHex: string): string {
    return INPUT_NAME_MAP[inputHex] || inputHex
  }

  getDevicePath(monitorId: number): string | null {
    return this.devicePaths.get(monitorId) ?? null
  }

  async setPrimaryMonitor(monitorId: number, _nircmdPath: string): Promise<void> {
    const gdiName = this.gdiDeviceNames.get(monitorId)
    if (!gdiName) {
      throw new Error(`No GDI device name cached for monitor ${monitorId} — refresh first`)
    }

    const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public struct POINTL { public int x; public int y; }
public struct RECTL { public int left; public int top; public int right; public int bottom; }

[StructLayout(LayoutKind.Sequential)]
public struct LUID { public uint Low; public int High; }

[StructLayout(LayoutKind.Sequential)]
public struct DISPLAYCONFIG_PATH_SOURCE_INFO {
    public LUID adapterId;
    public uint id;
    public uint modeInfoIdx;
    public uint statusFlags;
}

[StructLayout(LayoutKind.Sequential)]
public struct DISPLAYCONFIG_PATH_TARGET_INFO {
    public LUID adapterId;
    public uint id;
    public uint modeInfoIdx;
    public uint outputTech;
    public uint rotation;
    public uint scaling;
    public RECTL refreshRate;
    public uint scanLineOrdering;
    public int targetAvailable;
    public uint statusFlags;
}

[StructLayout(LayoutKind.Sequential)]
public struct DISPLAYCONFIG_PATH_INFO {
    public DISPLAYCONFIG_PATH_SOURCE_INFO sourceInfo;
    public DISPLAYCONFIG_PATH_TARGET_INFO targetInfo;
    public uint flags;
}

[StructLayout(LayoutKind.Sequential)]
public struct DISPLAYCONFIG_SOURCE_MODE {
    public uint width;
    public uint height;
    public uint pixelFormat;
    public POINTL position;
}

[StructLayout(LayoutKind.Sequential)]
public struct DISPLAYCONFIG_TARGET_MODE {
    public RECTL targetVideoSignalInfo;
}

[StructLayout(LayoutKind.Explicit)]
public struct DISPLAYCONFIG_MODE_INFO {
    [FieldOffset(0)] public LUID adapterId;
    [FieldOffset(8)] public uint id;
    [FieldOffset(12)] public uint modeInfoType;
    [FieldOffset(16)] public DISPLAYCONFIG_SOURCE_MODE sourceMode;
    [FieldOffset(16)] public DISPLAYCONFIG_TARGET_MODE targetMode;
}

public static class DC {
    const uint QDC_ONLY_ACTIVE_PATHS = 2;
    const uint SDC_APPLY = 0x00000002;

    [DllImport("user32.dll")]
    static extern int GetDisplayConfigBufferSizes(uint flags, out uint pNumPathArrayElements, out uint pNumModeInfoArrayElements);

    [DllImport("user32.dll")]
    static extern int QueryDisplayConfig(uint flags, ref uint pNumPathArrayElements, [In, Out] DISPLAYCONFIG_PATH_INFO[] pPathInfoArray, ref uint pNumModeInfoArrayElements, [In, Out] DISPLAYCONFIG_MODE_INFO[] pModeInfoArray, IntPtr pCurrentTopologyId);

    [DllImport("user32.dll")]
    static extern int SetDisplayConfig(uint uNumPathArrayElements, [In] DISPLAYCONFIG_PATH_INFO[] pPathInfoArray, uint uNumModeInfoArrayElements, [In] DISPLAYCONFIG_MODE_INFO[] pModeInfoArray, uint Flags);

    [DllImport("user32.dll", EntryPoint = "DisplayConfigGetDeviceInfo")]
    static extern int GetSourceName(ref DISPLAYCONFIG_SOURCE_DEVICE_NAME pDeviceName);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DISPLAYCONFIG_SOURCE_DEVICE_NAME {
        [MarshalAs(UnmanagedType.ByValArray, ArraySubType = UnmanagedType.U4, SizeConst = 16)]
        public uint[] header;
        [MarshalAs(UnmanagedType.ByValArray, ArraySubType = UnmanagedType.U1, SizeConst = 32)]
        public byte[] sourceName;
    }

    public static void SetPrimaryDisplay(string targetGdiName) {
        uint pathCount, modeCount;
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount);

        var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
        var modes = new DISPLAYCONFIG_MODE_INFO[modeCount];

        if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero) != 0) {
            throw new Exception("QueryDisplayConfig failed");
        }

        // Find the target display
        int targetPathIdx = -1;
        for (int i = 0; i < pathCount; i++) {
            var sourceName = new DISPLAYCONFIG_SOURCE_DEVICE_NAME();
            sourceName.header = new uint[4];
            sourceName.header[0] = 0;
            sourceName.header[1] = (uint)Marshal.SizeOf(sourceName);
            sourceName.header[2] = 2;  // DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME
            sourceName.header[3] = 0;

            var adapterId = paths[i].sourceInfo.adapterId;
            var sourceId = paths[i].sourceInfo.id;
            var dataCompact = new uint[2];
            dataCompact[0] = adapterId.Low;
            dataCompact[1] = (uint)adapterId.High;
            Array.Copy(BitConverter.GetBytes(dataCompact[0]), 0, sourceName.header, 0, 4);
            Array.Copy(BitConverter.GetBytes(dataCompact[1]), 0, sourceName.header, 4, 4);

            var gdiNameBytes = System.Text.Encoding.Unicode.GetBytes(targetGdiName);
            if (sourceName.sourceName.Length >= gdiNameBytes.Length &&
                new string(System.Text.Encoding.Unicode.GetChars(sourceName.sourceName)).TrimEnd('\\0').Contains(targetGdiName.Replace("\\\\\\\.", ""))) {
                targetPathIdx = i;
                break;
            }
        }

        if (targetPathIdx == -1) {
            throw new Exception("Target display not found");
        }

        // Move target to first position
        var tempPath = paths[targetPathIdx];
        for (int i = targetPathIdx; i > 0; i--) {
            paths[i] = paths[i - 1];
        }
        paths[0] = tempPath;

        // Apply configuration
        int result = SetDisplayConfig(pathCount, paths, modeCount, modes, SDC_APPLY);
        if (result != 0) {
            throw new Exception("SetDisplayConfig failed with code " + result);
        }
    }
}
'@
[DC]::SetPrimaryDisplay("${gdiName}")
Write-Host "Success"
`

    try {
      const tmpFile = join(tmpdir(), `set-primary-${process.pid}.ps1`)
      writeFileSync(tmpFile, '﻿' + psScript, 'utf8')

      const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], {
        encoding: 'utf8',
        timeout: 10000,
      })

      try {
        unlinkSync(tmpFile)
      } catch {
        // ignore
      }

      if (result.error) {
        throw result.error
      }

      if (result.status !== 0 || result.stderr?.includes('Exception')) {
        throw new Error(`Failed: ${result.stderr || result.stdout}`)
      }

      this.log('info', `Set primary monitor to ${monitorId} (${gdiName})`)

      // Re-query to update is_primary flags on all monitors
      await this.refreshMonitors()
    } catch (err) {
      this.log('error', `Failed to set primary monitor: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }
}
