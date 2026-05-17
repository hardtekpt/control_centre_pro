# Plan: Primary Monitor Detection & Switching via NirCmd

## Context

The DDC service currently treats all monitors equally — there is no concept of a "primary" display.
Users who work with multiple monitors need to know which one is their primary display, and may want
to change it without opening Windows display settings. NirCmd provides a simple CLI (`setprimarydisplay`)
to change the primary display. For detection, we use a PowerShell one-liner since NirCmd cannot query
current state. The feature surfaces as a "Primary" badge on the relevant `DisplayCard` and a
"Set as primary" button on all other cards.

---

## Key Finding: NirCmd Cannot Query — Only Set

NirCmd's `setprimarydisplay <device>` sets the primary monitor, but has no query command.
Detection of the current primary monitor will use PowerShell's `EnumDisplayDevices` Win32 API
with the `EDD_GET_DEVICE_INTERFACE_NAME` flag, which returns the same `\\?\DISPLAY#...` path
format that `@hensm/ddcci` produces — enabling reliable path-based matching.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `is_primary: boolean` to `DdcMonitor`; add `DDC_SET_PRIMARY_MONITOR` to `IPC_CHANNELS` |
| `src/main/services/apis/ddc/service.ts` | Detect primary via PowerShell in `refreshMonitors()`; add `setPrimaryMonitor(monitorId)` method |
| `src/main/index.ts` | Add `ipcMain.handle` for `DDC_SET_PRIMARY_MONITOR` |
| `src/preload/index.ts` | Expose `ddcSetPrimaryMonitor` via `contextBridge` |
| `src/renderer/src/types/electron.d.ts` | Declare `ddcSetPrimaryMonitor` on `Window['api']` |
| `src/renderer/src/components/home/DisplayCard.tsx` | Render "Primary" badge; "Set as primary" button |
| `resources/nircmd/` | Drop `nircmd.exe` here (bundled binary) |
| `electron-builder config` (in `package.json` or `electron-builder.yml`) | Unpack `resources/nircmd/**` from ASAR |

---

## Step-by-Step Implementation

### Step 1 — Bundle NirCmd

Download `nircmd.exe` from https://www.nirsoft.net/utils/nircmd.html and place it at
`resources/nircmd/nircmd.exe`.

In `package.json` under the `"build"` key, add to `extraResources` (or `asarUnpack`):
```json
"extraResources": [
  { "from": "resources/nircmd", "to": "nircmd" }
]
```
Resolve the path in code the same way Python services are resolved — using `app.isPackaged`:
```typescript
const nircmdPath = app.isPackaged
  ? path.join(process.resourcesPath, 'nircmd', 'nircmd.exe')
  : path.join(__dirname, '../../../../resources/nircmd/nircmd.exe')
```

---

### Step 2 — Extend `DdcMonitor` + Add IPC Channel

**`src/shared/types.ts` (~line 360)**

```typescript
export interface DdcMonitor {
  monitor_id: number
  name: string
  brightness: number
  contrast: number
  input_source: string
  available_inputs: string[]
  supports: string[]
  is_primary: boolean   // ← NEW
}
```

**`src/shared/types.ts` (~line 77)** — add after `DDC_SET_POLL_INTERVAL`:
```typescript
DDC_SET_PRIMARY_MONITOR: 'ddc:setPrimaryMonitor', // renderer → main invoke
```

---

### Step 3 — Detect Primary Monitor in `DdcService`

**Why index matching fails**: `System.Windows.Forms.Screen` returns `\\.\DISPLAY1`, `\\.\DISPLAY2`, etc.
but these adapter indices do not reliably correspond to the 1-based `monitorId` assigned by
`@hensm/ddcci.getMonitorList()`. Non-DDC monitors or ordering differences can shift the indices.

**Reliable approach**: Use `EnumDisplayDevices` with the `EDD_GET_DEVICE_INTERFACE_NAME` flag,
which causes the Win32 API to return the monitor's device interface path in the same
`\\?\DISPLAY#MODEL#INSTANCE#{GUID}` format that `@hensm/ddcci` produces. We match by normalised
path string, not by index.

**Important**: The PowerShell script must be written to a temp `.ps1` file and run with `-File`
(not `-Command`) because the `@'...'@` here-string requires its closing `'@` to be at column 0,
which only works in a real file.

**`src/main/services/apis/ddc/service.ts`** — add helper returning a map from normalised device
interface path → adapter name + isPrimary:

```typescript
import { spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

private readonly PS_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class DE {
  [DllImport("user32.dll", CharSet=CharSet.Ansi)]
  public static extern bool EnumDisplayDevices(string dev, uint n, ref DD d, uint flags);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DD {
    public uint cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]  public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceString;
    public uint StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceKey;
  }
}
'@
$out=@();$a=New-Object DE+DD;$a.cb=840;$i=0
while([DE]::EnumDisplayDevices($null,$i,[ref]$a,0)){
  if($a.StateFlags -band 1){
    $m=New-Object DE+DD;$m.cb=840
    [DE]::EnumDisplayDevices($a.DeviceName,0,[ref]$m,1)|Out-Null
    $out+=[PSCustomObject]@{AdapterName=$a.DeviceName;IsPrimary=($a.StateFlags -band 4)-ne 0;DeviceID=$m.DeviceID}
  }
  $a=New-Object DE+DD;$a.cb=840;$i++
}
$out|ConvertTo-Json -Compress
`

// Returns map: normalisedDeviceInterfacePath → { adapterName, isPrimary }
private enumerateDisplayAdapters(): Map<string, { adapterName: string; isPrimary: boolean }> {
  const tmpFile = join(tmpdir(), 'ccp-ddc-enum.ps1')
  const map = new Map<string, { adapterName: string; isPrimary: boolean }>()
  try {
    writeFileSync(tmpFile, this.PS_SCRIPT, 'utf8')
    const result = spawnSync(
      'powershell',
      ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile],
      { encoding: 'utf8', timeout: 8000 }
    )
    unlinkSync(tmpFile)
    const rows = JSON.parse(result.stdout.trim())
    const arr = Array.isArray(rows) ? rows : [rows]
    for (const row of arr) {
      if (!row.DeviceID) continue
      const key = this.normaliseDevicePath(row.DeviceID)
      map.set(key, { adapterName: row.AdapterName, isPrimary: !!row.IsPrimary })
    }
  } catch { /* PowerShell unavailable or failed — leave map empty */ }
  return map
}

private normaliseDevicePath(p: string): string {
  return p.toLowerCase().replace(/\\/g, '').replace(/\?/g, '')
}
```

In `refreshMonitors()`, call the enumeration once before the device loop, then mark each monitor:

```typescript
const adapterMap = this.enumerateDisplayAdapters()

// Inside the per-device loop, after building the monitor object:
const normPath = this.normaliseDevicePath(devicePath)
const adapter  = adapterMap.get(normPath)
monitor.is_primary = adapter?.isPrimary ?? false

// Also cache the adapter name for use in setPrimaryMonitor
if (adapter) this.adapterNames.set(monitorId, adapter.adapterName)
```

Add `private adapterNames = new Map<number, string>()` to the class fields.

---

### Step 4 — Add `setPrimaryMonitor` to `DdcService`

The adapter name (`\\.\DISPLAY2`) cached in `adapterNames` during the last refresh is the exact
argument NirCmd's `setprimarydisplay` expects. No index guessing required.

```typescript
async setPrimaryMonitor(monitorId: number, nircmdPath: string): Promise<void> {
  const adapterName = this.adapterNames.get(monitorId)
  if (!adapterName) throw new Error(`No adapter name cached for monitor ${monitorId} — refresh first`)
  const result = spawnSync(nircmdPath, ['setprimarydisplay', adapterName])
  if (result.error) throw result.error
  // Re-enumerate so is_primary reflects the change on all monitors
  await this.refreshMonitors()
}
```

The `nircmdPath` is passed in from `src/main/index.ts` where the path is resolved once at startup.

---

### Step 5 — Wire the IPC Handler

**`src/main/index.ts`** — resolve nircmd path once at module level (alongside other constants):

```typescript
const nircmdExePath = app.isPackaged
  ? path.join(process.resourcesPath, 'nircmd', 'nircmd.exe')
  : path.join(__dirname, '../../resources/nircmd/nircmd.exe')
```

Add handler after the existing DDC handlers:

```typescript
ipcMain.handle(IPC_CHANNELS.DDC_SET_PRIMARY_MONITOR, async (_, monitorId: number) => {
  await ddcService.setPrimaryMonitor(monitorId, nircmdExePath)
  broadcastDdcMonitors()
})
```

---

### Step 6 — Expose via Preload + Type Declarations

**`src/preload/index.ts`** — add to the `contextBridge.exposeInMainWorld` call:
```typescript
ddcSetPrimaryMonitor: (monitorId: number) => ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_PRIMARY_MONITOR, monitorId),
```

**`src/renderer/src/types/electron.d.ts`** — add to the `api` interface:
```typescript
ddcSetPrimaryMonitor: (monitorId: number) => Promise<void>
```

---

### Step 7 — Update `DisplayCard` UI

**`src/renderer/src/components/home/DisplayCard.tsx`**

1. **Primary badge** — show next to the monitor name when `monitor.is_primary`:
```tsx
{monitor.is_primary && (
  <span style={{
    fontSize: '0.65rem',
    padding: '1px 6px',
    borderRadius: '4px',
    background: 'var(--color-accent)',
    color: 'var(--color-bg)',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  }}>
    Primary
  </span>
)}
```

2. **"Set as primary" button** — show only when `!monitor.is_primary`:
```tsx
{!monitor.is_primary && (
  <button
    onClick={() => window.api.ddcSetPrimaryMonitor(monitor.monitor_id)}
    style={{
      fontSize: '0.75rem',
      padding: '3px 10px',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      cursor: 'pointer',
    }}
  >
    Set as primary
  </button>
)}
```

Both elements live in the card header row alongside the monitor name and feature badges.

---

## Verification

1. **Build check**: `npm run build` — no TypeScript errors on `is_primary` or new IPC channel
2. **Dev run**: `npm run dev` — open home page; verify the primary monitor card shows "Primary" badge
3. **Set primary**: Click "Set as primary" on a secondary monitor; verify Windows display settings
   reflects the change and the badge moves to the new primary card
4. **Edge cases**:
   - Single monitor: only one card, badge shown, no "Set as primary" button
   - NirCmd missing: `setPrimaryMonitor` throws; IPC handler should catch + log via `ddcService.log`
5. **Packaged build**: Run `npm run package` and confirm `nircmd.exe` lands in `resources/nircmd/`
   inside the ASAR-unpacked directory

---

## Risks & Notes

- **Device path matching**: Both `@hensm/ddcci` and `EnumDisplayDevices` with
  `EDD_GET_DEVICE_INTERFACE_NAME` return the same `\\?\DISPLAY#...` format. Normalising to
  lowercase with backslashes and `?` stripped before comparing is sufficient. If a monitor lacks
  a DDC path match (e.g. a display that DDC can't enumerate), its `is_primary` defaults to `false`
  gracefully.
- **PowerShell script delivery**: Must use `-File` (temp `.ps1` file), not `-Command`, because
  the `@'...'@` here-string requires its closing marker at column 0 in the source file.
- **NirCmd binary**: Must be manually downloaded and committed to `resources/nircmd/`. It is
  freeware (NirSoft), ~50 KB, Windows-only.
- **UAC**: `setprimarydisplay` does not require elevation — it modifies per-user display settings.
- **Alternative**: `win-screen-resolution` npm package could handle both get and set natively
  without a bundled binary; NirCmd is chosen here as requested.
