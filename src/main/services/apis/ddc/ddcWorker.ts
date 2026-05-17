import { parentPort } from 'worker_threads'
import { spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { DdcMonitor } from '../../../../shared/types'

let ddcci: any = null
try {
  // eslint-disable-next-line import/no-unresolved
  ddcci = require('@hensm/ddcci')
} catch {}

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

function normPath(p: string): string {
  return p.toLowerCase().replace(/\\/g, '').replace(/\?/g, '')
}

function runPs(script: string): string | null {
  const tmpFile = join(tmpdir(), `ddc-worker-${process.pid}-${Date.now()}.ps1`)
  try {
    writeFileSync(tmpFile, '﻿' + script, 'utf8')
    const res = spawnSync('powershell', ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], {
      encoding: 'utf8',
      timeout: 10000,
    })
    return res.stdout?.trim() || null
  } catch {
    return null
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

function queryPrimaryNorm(): string | null {
  const out = runPs(QUERY_DISPLAY_CONFIG_PS)
  if (!out) return null
  try {
    const rows = JSON.parse(out)
    const entries: Array<{ DevicePath: string; IsPrimary: boolean }> = Array.isArray(rows) ? rows : [rows]
    const primary = entries.find((e) => e.IsPrimary)
    return primary ? normPath(primary.DevicePath) : null
  } catch {
    return null
  }
}

function queryDeviceMap(): Map<string, string> {
  const map = new Map<string, string>()
  const out = runPs(QUERY_DISPLAY_WITH_GDI_PS)
  if (!out) return map
  try {
    const rows = JSON.parse(out)
    const entries: Array<{ DevicePath: string; GdiDeviceName: string }> = Array.isArray(rows) ? rows : [rows]
    for (const entry of entries) {
      if (entry.DevicePath && entry.GdiDeviceName) {
        map.set(normPath(entry.DevicePath), entry.GdiDeviceName)
      }
    }
  } catch {}
  return map
}

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

// Persistent cache of normalized DDC path → GDI device name, survives across refreshes
const gdiDeviceNamesByPath = new Map<string, string>()

function log(level: 'info' | 'warn' | 'error', message: string): void {
  parentPort?.postMessage({ type: 'log', level, message })
}

interface RefreshResult {
  monitors: DdcMonitor[]
  devicePaths: Array<[number, string]>
}

function doRefresh(): RefreshResult {
  if (!ddcci) return { monitors: [], devicePaths: [] }

  let rawPaths: string[]
  try {
    rawPaths = ddcci.getMonitorList()
  } catch (err) {
    log('error', `Failed to enumerate monitors: ${err instanceof Error ? err.message : String(err)}`)
    return { monitors: [], devicePaths: [] }
  }

  if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
    log('info', 'No DDC-capable monitors found')
    return { monitors: [], devicePaths: [] }
  }

  const primaryNorm = queryPrimaryNorm()
  const gdiMap = queryDeviceMap()

  // Sort by GDI device number so IDs match Windows display numbers
  rawPaths.sort((a, b) => {
    const gdiA = gdiMap.get(normPath(a)) || ''
    const gdiB = gdiMap.get(normPath(b)) || ''
    const numA = parseInt(gdiA.replace(/\D/g, '')) || 999
    const numB = parseInt(gdiB.replace(/\D/g, '')) || 999
    return numA - numB
  })

  const monitors: DdcMonitor[] = []
  const devicePaths: Array<[number, string]> = []

  for (let i = 0; i < rawPaths.length; i++) {
    const devicePath = rawPaths[i]
    const normDevicePath = normPath(devicePath)
    const monitorId = i + 1

    devicePaths.push([monitorId, devicePath])

    let gdiName = gdiMap.get(normDevicePath)
    if (!gdiName) gdiName = gdiDeviceNamesByPath.get(normDevicePath)
    if (gdiName) gdiDeviceNamesByPath.set(normDevicePath, gdiName)

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

    try {
      const brt = ddcci.getBrightness(devicePath)
      if (typeof brt === 'number') {
        monitor.brightness = Math.max(0, Math.min(100, Math.round(brt)))
        monitor.supports.push('brightness')
      }
    } catch {}

    try {
      const con = ddcci.getContrast(devicePath)
      if (typeof con === 'number') {
        monitor.contrast = Math.max(0, Math.min(100, Math.round(con)))
        monitor.supports.push('contrast')
      }
    } catch {}

    try {
      const inputData = ddcci._getVCP(devicePath, 0x60)
      if (Array.isArray(inputData) && inputData.length >= 1) {
        const inputHex = '0x' + inputData[0].toString(16).padStart(2, '0').toLowerCase()
        monitor.input_source = inputHex
        monitor.supports.push('input_source')
        const commonInputs = ['0x01', '0x02', '0x03', '0x04', '0x0f', '0x10', '0x11', '0x12', '0x1b']
        monitor.available_inputs = Array.from(new Set([inputHex, ...commonInputs.filter((inp) => INPUT_NAME_MAP[inp])])).sort()
      }
    } catch (err) {
      log('warn', `Could not read input for monitor ${monitorId}: ${err instanceof Error ? err.message : String(err)}`)
    }

    monitors.push(monitor)
  }

  if (monitors.length > 0) log('info', `Enumerated ${monitors.length} DDC-capable monitor(s)`)

  return { monitors, devicePaths }
}

type InMsg =
  | { id: number; type: 'refresh' }
  | { type: 'setBrightness'; devicePath: string; value: number }
  | { type: 'setInputSource'; devicePath: string; vcpCode: number }
  | { id: number; type: 'setPrimary'; monitorId: number; multiMonitorToolPath: string }

parentPort?.on('message', (msg: InMsg) => {
  switch (msg.type) {
    case 'refresh': {
      try {
        const result = doRefresh()
        parentPort?.postMessage({ type: 'refreshDone', id: msg.id, ...result })
      } catch (err) {
        parentPort?.postMessage({ type: 'error', id: msg.id, message: String(err) })
      }
      break
    }

    case 'setBrightness': {
      try {
        ddcci?.setBrightness(msg.devicePath, Math.max(0, Math.min(100, Math.round(msg.value))))
      } catch (err) {
        log('error', `setBrightness failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setInputSource': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x60, msg.vcpCode)
        log('info', `Set input source to 0x${msg.vcpCode.toString(16)}`)
      } catch (err) {
        log('error', `setInputSource failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setPrimary': {
      try {
        const res = spawnSync(msg.multiMonitorToolPath, ['/SetPrimary', String(msg.monitorId)], { timeout: 5000 })
        if (res.error) throw res.error
        if (res.status !== 0) throw new Error(`MultiMonitorTool exited with status ${res.status}`)
        log('info', `Set primary monitor to ${msg.monitorId}`)
        const result = doRefresh()
        parentPort?.postMessage({ type: 'setPrimaryDone', id: msg.id, ...result })
      } catch (err) {
        parentPort?.postMessage({ type: 'error', id: msg.id, message: String(err) })
      }
      break
    }
  }
})
