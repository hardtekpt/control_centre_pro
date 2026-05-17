// run from project root: node test-ddc-mapping.js
const ddcci = require('./node_modules/@hensm/ddcci')
const { spawnSync } = require('child_process')
const { writeFileSync, unlinkSync } = require('fs')
const { join } = require('path')
const os = require('os')

// QueryDisplayConfig + DisplayConfigGetDeviceInfo gives us:
//   monitorDevicePath  = exact DDC path (\\?\DISPLAY#MODEL#INSTANCE#{GUID})
//   viewGdiDeviceName  = adapter name like \\.\DISPLAY1
// Combined with Screen.AllScreens (primary flag) we get a full mapping.
const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public static class DC {
    const uint QDC_ONLY_ACTIVE_PATHS = 2;

    [StructLayout(LayoutKind.Sequential)]
    struct LUID { public uint Low; public int High; }

    [StructLayout(LayoutKind.Sequential)]
    struct PATH_SOURCE {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PATH_TARGET {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint outputTech;
        public uint rotation;
        public uint scaling;
        public uint refreshNum;
        public uint refreshDen;
        public uint scanLine;
        public int  targetAvailable;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PATH_INFO {
        public PATH_SOURCE sourceInfo;
        public PATH_TARGET targetInfo;
        public uint flags;
    }

    [StructLayout(LayoutKind.Explicit, Size=64)]
    struct MODE_INFO { }

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct TARGET_NAME {
        public uint   type;
        public uint   size;
        public LUID   adapterId;
        public uint   id;
        public uint   nameFlags;
        public uint   outputTech;
        public ushort edidMfgId;
        public ushort edidProdId;
        public uint   connectorInstance;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=64)]  public string friendlyName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string devicePath;
    }

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct SOURCE_NAME {
        public uint type;
        public uint size;
        public LUID adapterId;
        public uint id;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string viewGdiDeviceName;
    }

    [DllImport("user32.dll")]
    static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPaths, out uint numModes);

    [DllImport("user32.dll")]
    static extern int QueryDisplayConfig(uint flags, ref uint numPaths, [In,Out] PATH_INFO[] paths,
        ref uint numModes, [In,Out] MODE_INFO[] modes, IntPtr topologyId);

    [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")]
    static extern int GetTargetName(ref TARGET_NAME req);

    [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")]
    static extern int GetSourceName(ref SOURCE_NAME req);

    public struct MonitorEntry {
        public string DevicePath;
        public string GdiDeviceName;
    }

    public static MonitorEntry[] GetMonitorMap() {
        uint np, nm;
        GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out np, out nm);
        var paths = new PATH_INFO[np];
        var modes = new MODE_INFO[nm];
        QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref np, paths, ref nm, modes, IntPtr.Zero);

        var result = new List<MonitorEntry>();
        for (uint i = 0; i < np; i++) {
            var tgt = new TARGET_NAME {
                type = 2,  // DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME
                adapterId = paths[i].targetInfo.adapterId,
                id        = paths[i].targetInfo.id
            };
            tgt.size = (uint)Marshal.SizeOf(tgt);
            GetTargetName(ref tgt);

            var src = new SOURCE_NAME {
                type = 1,  // DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME
                adapterId = paths[i].sourceInfo.adapterId,
                id        = paths[i].sourceInfo.id
            };
            src.size = (uint)Marshal.SizeOf(src);
            GetSourceName(ref src);

            result.Add(new MonitorEntry { DevicePath = tgt.devicePath, GdiDeviceName = src.viewGdiDeviceName });
        }
        return result.ToArray();
    }
}
'@

Add-Type -AssemblyName System.Windows.Forms
$primaryGdi = ([System.Windows.Forms.Screen]::PrimaryScreen).DeviceName

$out = @()
foreach ($m in [DC]::GetMonitorMap()) {
    $out += [PSCustomObject]@{
        DevicePath    = $m.DevicePath
        GdiDeviceName = $m.GdiDeviceName
        IsPrimary     = ($m.GdiDeviceName -eq $primaryGdi)
    }
}
$out | ConvertTo-Json -Compress
`

const tmpFile = join(os.tmpdir(), 'ddc-enum-test.ps1')
writeFileSync(tmpFile, '﻿' + psScript, 'utf8') // BOM so PS parses UTF-8 correctly

const norm = s => s.toLowerCase().replace(/\\/g, '').replace(/\?/g, '')

const ddcPaths = ddcci.getMonitorList()
console.log('\n=== DDC paths ===')
ddcPaths.forEach((p, i) => console.log(`  [${i + 1}] raw:  ${p}\n       norm: ${norm(p)}`))

const result = spawnSync(
  'powershell',
  ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile],
  { encoding: 'utf8', timeout: 15000 }
)
unlinkSync(tmpFile)

if (!result.stdout.trim()) {
  console.error('\nPowerShell produced no output. stderr:', result.stderr)
  process.exit(1)
}

const rows = JSON.parse(result.stdout.trim())
const adapters = Array.isArray(rows) ? rows : [rows]
console.log('\n=== QueryDisplayConfig map ===')
adapters.forEach(r =>
  console.log(`  ${r.GdiDeviceName}  primary=${r.IsPrimary}\n    raw:  ${r.DevicePath}\n    norm: ${norm(r.DevicePath || '')}`)
)

console.log('\n=== Match check ===')
ddcPaths.forEach((p, i) => {
  const key = norm(p)
  const match = adapters.find(r => norm(r.DevicePath || '') === key)
  console.log(`  DDC[${i + 1}] → ${match ? `${match.GdiDeviceName} (primary=${match.IsPrimary})` : 'NO MATCH'}`)
})
