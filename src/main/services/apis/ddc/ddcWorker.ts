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

interface ExtendedValues {
  color_preset: number | null
  red_gain: number | null
  green_gain: number | null
  blue_gain: number | null
  sharpness: number | null
  volume: number | null
  muted: boolean | null
  power_mode: number | null
  usage_time_hours: number | null
  vcp_version: string | null
}

interface ProbedCapabilities {
  color_preset: boolean
  rgb_gain: boolean
  rgb_max: number
  sharpness: boolean
  sharpness_max: number
  volume: boolean
  mute: boolean
  power: boolean
  usage_time: boolean
  vcp_version: boolean
  // Cached extended values — populated during probe, updated on full refresh
  values: ExtendedValues
}

// One-time per-session capability probe results keyed by raw DDC device path
const probedPaths = new Map<string, ProbedCapabilities>()

function formatVcpVersion(raw: number): string {
  return `${(raw >> 8) & 0xff}.${raw & 0xff}`
}

function probeCapabilities(devicePath: string): ProbedCapabilities {
  if (probedPaths.has(devicePath)) return probedPaths.get(devicePath)!

  log('info', `Probing capabilities for ${monitorDisplayName(devicePath)}`)

  const tryRead = (code: number): [number, number] | null => {
    try {
      const v = ddcci._getVCP(devicePath, code)
      if (Array.isArray(v) && v.length >= 2) return [v[0], v[1]]
    } catch {}
    return null
  }

  const colorPreset = tryRead(0x14)
  const red = tryRead(0x16)
  const green = tryRead(0x18)
  const blue = tryRead(0x1a)
  const sharpness = tryRead(0x87)
  const volume = tryRead(0x62)
  const mute = tryRead(0x8d)
  const power = tryRead(0xd6)
  const usageTime = tryRead(0xc6)
  const vcpVersion = tryRead(0xdf)

  const caps: ProbedCapabilities = {
    color_preset: colorPreset !== null,
    rgb_gain: red !== null,
    rgb_max: red ? red[1] || 100 : 100,
    sharpness: sharpness !== null,
    sharpness_max: sharpness ? sharpness[1] || 100 : 100,
    volume: volume !== null,
    mute: mute !== null,
    power: power !== null,
    usage_time: usageTime !== null,
    vcp_version: vcpVersion !== null,
    values: {
      color_preset: colorPreset ? colorPreset[0] : null,
      red_gain: red ? red[0] : null,
      green_gain: green ? green[0] : null,
      blue_gain: blue ? blue[0] : null,
      sharpness: sharpness ? sharpness[0] : null,
      volume: volume ? volume[0] : null,
      muted: mute ? mute[0] === 1 : null,
      power_mode: power ? power[0] : null,
      usage_time_hours: usageTime ? usageTime[0] : null,
      vcp_version: vcpVersion ? formatVcpVersion(vcpVersion[0]) : null,
    },
  }

  probedPaths.set(devicePath, caps)
  return caps
}

function updateExtendedValues(devicePath: string, caps: ProbedCapabilities): void {
  const tryRead = (code: number): number | null => {
    try {
      const v = ddcci._getVCP(devicePath, code)
      if (Array.isArray(v) && v.length >= 1) return v[0]
    } catch {}
    return null
  }

  if (caps.color_preset) caps.values.color_preset = tryRead(0x14)
  if (caps.rgb_gain) {
    caps.values.red_gain = tryRead(0x16)
    caps.values.green_gain = tryRead(0x18)
    caps.values.blue_gain = tryRead(0x1a)
  }
  if (caps.sharpness) caps.values.sharpness = tryRead(0x87)
  if (caps.volume) caps.values.volume = tryRead(0x62)
  if (caps.mute) {
    const v = tryRead(0x8d)
    caps.values.muted = v !== null ? v === 1 : null
  }
  if (caps.power) caps.values.power_mode = tryRead(0xd6)
  if (caps.usage_time) caps.values.usage_time_hours = tryRead(0xc6)
  if (caps.vcp_version) {
    const v = tryRead(0xdf)
    caps.values.vcp_version = v !== null ? formatVcpVersion(v) : null
  }
}

// Persistent cache of normalized DDC path → GDI device name, survives across refreshes
const gdiDeviceNamesByPath = new Map<string, string>()

// Track known monitor paths to detect connect/disconnect events between polls
let prevMonitorPaths: Set<string> | null = null

function monitorDisplayName(devicePath: string): string {
  const parts = devicePath.split('#')
  return parts.length > 1 ? parts[1] : devicePath
}

function log(level: 'info' | 'warn' | 'error', message: string): void {
  parentPort?.postMessage({ type: 'log', level, message })
}

interface RefreshResult {
  monitors: DdcMonitor[]
  devicePaths: Array<[number, string]>
}

function doRefresh(full = false): RefreshResult {
  if (!ddcci) return { monitors: [], devicePaths: [] }

  let rawPaths: string[]
  try {
    rawPaths = ddcci.getMonitorList()
  } catch (err) {
    log('error', `Failed to enumerate monitors: ${err instanceof Error ? err.message : String(err)}`)
    return { monitors: [], devicePaths: [] }
  }

  if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
    if (prevMonitorPaths === null || prevMonitorPaths.size > 0) {
      log('info', 'No DDC-capable monitors found')
    }
    prevMonitorPaths = new Set()
    return { monitors: [], devicePaths: [] }
  }

  // Log connect/disconnect events relative to the previous refresh
  if (prevMonitorPaths !== null) {
    const currentSet = new Set(rawPaths)
    for (const p of currentSet) {
      if (!prevMonitorPaths.has(p)) {
        log('info', `Monitor connected: ${monitorDisplayName(p)}`)
      }
    }
    for (const p of prevMonitorPaths) {
      if (!currentSet.has(p)) {
        log('info', `Monitor disconnected: ${monitorDisplayName(p)}`)
      }
    }
  }
  prevMonitorPaths = new Set(rawPaths)

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
      color_preset: null,
      red_gain: null,
      green_gain: null,
      blue_gain: null,
      rgb_max: 100,
      sharpness: null,
      sharpness_max: 100,
      volume: null,
      muted: null,
      power_mode: null,
      usage_time_hours: null,
      vcp_version: null,
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

    // Extended VCP features — probe once per session, re-read only on full refresh
    const alreadyProbed = probedPaths.has(devicePath)
    const caps = probeCapabilities(devicePath)

    if (full && alreadyProbed) {
      // User explicitly requested refresh — re-read live values into the cache
      updateExtendedValues(devicePath, caps)
    }

    monitor.rgb_max = caps.rgb_max
    monitor.sharpness_max = caps.sharpness_max

    const v = caps.values
    if (caps.color_preset) { monitor.color_preset = v.color_preset; monitor.supports.push('color_preset') }
    if (caps.rgb_gain)     { monitor.red_gain = v.red_gain; monitor.green_gain = v.green_gain; monitor.blue_gain = v.blue_gain; monitor.supports.push('rgb_gain') }
    if (caps.sharpness)    { monitor.sharpness = v.sharpness; monitor.supports.push('sharpness') }
    if (caps.volume)       { monitor.volume = v.volume; monitor.supports.push('volume') }
    if (caps.mute)         { monitor.muted = v.muted; monitor.supports.push('mute') }
    if (caps.power)        { monitor.power_mode = v.power_mode; monitor.supports.push('power') }
    if (caps.usage_time)   { monitor.usage_time_hours = v.usage_time_hours }
    if (caps.vcp_version)  { monitor.vcp_version = v.vcp_version }

    monitors.push(monitor)
  }

  return { monitors, devicePaths }
}

type InMsg =
  | { id: number; type: 'refresh'; full?: boolean }
  | { type: 'setBrightness'; devicePath: string; value: number }
  | { type: 'setContrast'; devicePath: string; value: number }
  | { type: 'setInputSource'; devicePath: string; vcpCode: number }
  | { type: 'setColorPreset'; devicePath: string; value: number }
  | { type: 'setRedGain'; devicePath: string; value: number; max: number }
  | { type: 'setGreenGain'; devicePath: string; value: number; max: number }
  | { type: 'setBlueGain'; devicePath: string; value: number; max: number }
  | { type: 'setSharpness'; devicePath: string; value: number; max: number }
  | { type: 'setVolume'; devicePath: string; value: number }
  | { type: 'setMute'; devicePath: string; muted: boolean }
  | { type: 'setPowerMode'; devicePath: string; mode: number }
  | { type: 'factoryReset'; devicePath: string }
  | { type: 'colorReset'; devicePath: string }
  | { id: number; type: 'setPrimary'; monitorId: number; multiMonitorToolPath: string }

parentPort?.on('message', (msg: InMsg) => {
  switch (msg.type) {
    case 'refresh': {
      try {
        const result = doRefresh(msg.full ?? false)
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

    case 'setContrast': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x12, Math.max(0, Math.min(100, Math.round(msg.value))))
      } catch (err) {
        log('error', `setContrast failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setColorPreset': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x14, msg.value)
      } catch (err) {
        log('error', `setColorPreset failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setRedGain': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x16, Math.max(0, Math.min(msg.max, Math.round(msg.value))))
      } catch (err) {
        log('error', `setRedGain failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setGreenGain': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x18, Math.max(0, Math.min(msg.max, Math.round(msg.value))))
      } catch (err) {
        log('error', `setGreenGain failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setBlueGain': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x1a, Math.max(0, Math.min(msg.max, Math.round(msg.value))))
      } catch (err) {
        log('error', `setBlueGain failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setSharpness': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x87, Math.max(0, Math.min(msg.max, Math.round(msg.value))))
      } catch (err) {
        log('error', `setSharpness failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setVolume': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x62, Math.max(0, Math.min(100, Math.round(msg.value))))
      } catch (err) {
        log('error', `setVolume failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setMute': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x8d, msg.muted ? 1 : 2)
      } catch (err) {
        log('error', `setMute failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'setPowerMode': {
      try {
        ddcci?._setVCP(msg.devicePath, 0xd6, msg.mode)
      } catch (err) {
        log('error', `setPowerMode failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'factoryReset': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x04, 1)
        log('info', `Factory reset sent to ${monitorDisplayName(msg.devicePath)}`)
      } catch (err) {
        log('error', `factoryReset failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      break
    }

    case 'colorReset': {
      try {
        ddcci?._setVCP(msg.devicePath, 0x08, 1)
        log('info', `Color reset sent to ${monitorDisplayName(msg.devicePath)}`)
      } catch (err) {
        log('error', `colorReset failed: ${err instanceof Error ? err.message : String(err)}`)
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
