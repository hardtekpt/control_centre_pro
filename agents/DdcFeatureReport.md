# DDC/CI Display Control — Implementation Reference

## Status: Implemented

This document describes the DDC/CI display control feature as implemented in Control Centre Pro.
It can be used as a reference for replicating or extending the feature.

---

## Overview

The DDC feature uses the `@hensm/ddcci` native Node.js module (Windows-only) to enumerate
connected monitors and read/write VCP (Virtual Control Panel) codes over the DDC/CI protocol.

**Implemented capabilities**:
- Brightness read + write
- Contrast read
- Input source read + write (with named labels)
- Primary display detection via `EnumDisplayDevices` Win32 API
- Primary display switching via NirCmd

**Key design challenges addressed**:
- DDC calls block the Node.js event loop for 200–400ms each
- PowerShell device queries block for up to 10 seconds
- Rapid UI interactions (slider drag) must not pile up hardware writes
- Monitor identification must be stable across reboots

---

## Key Files

| File | Role |
|------|------|
| `src/main/services/apis/ddc/service.ts` | Async DDC service — manages worker, queues commands, maintains cache |
| `src/main/services/apis/ddc/ddcWorker.ts` | Worker thread — all blocking DDC + PowerShell calls |
| `src/main/index.ts` | IPC handlers, DDC state (cache, poll timer, queue) |
| `src/shared/types.ts` | `DdcMonitor` interface + `IPC_CHANNELS` DDC entries |
| `src/renderer/src/components/home/DisplayCard.tsx` | Dashboard card with brightness slider + input selector |

---

## 1. VCP Codes Used

| Feature | VCP Code | Access |
|---------|----------|--------|
| Brightness | `0x10` | Read + Write |
| Contrast | `0x12` | Read only |
| Input source | `0x60` | Read + Write |

### Input Source Values

Common VCP 0x60 values and their friendly names:

| Hex | Label |
|-----|-------|
| `0x01` | VGA 1 |
| `0x02` | VGA 2 |
| `0x03` | DVI 1 |
| `0x04` | DVI 2 |
| `0x0f` | DisplayPort 1 |
| `0x10` | DisplayPort 2 |
| `0x11` | HDMI 1 |
| `0x12` | HDMI 2 |
| `0x1b` | USB-C |

Input values are stored as lowercase hex strings (`"0x11"`, `"0x0f"`, etc.). The `INPUT_NAME_MAP`
in `DisplayCard.tsx` maps these to human-readable labels. The current input is always included in
`available_inputs` even if it isn't in the fixed map.

---

## 2. Worker Thread Architecture

All blocking operations run in a `worker_threads.Worker` (`ddcWorker.ts`). The main process
(`service.ts`) is a thin async wrapper that posts messages and resolves Promises when the worker
responds.

### Why a Worker?

`spawnSync` for PowerShell and the synchronous `ddcci` native calls both block the OS thread.
In the main process, any block freezes all IPC handlers and makes the entire UI unresponsive.
A `worker_threads.Worker` runs on its own OS thread — the main event loop keeps running.

### Build Configuration

The worker needs its own rollup entry in `electron.vite.config.ts`:

```typescript
main: {
  build: {
    rollupOptions: {
      input: {
        index:     resolve('src/main/index.ts'),
        ddcWorker: resolve('src/main/services/apis/ddc/ddcWorker.ts'),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
}
```

Reference the compiled file at runtime:
```typescript
new Worker(join(__dirname, 'ddcWorker.js'))
```

### Message Protocol

Main → Worker:
```typescript
{ id: number; type: 'refresh' }
{ type: 'setBrightness'; devicePath: string; value: number }   // fire-and-forget
{ type: 'setInputSource'; devicePath: string; vcpCode: number } // fire-and-forget
{ id: number; type: 'setPrimary'; monitorId: number; nircmdPath: string }
```

Worker → Main:
```typescript
{ type: 'refreshDone';    id: number; monitors: DdcMonitor[]; devicePaths: [number, string][] }
{ type: 'setPrimaryDone'; id: number; monitors: DdcMonitor[]; devicePaths: [number, string][] }
{ type: 'error';          id: number; message: string }
{ type: 'log';            level: 'info'|'warn'|'error'; message: string }
```

### Async Promise Map Pattern

Requests that need a response use a unique `id`:

```typescript
private pendingCallbacks = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()
private nextId = 1

private async sendRequest(msg: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const id = this.nextId++
    this.pendingCallbacks.set(id, { resolve, reject })
    this.worker.postMessage({ ...msg, id })
  })
}

// In message handler:
worker.on('message', (msg) => {
  const cb = this.pendingCallbacks.get(msg.id)
  if (cb) {
    this.pendingCallbacks.delete(msg.id)
    msg.type === 'error' ? cb.reject(new Error(msg.message)) : cb.resolve(msg)
  }
})
```

Fire-and-forget commands (`setBrightness`, `setInputSource`) post without an `id` and no
callback is registered — the worker executes them and emits a `log` on completion.

---

## 3. Primary Display Detection

### Why Not Use Screen Index?

`System.Windows.Forms.Screen` returns `\\.\DISPLAY1`, `\\.\DISPLAY2`, etc., but adapter indices
do not reliably correspond to the 1-based `monitorId` assigned by `@hensm/ddcci.getMonitorList()`.
Non-DDC monitors or ordering differences can shift the indices.

### Reliable Approach: EnumDisplayDevices

A PowerShell C# P/Invoke script calls `EnumDisplayDevices` with the `EDD_GET_DEVICE_INTERFACE_NAME`
flag, which returns the monitor's device interface path in the same `\\?\DISPLAY#MODEL#INSTANCE#{GUID}`
format that `@hensm/ddcci` produces. We match by normalised path string.

### PowerShell Script Delivery

The script **must** be written to a temp `.ps1` file and run with `-File` (not `-Command`).
The PowerShell `@'...'@` here-string requires its closing `'@` at column 0 in the source file.
Using `-Command` with an inline script causes a parse error because PowerShell cannot place
a heredoc closing marker at column 0 inside a command-line argument.

```typescript
const tmpFile = join(tmpdir(), 'ccp-ddc-enum.ps1')
writeFileSync(tmpFile, PS_SCRIPT, 'utf8')
const result = spawnSync('powershell', [
  '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile
], { encoding: 'utf8', timeout: 8000 })
unlinkSync(tmpFile)
```

### Path Normalisation

Both `@hensm/ddcci` and `EnumDisplayDevices` return `\\?\DISPLAY#...` paths. Normalise before
comparing by stripping backslashes, `?`, and lowercasing:

```typescript
private normaliseDevicePath(p: string): string {
  return p.toLowerCase().replace(/\\/g, '').replace(/\?/g, '')
}
```

---

## 4. Primary Display Switching (NirCmd)

NirCmd's `setprimarydisplay <adapterName>` sets the primary monitor. The adapter name (e.g.
`\\.\DISPLAY2`) is cached from the last `EnumDisplayDevices` run.

- NirCmd does **not** require UAC elevation.
- NirCmd binary lives at `resources/nircmd/nircmd.exe`.
- Path resolves via `app.isPackaged`:
  ```typescript
  const nircmdPath = app.isPackaged
    ? path.join(process.resourcesPath, 'nircmd', 'nircmd.exe')
    : path.join(__dirname, '../../resources/nircmd/nircmd.exe')
  ```
- Bundling: in `package.json` under `"build"`:
  ```json
  "extraResources": [{ "from": "resources/nircmd", "to": "nircmd" }]
  ```

After `setprimarydisplay` runs, a full `refreshMonitors()` is triggered so `is_primary` updates
on all monitor cards.

---

## 5. Slow Protocol Mitigations

DDC calls are slow. Five complementary techniques keep the UI responsive:

### 5.1 Command Queue + Coalescing

`ddcQueue: Map<monitorId, { value }>` in `index.ts` — rapid brightness changes from slider drags
are coalesced: only the latest value per monitor is kept. Flushed via `setImmediate()`.

```typescript
ddcQueue.set(monitorId, { value })
setImmediate(flushDdcQueue)
```

### 5.2 In-Flight Guard

`ddcInFlight` boolean prevents overlapping refreshes. If a refresh is already running,
a new `refreshDdcMonitors()` call returns immediately.

### 5.3 Cache

Return cached data if less than 60 seconds old. Only trigger a real DDC read if stale.

### 5.4 Startup Retry

On app start, attempt refresh with 5 retries at 5-second intervals. Handles the case where
the DDC driver isn't ready immediately after boot.

### 5.5 Background Poll

60-second `setInterval` polling (configurable in DDC Settings).

---

## 6. Optimistic UI + Write Lock (DisplayCard.tsx)

The renderer applies changes to local state immediately before the IPC call returns.

```typescript
const [draftBrightness, setDraftBrightness] = useState<number | null>(null)
const lockedUntilRef = useRef<number>(0)

// While DDC_UPDATE arrives, ignore it if we're within the lock window
if (Date.now() < lockedUntilRef.current) return

// On slider release:
const onPointerUp = () => {
  window.api.ddcSetBrightness(monitor.monitor_id, draftBrightness)
  lockedUntilRef.current = Date.now() + 1200   // 1200ms lock
  setTimeout(() => setDraftBrightness(null), 1200)
}

// Display value: draft takes precedence over the server value
const displayBrightness = draftBrightness ?? monitor.brightness
```

The 1200ms lock window exceeds the typical DDC round-trip (200–400ms) + poll delay, ensuring
the echoed `DDC_UPDATE` broadcast never clobbers the user's current interaction.

---

## 7. DdcMonitor Interface

```typescript
export interface DdcMonitor {
  monitor_id: number        // 1-indexed, stable within a session
  name: string              // extracted from device path (e.g. "G27Q")
  brightness: number        // 0–100
  contrast: number          // 0–100
  input_source: string      // lowercase hex string, e.g. "0x11"
  available_inputs: string[] // sorted; always includes current input
  supports: string[]         // ['brightness', 'contrast', 'input_source']
  is_primary: boolean        // from EnumDisplayDevices
}
```

---

## 8. IPC Channels

| Direction | Channel | Payload |
|-----------|---------|---------|
| Invoke | `DDC_GET_MONITORS` | `() → DdcMonitor[]` |
| Invoke | `DDC_SET_BRIGHTNESS` | `(monitorId, value) → void` |
| Invoke | `DDC_SET_INPUT_SOURCE` | `(monitorId, inputValue) → void` |
| Invoke | `DDC_SET_PRIMARY_MONITOR` | `(monitorId) → void` |
| Push | `DDC_UPDATE` | `DdcMonitor[]` (broadcast to all windows) |
| Invoke | `DDC_GET_POLL_INTERVAL` | `() → number` |
| Invoke | `DDC_SET_POLL_INTERVAL` | `(intervalMs) → void` |

---

## 9. Home Page Display Grid

```tsx
{ddcMonitors.length > 0 && (
  <HomeSection title="Display">
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1rem'
    }}>
      {ddcMonitors.map(m => <DisplayCard key={m.monitor_id} monitor={m} />)}
    </div>
  </HomeSection>
)}
```

Responsive: 2 columns on wide screens, 1 on narrow (CSS `auto-fit` + `minmax`).

---

## 10. Replication Checklist

1. Install `@hensm/ddcci` (vendored, ASAR-unpacked — cannot be loaded from inside the ASAR archive).
2. Add a separate rollup `input` entry for the worker in `electron.vite.config.ts`.
3. Implement `DdcService` with `refreshMonitors()`, `setBrightness()`, `setInputSource()`, and
   `setPrimaryMonitor()` using the worker message protocol above.
4. Wire IPC handlers in `main/index.ts` with the command queue + coalescing pattern.
5. Expose channels through the preload context bridge.
6. Implement `DisplayCard.tsx` with local draft state + write-lock pattern.
7. Apply the five slow-protocol mitigations.
8. Bundle `nircmd.exe` in `resources/nircmd/` and configure `extraResources` in `package.json`.
