# Control Centre Pro — Claude Code Reference

## What This App Is

**Control Centre Pro** is a Windows desktop application for managing hardware devices and running
custom background services. Think of it as a personal control panel: monitor connected devices,
adjust audio and display settings, start/stop services, and get real-time OSD feedback for
everything connected to your machine.

The app is designed as an extensible shell — the MVP establishes the layout, navigation patterns,
and service infrastructure; device and service plugins are added as sidebar sections over time.

---

## Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron 31+** | Code-sharing between web and desktop; Claude can generate Electron code effectively |
| UI | **React 18 + TypeScript** | Strict mode; component model maps well to the sidebar/pane architecture |
| Bundler | **electron-vite** | Single config for main + preload + renderer; fast HMR |
| Styling | **Tailwind CSS** | Utility-first; design tokens via CSS custom properties |
| State | **Zustand** | Simple store without Redux boilerplate |
| Packaging | **electron-builder** | Mature Windows NSIS/MSIX packaging + auto-update integration |
| Services | **Python subprocesses** | Hardware HID services written in Python; communicate via newline-delimited JSON on stdout |

---

## Project Structure

```
resources/
├── services/
│   └── arctis_hid_service.py         # Python HID service for Arctis Nova Pro
├── nircmd/
│   └── nircmd.exe                    # NirCmd binary (set primary display, no UAC)
└── *.png                             # App icons

src/
├── main/                             # Node.js (Electron main process)
│   ├── index.ts                      # Window creation, IPC handlers, app lifecycle, OSD management
│   ├── services/
│   │   ├── serviceManager.ts         # Spawns/monitors Python subprocesses, routes events
│   │   ├── sonarService.ts           # GG Sonar HTTP REST polling client (Node.js native)
│   │   ├── activeWindowMonitor.ts    # Foreground window watcher (preset auto-switcher + monitor actions)
│   │   ├── notifications/
│   │   │   ├── windowService.ts      # System notification BrowserWindows (HTML inline, no React)
│   │   │   └── timerService.ts       # Keyed auto-close timer map (debounces rapid events)
│   │   └── apis/ddc/
│   │       ├── service.ts            # DDC/CI async wrapper — manages worker lifecycle
│   │       └── ddcWorker.ts          # Worker thread: PowerShell device queries + ddcci native calls
│   └── shortcuts/
│       ├── dispatcher.ts             # Executes shortcut actions; routes to services
│       └── shortcutRegistry.ts       # Global hotkey registration + handler wiring
├── preload/
│   └── index.ts                      # contextBridge — exposes window.api to the renderer
├── shared/
│   └── types.ts                      # IPC channel names + ALL shared TS interfaces
└── renderer/                         # Browser (React)
    ├── index.html
    ├── notification.html             # Separate entry point for the OSD BrowserWindow
    └── src/
        ├── App.tsx                   # Theme, window state sync, IPC subscriptions, FloatingSidebar
        ├── NotificationOverlay.tsx   # OSD renderer root (loads in notification.html window)
        ├── main.tsx                  # ReactDOM entry for main window
        ├── notification.tsx          # ReactDOM entry for OSD window
        ├── stores/
        │   ├── appStore.ts           # Zustand: currentView, sidebarCollapsed, theme, peek panel
        │   ├── serviceStore.ts       # Zustand: services[], logs[], ArctisState, ddcMonitors[], settings
        │   ├── sonarStore.ts         # Zustand: SonarState, activePresetIds per channel
        │   ├── notificationStore.ts  # Zustand: notification queue and stacking state
        │   └── shortcutStore.ts      # Zustand: shortcuts[], conflict detection
        ├── lib/
        │   ├── notifyFromEvent.ts    # Maps hardware events -> SerializedNotification push calls
        │   └── shortcuts/
        │       └── catalog.ts         # Action definitions, categories, metadata
        ├── contexts/
        │   └── settingsFormContext.tsx  # Dirty state + save-handler registry for settings pages
        ├── types/electron.d.ts       # window.api type declarations for TS
        ├── styles/globals.css        # CSS tokens + Tailwind base + animation keyframes
        ├── components/
        │   ├── layout/               # TopBar, Sidebar, FloatingSidebar, MainLayout, MainContent
        │   ├── settings/             # SettingsLayout, SettingsSidebar, UnsavedChangesDialog
        │   ├── home/                 # HeadsetCard, CompactHeadsetCard, DisplayCard, panel components
        │   ├── gg-sonar/             # ChannelMixer, ChannelStrip, PresetEditor
        │   ├── notifications/        # NotificationCircle, NotificationRect, NotificationStack, icons
        │   └── common/               # ConfirmDialog
        └── pages/
            ├── Home.tsx              # Dashboard — CompactHeadsetCard + DisplayCards grid
            ├── Arctis.tsx            # Full headset control panel
            ├── GGSonar.tsx           # Audio mixer page (ChannelMixer)
            ├── Shortcuts.tsx         # Keyboard shortcuts configuration UI
            ├── Notifications.tsx     # Notification preview and per-type config
            └── settings/
                ├── GeneralSettings.tsx   # Theme, tray, Python path, service enable/disable
                ├── DDCSettings.tsx       # Poll interval, monitor preferences
                ├── GGSonarSettings.tsx   # Sonar polling config
                ├── NotificationsSettings.tsx  # Per-notification toggles, shapes, TTL
                └── About.tsx             # Version info + live service terminal log
```

---

## Architecture Rules (Never Break These)

1. **Never enable `nodeIntegration: true`** — security risk; any XSS becomes full system compromise.
2. **Never use `ipcRenderer` directly in React components** — always go through `window.api.*`
   which is exposed by the preload script via `contextBridge`.
3. **Never use string literals for IPC channels** — all channel names are `IPC_CHANNELS` constants
   in `src/shared/types.ts`. Typos silently fail; typed constants fail at compile time.
4. **Never do file I/O in the renderer** — request it via IPC; the main process handles all fs ops.
5. **Always use `ipcMain.handle` (not `ipcMain.on`)** so the renderer can `await` the result via
   `ipcRenderer.invoke` (through the preload bridge).
6. **Worker thread for blocking native calls** — DDC reads (200–400 ms each) and PowerShell
   `spawnSync` queries run in a `worker_threads.Worker`. Never on the main thread.

---

## Design System

The visual design mirrors the Claude Code desktop app aesthetic — pure neutral grays, clean and minimal.
All colors use CSS custom properties; **never hardcode colors in components**.

### Color Tokens

```css
/* Reference these in inline styles: style={{ color: 'var(--color-text-primary)' }} */

/* Light mode */
--color-bg:             #F5F5F5   /* Light gray canvas */
--color-surface:        #EBEBEB   /* Sidebar, panel backgrounds */
--color-surface-raised: #E3E3E3   /* Inputs, dropdowns */
--color-text-primary:   #141414   /* Near-black */
--color-text-secondary: #8C8C8C   /* Muted gray */
--color-accent:         #525252   /* Dark gray — the ONLY action color */
--color-border:         #D8D8D8
--color-code-bg:        #E5E5E5   /* Terminal / monospace areas */

/* Dark mode (toggled via data-theme="dark" on <html>) */
--color-bg:             #1C1C1C   /* Dark charcoal */
--color-surface:        #252525
--color-surface-raised: #2C2C2C
--color-text-primary:   #EBEBEB   /* Light gray */
--color-text-secondary: #888888
--color-accent:         #B0B0B0   /* Medium gray in dark mode */
--color-border:         #383838
--color-code-bg:        #252525
```

### Design Rules Summary

- **Pure neutral grays** — no warm or cool undertones.
- **Gray is the only accent** — never orange, never blue, never purple.
- **No heavy shadows** — depth via background color steps, not `box-shadow`.
- **No gradients** — especially no purple/brand gradients.
- **Tailwind for layout/spacing; CSS vars for colors** — never hardcode color hex in components.
- **Font**: `Segoe UI Variable` / `Segoe UI` for UI chrome; `JetBrains Mono` / `Cascadia Code`
  for code, paths, version strings (use `.mono` utility class from `globals.css`).

---

## Sidebar Behaviour

- Default width: **240px** | Min: **180px** | Max: **320px**
- **Collapsed state**: sidebar unmounts entirely — no icon-only strip. The toggle button's icon
  switches between `SidebarOpenIcon` (solid divider) and `SidebarClosedIcon` (dashed divider +
  filled panel region) to communicate state.
- **Peek panel**: hovering the sidebar-toggle button while collapsed shows `FloatingSidebar` — a
  `ReactDOM.createPortal` panel anchored via `getBoundingClientRect()` to the button's position.
  Mouse entering the panel cancels the hide timer; leaving schedules a 180ms hide. Mounted in
  `App.tsx` so it works from both main and settings views.
- Resize handle: 6px-wide invisible div on the right edge of the outer container; turns
  accent-colored on hover. Lives on the **outer** div, not inside the rounded card, so it isn't
  clipped by `border-radius` + `overflow: hidden`.
- During drag: lock `document.body.style.cursor = 'col-resize'` and `userSelect = 'none'`
  to prevent flickering and text selection — restore both in the `mouseup` cleanup.
- Width and collapsed state live in Zustand (`appStore.ts`) — add localStorage persistence later.

## Floating UI Patterns

- **Portal rendering**: any overlay that must escape `overflow: hidden` parents uses
  `ReactDOM.createPortal(element, document.body)` with `position: fixed`.
- **DOM measurements**: use `useRef` + `getBoundingClientRect()` to anchor floating elements.
  Child components that expose a ref must be wrapped in `forwardRef`.
- **Debounce timers shared between siblings**: declare as a module-level variable in the store
  file (`let _timer = null`) — never put a timer ID in Zustand state.
- **Content-sized panels**: use `minHeight` with no `bottom` constraint. A `bottom` value
  stretches the panel to fill the window regardless of content.

## Settings Button

The bottom of the sidebar uses a chip-style button (not a plain nav row):
- Left: small icon inside a `rounded-md` badge (`--color-border` bg → `--color-accent` when active)
- Center: label text
- Right: chevron-down indicator
- Border: `1px solid var(--color-border)` gives it the contained/selector look

---

## Service System

### Overview

Background services run as Python subprocesses managed by `ServiceManager` (main process).
Each service is a Python script in `resources/services/` that communicates exclusively via
newline-delimited JSON on **stdout**. Stderr is forwarded as error-level log entries.

Native services (DDC, Sonar) are registered differently via `registerNativeService()` — they run
in the main process but follow the same start/stop lifecycle contract.

### Message Protocol (Python → Electron)

Every line written to stdout must be a valid JSON object with a `type` field:

```json
{ "type": "log",         "level": "info|warn|error", "message": "..." }
{ "type": "connected",   "data": { ...ArctisState fields... } }
{ "type": "disconnected" }
{ "type": "event",       "event": "EventClassName",  "data": { ... } }
{ "type": "fatal",       "message": "..." }
```

`fatal` causes the process to call `sys.exit(1)` — use it only for unrecoverable errors
(e.g. missing Python package). `log` entries appear in the About page terminal log.

### Adding a New Service

1. Create `resources/services/<id>_service.py` following the JSON message protocol above.
   Use an internal reconnect loop so the process stays alive across device disconnects.
2. Add an entry to `SERVICE_DEFS` in [serviceManager.ts](src/main/services/serviceManager.ts):
   ```typescript
   { id: 'my-service', name: 'My Service', description: '...', script: 'my_service.py' }
   ```
3. Add any device-specific IPC channels to `IPC_CHANNELS` in [shared/types.ts](src/shared/types.ts).
4. Handle the new message types in `ServiceManager.handleMessage()`.
5. Expose new IPC channels through [preload/index.ts](src/preload/index.ts) and declare them
   in [electron.d.ts](src/renderer/src/types/electron.d.ts).
6. Subscribe to the new IPC push events in `App.tsx` and update the relevant Zustand store.

### Service Config Persistence

`ServiceManager` persists its config to `app.getPath('userData')/services.json`:

```json
{
  "pythonPath": "python",
  "services": {
    "arctis-hid": true
  }
}
```

`pythonPath` is the executable used for all Python services (configurable in General Settings).
Each service id maps to a boolean (enabled/disabled). Defaults: all enabled, `pythonPath = "python"`.

### Renderer-side Service State

`serviceStore.ts` (Zustand) holds:
- `services: ServiceInfo[]` — populated on startup via `window.api.servicesList()`, kept live
  via `onServicesStateChange` push events.
- `logs: LogEntry[]` — up to 500 entries, displayed in the About page terminal log.
- `arctisState: ArctisState | null` — `null` when headset is disconnected.
- `ddcMonitors: DdcMonitor[]` — current DDC monitor list.
- `settings: AppSettings` — loaded on startup, kept live via settings change push.

All IPC subscriptions are wired in `App.tsx` via `useEffect` so they're active globally.

---

## Arctis Nova Pro HID Service

**Package**: [`arctis_nova_pro_hid`](https://github.com/hardtekpt/arctis_nova_pro_hid/tree/development)
(import name: `arctis_hid`) — direct USB HID control, no SteelSeries GG required.
Full API reference: [DOCUMENTATION.md](https://github.com/hardtekpt/arctis_nova_pro_hid/blob/development/src/package/DOCUMENTATION.md)

**Script**: [resources/services/arctis_hid_service.py](resources/services/arctis_hid_service.py)

**Behaviour**:
- Calls `discover()` to find the headset; on `DeviceNotFoundError` emits `disconnected` and
  retries every 3 seconds.
- On connect: reads initial state via `get_status()` + `get_mic_eq()`, emits `connected` with
  the full `ArctisState` snapshot, then calls `listen()` (blocks, fires event callbacks).
- On `DeviceIOError` (USB pulled): emits `disconnected`, closes handles, sleeps 2 s, retries.
- Subprocess stays alive indefinitely — it only exits on `fatal` (missing package).
- Supports write commands via stdin JSON: volume, ANC mode, mic mute, sidetone.

**ArctisState shape** (shared type in `types.ts`):
```typescript
{ batteryHeadset: number, batteryDock: number, ancMode: 'OFF'|'TRANSPARENCY'|'ANC',
  micMuted: boolean, volume: number, wirelessConnected: boolean, btConnected: boolean,
  sidetone: 'OFF'|'LOW'|'MEDIUM'|'HIGH' }
```

**Events handled** (update `arctisState` in `serviceStore` via `updateArctisState`):
`VolumeEvent`, `BatteryEvent`, `AncModeEvent`, `MicMuteEvent`, `ConnectivityEvent`,
`SidetoneEvent`, `ChatMixEvent`

**Home page widget**: `CompactHeadsetCard` in [components/home/](src/renderer/src/components/home/)
mounts/unmounts automatically based on `arctisState !== null`.

---

## DDC/CI Display Control Service

**Why native service instead of Python subprocess?** DDC/CI calls are Windows-only via
`@hensm/ddcci`. Native registration simplifies the caching layer and state management — no
subprocess protocol overhead.

> **Important**: DDC calls are synchronous and slow (200–400 ms per call) and the PowerShell
> queries used to map device paths block for seconds. All of this runs in a dedicated
> `worker_threads` Worker so the main process event loop is never blocked. Do **not** move these
> operations back to the main thread.

**Package**: [`@hensm/ddcci`](https://www.npmjs.com/package/@hensm/ddcci) — Windows DDC/CI library.
Add to `package.json` with `electron-builder` ASAR unpack config:
```json
"@hensm/ddcci": "*",
"build": { "asarUnpack": ["**/node_modules/@hensm/ddcci/**"] }
```

**Key API**:
- `getMonitorList(): string[]` — array of device paths (e.g., `"\\\\?\\DISPLAY#...\\Monitor#1"`)
- `getBrightness(devicePath: string): number` — 0–100
- `setBrightness(devicePath: string, value: number): void`
- `_getVCP(devicePath: string, code: number): number[]` — raw VCP value (used for input source)
- `_setVCP(devicePath: string, code: number, value: number): void` — raw VCP write

**VCP codes** (Virtual Control Panel codes per DDC-CI spec):
- `0x10` — brightness
- `0x12` — contrast
- `0x60` — input source (values: `0x01`–`0x04` VGA/DVI, `0x0f`–`0x10` DisplayPort, `0x11`–`0x12` HDMI, `0x1b` USB-C)

**Worker thread architecture** (`src/main/services/apis/ddc/`):

Two files work together:

- **`ddcWorker.ts`** — runs in a `worker_threads` Worker. Contains all blocking work: the two
  PowerShell `spawnSync` queries (primary display detection via `EnumDisplayDevices`, GDI device
  map) and all `ddcci` native calls. Communicates via `parentPort` messages.
- **`service.ts`** — thin async wrapper. Spawns the worker on `start()`, posts messages, and
  resolves Promises when the worker responds. Maintains `devicePaths` and `cachedMonitors` locally,
  updated after each `refreshDone`/`setPrimaryDone` response.

Worker message protocol (main → worker):
```typescript
{ id: number; type: 'refresh' }
{ type: 'setBrightness'; devicePath: string; value: number }   // fire-and-forget
{ type: 'setInputSource'; devicePath: string; vcpCode: number } // fire-and-forget
{ id: number; type: 'setPrimary'; monitorId: number; multiMonitorToolPath: string }
```

Worker message protocol (worker → main):
```typescript
{ type: 'refreshDone';    id: number; monitors: DdcMonitor[]; devicePaths: [number, string][] }
{ type: 'setPrimaryDone'; id: number; monitors: DdcMonitor[]; devicePaths: [number, string][] }
{ type: 'error';          id: number; message: string }
{ type: 'log';            level: 'info'|'warn'|'error'; message: string }
```

Async requests use a `pendingCallbacks: Map<id, { resolve, reject }>` in the service — post the
message with an `id`, store the callbacks, resolve/reject when the matching response arrives.

**Adding the worker as a build entry** (`electron.vite.config.ts`):
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
This compiles the worker to `out/main/ddcWorker.js` alongside `out/main/index.js`. Reference it
at runtime with `join(__dirname, 'ddcWorker.js')`.

**DdcService public API** (`src/main/services/apis/ddc/service.ts`):
- `start() / stop()` — spawns/terminates the worker
- `refreshMonitors(): Promise<DdcMonitor[]>` — non-blocking; resolves when worker finishes
- `setBrightness(monitorId, value)` — posts to worker + optimistic cache update
- `setInputSource(monitorId, inputValue)` — posts to worker + optimistic cache update
- `setPrimaryMonitor(monitorId, toolPath): Promise<void>` — delegates to worker
- `getCachedMonitors(): DdcMonitor[]` — synchronous; returns last known state
- `isAvailable(): boolean` — true if worker is running
- `setLogEmitter(fn)` / `setStateChangedCallback(fn)` — wiring hooks

**DdcMonitor interface** (shared type in `types.ts`):
```typescript
export interface DdcMonitor {
  monitor_id: number                 // 1-indexed
  name: string                       // extracted from device path
  brightness: number                 // 0–100
  contrast: number                   // 0–100
  input_source: string               // hex like "0x11" (lowercase)
  available_inputs: string[]         // sorted list of detected input codes
  supports: string[]                 // ['brightness', 'contrast', 'input_source']
  is_primary: boolean                // detected via EnumDisplayDevices Win32 API
}
```

**Primary display detection**:
- PowerShell script uses `EnumDisplayDevices` with `EDD_GET_DEVICE_INTERFACE_NAME` flag, returning
  the same `\\?\DISPLAY#...` path format that `@hensm/ddcci` produces — enabling reliable matching.
- Script must be written to a temp `.ps1` file and run with `-File` (not `-Command`) because the
  PowerShell `@'...'@` here-string requires its closing marker at column 0 in the source file.

**Primary display switching**:
- NirCmd's `setprimarydisplay <adapterName>` is called with the cached adapter name from the last
  `EnumDisplayDevices` run (e.g. `\\.\DISPLAY2`).
- No UAC elevation required — modifies per-user display settings.
- NirCmd path resolves via `app.isPackaged` check at runtime.

**IPC channels**:
- `DDC_GET_MONITORS` — invoke to get monitors (forces refresh if cache >60s old)
- `DDC_SET_BRIGHTNESS` — invoke(monitorId, value) — queued + coalesced
- `DDC_SET_INPUT_SOURCE` — invoke(monitorId, inputValue) — direct write + refresh
- `DDC_SET_PRIMARY_MONITOR` — invoke(monitorId) — calls NirCmd + refresh
- `DDC_UPDATE` — push event (broadcast on state change or periodic poll)

**Smart refresh strategy** (minimize slow DDC calls):
1. **Startup**: after `serviceManager.startAll()`, schedule refresh with 5 retries (5s delays)
2. **Navigation**: `App.tsx` refreshes when navigating to home page or DDC settings tab
3. **Periodic**: configurable interval (default 60s)
4. **Post-change**: refresh after `setBrightness` or `setInputSource` to read back actual values
5. **Cache**: return cached data if <60s old; otherwise refresh

**DisplayCard component** (`src/renderer/src/components/home/DisplayCard.tsx`):
- **Props**: `monitor: DdcMonitor`
- **Local state**:
  - `draftBrightness: number | null` — user's slider drag value (optimistic UI)
  - `lockedUntilRef: useRef<number>` — timestamp to ignore stale `DDC_UPDATE` events during drag
- **Brightness slider**:
  - `onChange` → update draft only (visual feedback without waiting for hardware)
  - `onPointerUp` / `onKeyUp('Enter'|' ')` → fire IPC + clear draft after 1200ms lock
  - Display value = `draftBrightness ?? monitor.brightness` (draft takes precedence)
- **Input selector**: dropdown showing `available_inputs`, calls `window.api.ddcSetInputSource`
- **Primary badge**: shown when `monitor.is_primary`; "Set as primary" button otherwise
- **Pattern**: write-lock prevents echoed `DDC_UPDATE` from clobbering user's in-flight drag

**Input source mapping** (case-insensitive lookup via `INPUT_NAME_MAP: Record<string, string>`):
- Keys are lowercase hex: `'0x01'`, `'0x02'`, `'0x0f'`, etc.
- Values: `'VGA 1'`, `'DVI 1'`, `'DisplayPort 1'`, `'HDMI 1'`, `'USB-C'`
- Padding: always `padStart(2, '0')` and `.toLowerCase()` on hex strings to ensure consistency

**Architectural lessons**:
1. **Worker thread for blocking native calls**: DDC reads (200–400 ms each) and PowerShell
   `spawnSync` queries (up to 10 s) run in a `worker_threads` Worker.
2. **electron-vite worker build entries**: worker files need a separate rollup `input` entry in
   `electron.vite.config.ts` so they compile to their own `.js` file alongside `index.js`.
3. **Promise map for async worker communication**: post a message with a unique `id`, store
   `{ resolve, reject }` in a `Map<id, callbacks>`, resolve/reject when the matching reply arrives.
4. **Optimistic UI**: local draft state in DisplayCard + write-lock pattern avoids flashing
   old values when echoed updates arrive from the backend.
5. **Command coalescing**: rapid slider drags produce many `DDC_SET_BRIGHTNESS` calls. Queue
   + `setImmediate` ensures we only write to hardware once per gesture, not once per tick.
6. **Input discovery**: Rather than querying monitor capabilities (slow + unreliable), use a
   fixed list of common input codes. Always include the current input in `available_inputs`.
7. **PowerShell here-string delivery**: must use a temp `.ps1` file with `-File` flag — the
   `@'...'@` closing marker must be at column 0 which only works in a real file, not `-Command`.

---

## GG Sonar Integration

**Service**: `src/main/services/sonarService.ts` — Node.js HTTP polling client (no subprocess).

**Discovery**: `GET https://127.0.0.1:6327/subApps` (HTTPS, `rejectUnauthorized: false`) →
parse `subApps.sonar.metadata.webServerAddress` for the dynamic Sonar HTTP port.
The port changes on every GG restart; discovery is retried on every failed poll.

**Polling strategy**:
- **Fast poll (1s)**: `/mode`, `/volumeSettings/classic`, `/volumeSettings/streamer`, `/chatMix`
- **Slow poll (5s)**: `/configs`, `/configs/selected`, `/AudioDeviceRouting`,
  `/audioDevices`, `/classicRedirections`, `/streamRedirections`
- On failure: clear `baseUrl`, set `available: false`, retry discovery on next poll cycle.

**Write commands** (all optimistic — update local state first, then send HTTP):
- `PUT /volumeSettings/classic/{channelKey}/Volume/{value}` — volume (0.0–1.0)
- `PUT /volumeSettings/classic/{channelKey}/Mute/{true|false}` — mute
- `PUT /volumeSettings/streamer/{mix}/{channelKey}/volume/{value}` — streamer volume
- `PUT /configs/{configId}/select` — activate preset for a channel
- `PUT /mode/{classic|stream}` — mode switch
- `PUT /classicRedirections/{channelDictKey}/deviceId/{deviceId}` — channel redirection

**Important channel key distinction** — Sonar uses three different key formats:

| Channel | JSON/devices key | HTTP volume path key | ChannelDict (redirection path) |
|---|---|---|---|
| Master | `masters` | `Master` | `master` |
| Game | `game` | `game` | `game` |
| Chat (render) | `chatRender` | `chatRender` | `chat` |
| Mic (capture) | `chatCapture` | `chatCapture` | `mic` |
| Media | `media` | `media` | `media` |
| Aux | `aux` | `aux` | `aux` |

**Preset limitations**: The Sonar HTTP API only supports reading + selecting presets.
Creating, editing, and deleting presets must be done via the SteelSeries GG application.
Only `PUT /configs/{configId}/select` is writable; no POST/DELETE/edit endpoints exist.
Source: [SteelSeries-NET-API](https://github.com/DataNext27/SteelSeries-NET-API)

**IPC channels**:
```
SONAR_GET_STATE, SONAR_STATE_CHANGE, SONAR_SET_VOLUME, SONAR_SET_MUTE,
SONAR_SELECT_PRESET, SONAR_SET_MODE, SONAR_GET_POLLING_CONFIG, SONAR_SET_POLLING_CONFIG,
SONAR_SET_REDIRECTION, SONAR_ROUTE_PROCESS, SONAR_REFRESH_DEVICES
```

**Renderer state** (`sonarStore.ts`):
```typescript
interface SonarStoreState {
  sonarState: SonarState | null       // null until first successful poll
  activePresetIds: Record<string, string>  // virtualAudioDevice -> configId
}
```

---

## Preset Auto-Switcher & App-Triggered Actions

**Service**: `src/main/services/activeWindowMonitor.ts`

Polls the Windows foreground window at a 500ms interval. When the active process name matches
a `PresetSwitcherRule`, fires zero or more actions:
- Optionally switch a GG Sonar preset for a channel
- Optionally change monitor input sources via DDC/CI

**Manual override tracking**: when the user manually selects a preset in the GG Sonar page,
the switcher records this and skips re-applying auto-presets for that channel until the
foreground app changes away and back. Monitor actions are one-shot per rule per app focus
(cleared on app change).

**IPC channels**:
```
ACTIVE_WINDOW_CHANGE, ACTIVE_WINDOW_GET_OPEN_APPS,
PRESET_SWITCHER_GET_RULES, PRESET_SWITCHER_SET_RULES,
PRESET_SWITCHER_GET_ENABLED, PRESET_SWITCHER_SET_ENABLED, PRESET_SWITCHER_ENABLED_CHANGE
```

**Rule structure** (`PresetSwitcherRule` in `types.ts`):
```typescript
{
  id: string
  appProcessName: string                    // Windows process name (no .exe)
  displayName: string                       // Shown in UI
  enabled: boolean
  channel?: string                          // SonarConfig.virtualAudioDevice (optional)
  presetId?: string                         // SonarConfig.id (optional)
  monitorActions?: MonitorInputAction[]     // DDC/CI input switches (optional)
}

// Monitor action: sets display input on focus
interface MonitorInputAction {
  monitorId: number   // DdcMonitor.monitor_id
  inputValue: string  // hex string, e.g. "0x11" (HDMI 1)
}
```

A rule must have **at least one action** (Sonar preset or monitor action). A rule can have both.

**UI**: `src/renderer/src/components/gg-sonar/PresetSwitcherSection.tsx`
- Add Rule form has two optional sections: **Sonar preset** (channel + preset dropdowns) and
  **Monitor inputs** (accumulate multiple input switches).
- Existing rules display both types of actions in summary form with icons (🔊 for Sonar, 🖥️ for monitor).
- Rules can be enabled/disabled or deleted.

---

## Keyboard Shortcuts System

**Pages**: `src/renderer/src/pages/Shortcuts.tsx` — the main UI
**Store**: `src/renderer/src/stores/shortcutStore.ts` — Zustand state for shortcuts list
**Dispatcher**: `src/main/shortcuts/dispatcher.ts` — execution engine for shortcut actions
**Registry**: `src/main/shortcuts/shortcutRegistry.ts` — global + app-focused hotkey registration
**Catalog**: `src/renderer/src/lib/shortcuts/catalog.ts` — action definitions and metadata

### Overview

Users define **Shortcuts** — keyboard combinations bound to **Actions**. Actions span hardware
control (headset volume, display brightness), Sonar preset selection, monitor input switching,
preset auto-switcher toggles, and notifications.

**Shortcut scope**:
- **global**: fired in all contexts (wired to `registerGlobalShortcuts()` via `globalShortcut.register()`)
- **focused**: fired only when the app window has focus (event listeners on the renderer)

### Shortcut interface (`src/shared/types.ts`)

```typescript
export interface Shortcut {
  id: string
  actionId: string              // Identifies the action (e.g. 'headset.volume.up')
  value?: string | number       // Optional parameter (e.g. volume delta, preset ID)
  keys: string[]                // Key combo, e.g. ['ctrl', 'shift', 'a']
  scope: ShortcutScope          // 'global' | 'focused'
  enabled: boolean
}
```

### Action Catalog

Actions are declared in `src/renderer/src/lib/shortcuts/catalog.ts` with:
- `id`: unique identifier
- `label`: display name
- `cat`: category ('headset', 'display', 'sonar', 'switcher', etc.)
- `schema`: optional validator for the `value` parameter (e.g. enum of preset IDs)
- `valueLabel`: UI label for the parameter field (e.g. "Delta" for volume)

Example categories:
- **Headset**: volume up/down, mute, ANC mode, sidetone level
- **Display**: brightness up/down, input source select, primary monitor set
- **Sonar**: channel volume, mute, preset select, mode switch
- **Preset Switcher**: enable/disable auto-switcher
- **Notifications**: toggle notification types

### Dispatcher Flow

**Global scope** (main process):
1. User defines a global shortcut (e.g. `Ctrl+Alt+V` → "headset volume up")
2. `src/main/shortcuts/shortcutRegistry.ts` registers it with `globalShortcut.register()`
3. On key press, the handler calls `initDispatcher()`'s `dispatch(shortcut)` function
4. Dispatcher resolves action type and invokes the appropriate service method (e.g. `arctisService.setVolume()`)

**Focused scope** (renderer):
1. Keyboard event fires on the renderer window
2. `Shortcuts.tsx` uses a `keydown` listener to detect key combos
3. Matches combo against `items` in `shortcutStore`
4. Finds matching focused shortcut and calls `window.api.shortcutsDispatch(actionId, value)`
5. Main process dispatcher receives it and executes

### Shortcut Persistence

Shortcuts are persisted to `app.getPath('userData')/shortcuts.json`:

```json
[
  {
    "id": "uuid",
    "actionId": "headset.volume.up",
    "value": 5,
    "keys": ["ctrl", "alt", "up"],
    "scope": "global",
    "enabled": true
  }
]
```

**Conflict detection**: `shortcutStore.findConflict(combo, excludeId?)` checks if a key combo
is already bound (ignores disabled shortcuts). Called before saving a new shortcut.

### UI Pattern

**Shortcuts page**:
- Search + filter chips by category
- Editable rows showing keybind, action label, value (if any)
- Click to edit: opens an inline form with key recorder + action/value dropdowns
- Delete button per row

**Key recorder**: listens for a single key press, normalizes to `['ctrl', 'shift', 'a']` format.
Handles system keys (Enter, Escape, Delete) and ignores modifiers-only presses.

### Adding a New Action

1. Add entry to `ACTIONS` in `src/renderer/src/lib/shortcuts/catalog.ts`:
   ```typescript
   {
     id: 'myaction.foo',
     label: 'My Action Label',
     cat: 'headset',
     schema: { type: 'enum', values: ['val1', 'val2'] },  // or omit for no-param actions
     valueLabel: 'Option'
   }
   ```
2. In `src/main/shortcuts/dispatcher.ts`, add a case to `dispatch()` that calls the service:
   ```typescript
   case 'myaction.foo':
     serviceManager.getService('my-service').foo(value as string)
     break
   ```
3. If it's a **global** action that needs main-process handling, ensure the dispatcher case is covered.
4. If it's a **focused** action only, the renderer-side dispatch is sufficient.

### Validation Rules

- **Conflict detection**: no two enabled shortcuts may use the same key combo (per scope).
- **Scope isolation**: focused shortcuts take precedence in the renderer; global shortcuts fire regardless.
- **Disabled shortcuts**: do not reserve key combos; conflicts are only with enabled shortcuts.

---

## Notification System

### Two Surfaces

The app uses two parallel notification surfaces. The OS `Notification` API is intentionally
avoided — it creates Action Center entries, loses styling control, and causes focus interruptions.

### Surface 1: System Notifications

**File**: `src/main/services/notifications/windowService.ts`

Used for informational messages (service errors, preset failures, debug messages).

- Each call spawns a **new** `BrowserWindow` (340×108 px, frameless, transparent, `alwaysOnTop`,
  non-focusable, skip taskbar).
- HTML content is built as an inline string and loaded via `loadURL('data:text/html,...')` —
  no React, no IPC round-trip.
- `setIgnoreMouseEvents(true)` — purely visual, never steals focus.
- `setTimeout` auto-closes using `notificationTimeout` from settings (enforced ≥ 2s).
- `relayout()` stacks windows top-right, 12px from work area edge, 10px gap, collapses on close.
- `escapeHtml()` is applied to all user-visible strings before embedding in HTML (XSS prevention).

### Surface 2: Hardware OSD Overlays

A persistent `BrowserWindow` loads `notification.html` which mounts `NotificationOverlay.tsx`.
This React component receives `SerializedNotification` objects and manages a visible stack.

**How notifications fire** (renderer-driven flow):
1. Hardware event arrives in `App.tsx` (e.g. `ARCTIS_EVENT` push from main process).
2. `App.tsx` calls the appropriate function from `notifyFromEvent.ts`.
3. `notifyFromEvent.ts` reads notification settings from `serviceStore` and calls
   `window.api.notifPush(spec)`.
4. Main process receives `NOTIF_PUSH`, forwards to the OSD BrowserWindow.
5. `NotificationOverlay.tsx` adds the notification to its stack with the given TTL.

**Notification shapes** (`SerializedNotification.kind`):
- `'circle'` — icon only (small square)
- `'ring'` — icon + circular progress arc (0–100 value)
- `'volume'` — icon + horizontal bar + label (wide pill)
- `'rect'` — icon + title + optional subtitle + optional tail text

**Key deduplication**: each notification has a `key` string. A new notification with the same
`key` replaces any currently-visible notification with that key — no stacking for the same event.
Example: `'headset-volume'` — scrolling replaces rather than piles up.

**TTL**: `ttl` field in milliseconds. Notifications are removed when their TTL expires.

**Timer management** (`src/main/services/notifications/timerService.ts`): a `Map<key, Timeout>`.
Calling `schedule(key, delay, cb)` **replaces** any existing timer for that key, so rapid events
extend the timeout rather than stacking closures.

**OSD position**: center-bottom of the primary display (above taskbar), matching system volume
overlays. Respects `screen.getPrimaryDisplay().workAreaSize`.

**Adding a new OSD notification**:
1. Add a `notifyXxx()` function to `notifyFromEvent.ts` — check settings, call `push(spec)`.
2. Add the notification config type to `AppSettings.notifications` in `types.ts`.
3. Add the corresponding UI toggle/shape selector to `NotificationsSettings.tsx`.
4. Wire the call from the appropriate IPC subscription in `App.tsx`.

---

## Persisting User-Configurable Settings

**All user-configurable settings must use the global `AppSettings` system** — never add a local
"Save" button to a settings page. The global Save button in the settings layout handles all saves.

### AppSettings (`src/shared/types.ts`)

Add new fields to the `AppSettings` interface and a default in `DEFAULT_SETTINGS`. The file is
persisted to `app.getPath('userData')/settings.json` and loaded/saved via `SETTINGS_GET` /
`SETTINGS_SET` IPC channels.

```typescript
// In AppSettings interface:
myNewSetting: number

// In DEFAULT_SETTINGS:
myNewSetting: 42
```

If the new setting requires the main process to react immediately (e.g. restart a timer), add a
dedicated `MY_FEATURE_SET_FOO` IPC channel that writes to `settings.json` itself and applies the
change. The IPC handler should call `loadAppSettings()`, update the field, write back, then apply.

### Settings page pattern (`useSettingsForm` context)

Every settings page must use the `useSettingsForm()` context from
`src/renderer/src/contexts/settingsFormContext.tsx`:

```typescript
const { setDirty, registerSave } = useSettingsForm()

// Mark the form dirty whenever a draft value differs from the saved value
useEffect(() => { setDirty(draftValue !== savedValue) }, [draftValue, savedValue, setDirty])

// Register the save handler — re-register whenever draft values change
useEffect(() => {
  registerSave(async () => {
    const current = await window.api.getSettings()
    await window.api.setSettings({ ...current, myNewSetting: draftValue })
    setSavedValue(draftValue)
  })
  return () => registerSave(null)
}, [draftValue, registerSave])
```

If the setting goes through a dedicated IPC channel rather than `setSettings`, call that instead
inside `registerSave`.

**Never add a local Save/Apply button to a settings page.** The global button is the only save trigger.

---

## Adding a New Page / Section

1. Add a new `NavItemDef` entry to the `MAIN_NAV` array in [Sidebar.tsx](src/renderer/src/components/layout/Sidebar.tsx).
2. Add the `id` to the `AppView` union in [shared/types.ts](src/shared/types.ts).
3. Create a page component in `src/renderer/src/pages/`.
4. Add a case in [MainContent.tsx](src/renderer/src/components/layout/MainContent.tsx).

**Important**: `FloatingSidebar.tsx` duplicates the nav item list and must always be updated
in sync with `Sidebar.tsx`. See the feedback memory for the floating-sidebar sync rule.

---

## Adding a New Settings Tab

1. Add the tab id to `SettingsTab` union in [shared/types.ts](src/shared/types.ts).
2. Add an entry to `SETTINGS_NAV` in [SettingsSidebar.tsx](src/renderer/src/components/settings/SettingsSidebar.tsx).
3. Create a page in `src/renderer/src/pages/settings/`.
4. Add a case in [SettingsLayout.tsx](src/renderer/src/components/settings/SettingsLayout.tsx).

---

## Adding a New IPC Channel

1. Add the channel name to `IPC_CHANNELS` in [shared/types.ts](src/shared/types.ts).
2. Add `ipcMain.handle(IPC_CHANNELS.YOUR_CHANNEL, handler)` in [main/index.ts](src/main/index.ts).
3. Expose a method in [preload/index.ts](src/preload/index.ts) via `contextBridge`.
4. Declare the method on the `Window['api']` interface in [electron.d.ts](src/renderer/src/types/electron.d.ts).

---

## Git Workflow

- **`master`** — stable, production-ready snapshots
- **`development`** — integration branch; all features merge here first
- **Feature branches** — `feat/<name>` branched from `development`; merged back via `--no-ff`
- **Docs branches** — `docs/<name>` for documentation-only changes

Commit format: `type: short description` where type is `feat`, `fix`, `chore`, `docs`, `refactor`.

**Auto-commit:** After completing any set of code changes, commit them to the current branch
immediately without waiting for the user to ask. Stage only the files that were modified as part
of the task — never include `.claude/`, `tsconfig.*.tsbuildinfo`, or other build/tooling artifacts.

---

## Running the App (once `npm install` is done)

```powershell
npm install          # Install all dependencies
npm run dev          # Start Electron with Vite HMR (renderer hot-reloads on save)
npm run build        # Build all processes for production
npm run package      # Build + package as Windows installer
npm run typecheck    # TypeScript validation without a full build
```

The Arctis HID service requires the `arctis_hid` Python package. Install it with:
```powershell
python -m pip install git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development
```
If you use a non-default Python environment, set the executable path in **General Settings → Services → Python executable**.

---

## Known Gaps / Next Steps

- [ ] Sidebar width + collapsed state not persisted — wire up `localStorage` or `electron-store`
- [ ] JetBrains Mono loaded from Google Fonts — bundle the font files for offline use
- [ ] `FloatingSidebar` and `Sidebar` duplicate nav item definitions — extract shared `MAIN_NAV`
      and icon components into a `src/renderer/src/components/layout/nav.tsx` shared module
- [ ] HeadsetCard updates on events only — add periodic state polling for initial sync on late attach
- [ ] Arctis write commands — full EQ and sidetone adjustment UI still TBD
- [ ] Service log in About tab not clearable — add a Clear button
- [ ] Home page has no empty state when no devices are connected (Audio section shows blank)
- [ ] Auto-updater (`electron-updater`) not configured — needs a release server URL
- [ ] No test suite yet — add Vitest for renderer, Vitest + mocks for main process services
- [ ] GG Sonar: chatMix balance control not exposed in UI
- [ ] GG Sonar: stream monitoring toggle not exposed in UI
- [ ] Settings chevron in sidebar is decorative — could navigate directly to settings
