# DDC Feature Report

A reference document for replicating the DDC/CI monitor-control feature in this app.

---

## Overview

The DDC feature uses the `@hensm/ddcci` native Node.js module (Windows-only) to enumerate connected monitors and read/write VCP (Virtual Control Panel) codes over the DDC/CI protocol. The main challenges it addresses are: reliably identifying monitors across reboots, discovering what each monitor supports, and keeping the UI responsive despite 200–400 ms blocking hardware calls.

**Key files:**

| File | Role |
|------|------|
| `src/main/services/apis/ddc/service.ts` | Native DDC service — enumeration and VCP read/write |
| `src/main/ipc/ddcHandlers.ts` | IPC handlers — serial queue, caching, error handling |
| `src/shared/ipc.ts` | DDC IPC channel definitions and payload types |
| `src/shared/types.ts` | DDC domain types (`DdcMonitor`, `DdcMonitorPayload`, etc.) |
| `src/renderer/src/components/MonitorControlsCard.tsx` | Dashboard card (primary + secondary monitor) |
| `src/renderer/src/components/monitor/MonitorInlineControl.tsx` | Brightness slider + input toggle |
| `src/renderer/src/components/settings/DdcSettingsTab.tsx` | DDC settings panel |
| `src/renderer/src/stores/store.ts` | Renderer-side DDC state and actions |

---

## 1. Enumerating and Identifying Displays

### Enumeration call

```ts
const raw = ddcci.getAllMonitors("accurate", false, true);
```

The `"accurate"` flag asks the driver for full device metadata. The raw result is an array of monitor objects with fields like `id`, `deviceKey`, `path`, `fullName`, `hwid`, `key`, `devicePath`, `monitorID`, `num`, `index`, and `order`. The field names are not guaranteed to be consistent across machines or driver versions.

### Stable key resolution

Because the raw field names vary, the service builds a list of **candidate keys** from every non-empty string or array-element value across those fields. It then selects a **preferred key** by attempting to read a known VCP code (brightness 0x10 first, then contrast 0x12, input source 0x60, power mode 0xD6) for each candidate. The first candidate that succeeds becomes the stored preferred key for that monitor.

Each enumerated monitor is assigned a stable `monitor_id` (1-based index) and a human-readable `name` from `fullName` or equivalent. The preferred key is persisted in the settings' `monitorPrefs` map so it can be reused on the next poll without re-probing every candidate.

---

## 2. Feature Discovery (VCP Capabilities)

The service builds a `supports` array per monitor by recording which VCP reads succeed during enumeration. Possible entries: `"brightness"`, `"contrast"`, `"input_source"`, `"power_mode"`.

### VCP codes used

| Feature | VCP code | Access |
|---------|----------|--------|
| Brightness | `0x10` | Read + Write |
| Contrast | `0x12` | Read only |
| Input source | `0x60` | Read + Write |
| Power mode | `0xD6` | Read only |

### Available input discovery

Input source options are resolved with a two-step fallback:

1. `ddcci.getMonitorInputs(key)` — driver-native input list.
2. If that fails: `ddcci.getCapabilities(key)` — returns a capabilities object; the service reads the `"0x60"` array or the `inputs` sub-object from it.

Input values are stored as hex strings (`"0x11"`, `"0x0F"`, etc.). The service maps common hex codes to named labels used in the UI: HDMI1 → `0x11`, HDMI2 → `0x12`, DP1 → `0x0F`, DP2 → `0x10`, DisplayPort1/2, USB-C → `0x1B`, DVI1/2 → `0x03`/`0x04`, VGA1/2 → `0x01`/`0x02`. Users can also define their own labels in `UiSettings.ddc.inputNameMap`.

---

## 3. Reading and Writing Monitor Data

### Data flow — get monitors

```
Renderer
  → arctisBridge.invoke(IPC_INVOKE.DDC_GET_MONITORS)
  → ddcHandlers: fetchDdcMonitorsIfStale(force)
      checks cache age vs pollIntervalMs
      if stale → ddcService.listMonitors()
          ddcci.getAllMonitors(...)
          per monitor: ddcci.getVCP(key, 0x10/0x12/0x60/0xD6)
          returns DdcMonitor[]
      updates ddcMonitorsCache + ddcMonitorsCacheTs
      broadcasts DDC_UPDATE event to all windows
  → returns DdcGetMonitorsResponse { ok, monitors[], updatedAt }
```

### Data flow — set brightness

```
Renderer
  → arctisBridge.invoke(IPC_INVOKE.DDC_SET_BRIGHTNESS, { monitorId, value })
  → ddcHandlers: enqueue({ type: "brightness", monitorId, value })
      coalesces duplicates — only the latest value for a monitor is kept
      setImmediate → queue flush
  → ddcService.setBrightness(monitorId, value)
      resolves preferred key for monitorId
      ddcci.setVCP(key, 0x10, level)
      reads updated state via listMonitors() (single monitor)
  → returns DdcMutateMonitorResponse { ok, monitor }
  → cache updated, DDC_UPDATE broadcast
```

### Data flow — set input source

Same queue path as brightness but uses VCP code `0x60`. The service parses the input value from a named string (`"hdmi1"` → `0x11`) or directly from a hex/numeric string. An unparseable value throws before the hardware call.

### Response types

```ts
// shared/ipc.ts
DdcMonitorPayload {
  monitor_id: number;
  name: string;
  brightness: number;          // 0-100
  contrast: number;
  input_source: string;        // hex string e.g. "0x11"
  available_inputs: string[];
  power_mode: number;
  supports: string[];          // ["brightness","contrast","input_source","power_mode"]
}

DdcGetMonitorsResponse { ok: boolean; monitors: DdcMonitorPayload[]; error?: string; updatedAt?: number | null }
DdcMutateMonitorResponse { ok: boolean; monitor?: DdcMonitorPayload; error?: string }
```

---

## 4. IPC Channels

All channels are defined in `src/shared/ipc.ts` under `IPC_INVOKE` and `IPC_EVENT`.

| Direction | Channel key | String | Payload |
|-----------|-------------|--------|---------|
| Invoke | `DDC_GET_MONITORS` | `"ddc:get-monitors"` | `() → DdcGetMonitorsResponse` |
| Invoke | `DDC_SET_BRIGHTNESS` | `"ddc:set-brightness"` | `{ monitorId, value } → DdcMutateMonitorResponse` |
| Invoke | `DDC_SET_INPUT_SOURCE` | `"ddc:set-input-source"` | `{ monitorId, value } → DdcMutateMonitorResponse` |
| Event | `DDC_UPDATE` | `"ddc:update"` | `DdcMonitorPayload[]` (broadcast to all windows) |

Channels are never used as string literals in handlers or the renderer — always accessed through the typed maps.

---

## 5. Handling the Slow DDC Protocol

DDC/CI calls block the Node.js event loop for roughly 200–400 ms each. The feature uses five complementary techniques:

### 5.1 Serial command queue

`ddcHandlers.ts` maintains a queue of pending write commands. Commands are flushed one at a time using `setImmediate()`, which yields to the event loop between each command. This means the main process remains responsive to other IPC messages while a DDC write is in flight.

### 5.2 Brightness coalescing

Before a brightness command is enqueued, any existing queued brightness command for the same monitor is replaced with the new value. This means rapid slider drags never pile up more than one pending write per monitor.

### 5.3 Background polling with in-flight guard

A `setInterval` timer calls `fetchDdcMonitorsIfStale()` on the configured `pollIntervalMs` (default 5 minutes, range 1–30 minutes). A boolean flag `ddcMonitorRefreshInFlight` prevents a new poll from starting while one is still running, which avoids concurrent blocking calls piling up.

### 5.4 Stale-threshold on settings open

When the settings window opens, the renderer requests a refresh only if the cached data is older than `openStaleThresholdMs` (default 60 seconds). This avoids blocking the UI thread every time the user opens settings.

### 5.5 Startup warmup with retry

On app start, the service attempts to fetch monitors immediately. If it fails (display not yet enumerated, driver not ready), it retries up to 5 times with 5-second delays before giving up. This prevents a failed cold-start from leaving the feature permanently broken.

### 5.6 Optimistic UI + write lock

The renderer applies changes to local state immediately before the IPC call returns. A per-channel `lockedUntilRef` (1200 ms default) prevents the `DDC_UPDATE` broadcast from overwriting the user's in-progress edit during the DDC acknowledgment lag. This is the same write-lock pattern used for Sonar mixer channels.

### 5.7 Slider commit on release

`MonitorInlineControl` keeps a local draft brightness value while the slider is being dragged and only invokes the IPC call on `pointerup` / `touchend` / `keyup`. This means the UI feels instant and only one hardware write fires per drag gesture.

---

## 6. State Ownership

### Main process (in-memory, not persisted)

```ts
ddcMonitorsCache: DdcMonitor[]        // current monitor list
ddcMonitorsCacheTs: number            // epoch ms of last fetch
ddcLastStatus: "unknown" | "ok" | "error"
ddcLastFailure: string
ddcMonitorRefreshTimer: NodeJS.Timeout | null
ddcMonitorRefreshInFlight: boolean
```

### UiSettings.ddc (persisted)

```ts
{
  pollIntervalMs: number;                      // default 300_000
  openStaleThresholdMs: number;                // default 60_000
  dashboardMonitorId: number | null;           // primary slot
  dashboardSecondaryMonitorId: number | null;  // secondary slot
  dashboardPrimaryInputA: string;              // input A for primary toggle
  dashboardPrimaryInputB: string;              // input B for primary toggle
  dashboardSecondaryInputA: string;
  dashboardSecondaryInputB: string;
  inputNameMap: Record<string, string>;        // "0x11" → "HDMI 1"
  monitorPrefs: Record<string, {               // keyed by monitor name
    alias: string;
    enabled: boolean;
  }>;
}
```

### Renderer (useBridgeState hook)

```ts
ddcMonitors: DdcMonitorPayload[]
ddcMonitorsUpdatedAt: number | null
ddcError: string | null
// actions:
setDdcBrightness(monitorId, value)
setDdcInputSource(monitorId, value)
refreshDdcMonitors()
```

The `DDC_UPDATE` event listener in the store updates `ddcMonitors` and `ddcMonitorsUpdatedAt` on every backend broadcast.

---

## 7. Renderer UI Structure

- **`MonitorControlsCard`** — dashboard card; shows one or two monitor slots based on `dashboardMonitorId` / `dashboardSecondaryMonitorId`; looks up aliases from `monitorPrefs`.
- **`MonitorInlineControl`** — the interactive widget inside each slot: brightness slider with draft state + input toggle button with pending indicator.
- **`MonitorDisconnectedRow`** — placeholder row when a configured monitor is not currently found in `ddcMonitors`.
- **`DdcSettingsTab`** — full settings panel: poll interval, stale threshold, primary/secondary monitor pickers with alias inputs, A/B input pair selectors, custom input name labels, a JSON viewer of the raw monitor payload, a manual Refresh button, and a last-updated timestamp.

---

## Replication Checklist

1. Install `@hensm/ddcci` (vendored, ASAR-unpacked — cannot be loaded from inside the ASAR archive).
2. Implement `DdcApiService` with `listMonitors()`, `setBrightness()`, and `setInputSource()` using the candidate-key resolution and VCP codes above.
3. Define DDC IPC channels in `shared/ipc.ts`; add handlers in `ddcHandlers.ts` behind a serial `setImmediate` queue with brightness coalescing.
4. Expose channels through `src/preload/index.ts` context bridge.
5. Add `UiSettings.ddc` defaults to `shared/settings.ts`; pass through `mergeSettings()`.
6. Add `DDC_UPDATE` broadcast in the main process; subscribe in the renderer store.
7. Apply the write-lock pattern (same as Sonar channels) to prevent backend echoes from clobbering optimistic UI during DDC lag.
8. Implement the five slow-protocol mitigations: serial queue, coalescing, background polling with in-flight guard, stale-threshold on open, and startup warmup retry.
9. Build the three renderer components (`MonitorControlsCard`, `MonitorInlineControl`, `DdcSettingsTab`) wired to the store actions and the `ddcMonitors` slice of state.
