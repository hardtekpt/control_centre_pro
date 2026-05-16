# Control Centre Pro — Claude Code Reference

## What This App Is

**Control Centre Pro** is a Windows desktop application for managing hardware devices and running
custom background services. Think of it as a personal control panel: monitor connected devices,
start/stop services, and get at-a-glance status for everything running on the machine.

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
└── services/             # Python service scripts (spawned as subprocesses by main process)
    └── arctis_hid_service.py

src/
├── main/               # Node.js (Electron main process)
│   ├── index.ts        # Window creation, IPC handlers, app lifecycle
│   └── services/
│       └── serviceManager.ts  # Spawns/monitors Python subprocesses, routes events to renderer
├── preload/
│   └── index.ts        # contextBridge — exposes window.api to the renderer
├── shared/
│   └── types.ts        # IPC channel names + shared TS interfaces (imported by both sides)
└── renderer/           # Browser (React)
    ├── index.html
    └── src/
        ├── App.tsx               # Theme, window state sync, IPC event subscriptions
        ├── main.tsx              # ReactDOM entry
        ├── stores/
        │   ├── appStore.ts       # Zustand: currentView, sidebarCollapsed, theme, etc.
        │   └── serviceStore.ts   # Zustand: services list, log entries, ArctisState
        ├── types/electron.d.ts   # window.api type declarations for TS
        ├── styles/globals.css    # CSS tokens + Tailwind base
        ├── components/
        │   ├── layout/           # TopBar, Sidebar, MainLayout, MainContent
        │   ├── settings/         # SettingsLayout, SettingsSidebar
        │   └── home/             # HeadsetCard (and future home dashboard widgets)
        └── pages/
            ├── Home.tsx          # Dashboard — Audio section with HeadsetCard
            └── settings/
                ├── GeneralSettings.tsx   # Appearance + Services (Python path, enable/disable)
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

---

## Design System

The visual design mirrors the Claude Code desktop app aesthetic — neutral and clean. All colors
use CSS custom properties; **never hardcode colors in components**.

### Color Tokens

```css
/* Reference these in inline styles: style={{ color: 'var(--color-text-primary)' }} */

/* Key light-mode tokens */
--color-bg:             #F5F5F5   /* Light gray canvas */
--color-surface:        #EBEBEB   /* Sidebar, panel backgrounds */
--color-surface-raised: #E3E3E3   /* Inputs, dropdowns */
--color-text-primary:   #141414   /* Near-black */
--color-text-secondary: #8C8C8C   /* Muted gray */
--color-accent:         #525252   /* Dark gray — the ONLY action color */
--color-border:         #D8D8D8
--color-code-bg:        #E5E5E5   /* Terminal / monospace areas */

/* Key dark-mode tokens (toggled via data-theme="dark" on <html>) */
--color-bg:             #1C1C1C   /* Dark charcoal */
--color-surface:        #252525
--color-surface-raised: #2C2C2C
--color-text-primary:   #EBEBEB   /* Light gray */
--color-text-secondary: #888888
--color-accent:         #B0B0B0   /* Medium gray accent in dark mode */
--color-code-bg:        #252525
```

### Design Rules Summary

- **Pure neutral grays** — no warm or cool undertones.
- **Gray is the only accent** — never orange, never blue, never purple.
- **No heavy shadows** — depth is created by background color steps, not `box-shadow`.
- **No gradients** — especially no purple gradients.
- **Tailwind for layout/spacing; CSS vars for colors** — never hardcode color hex in components.
- **Font**: `Segoe UI Variable` / `Segoe UI` for UI chrome; `JetBrains Mono` / `Cascadia Code`
  for code, paths, version strings (use `.mono` utility class from globals.css).

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

### Message Protocol (Python → Electron)

Every line written to stdout must be a valid JSON object with a `type` field:

```json
{ "type": "log",         "level": "info|warn|error", "message": "..." }
{ "type": "connected",   "data": { ...ArctisState fields... } }
{ "type": "disconnected" }
{ "type": "event",       "event": "EventClassName",  "data": { ... } }
{ "type": "fatal",       "message": "..." }   // exits the subprocess
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

**ArctisState shape** (shared type in `types.ts`):
```typescript
{ batteryHeadset: number, batteryDock: number, ancMode: 'OFF'|'TRANSPARENCY'|'ANC',
  micMuted: boolean, volume: number }
```

**Events handled** (update `arctisState` in `serviceStore` via `updateArctisState`):
`VolumeEvent`, `BatteryEvent`, `AncModeEvent`, `MicMuteEvent`

**Home page widget**: `HeadsetCard` in [components/home/HeadsetCard.tsx](src/renderer/src/components/home/HeadsetCard.tsx)
mounts/unmounts automatically based on `arctisState !== null`.

---

## DDC/CI Display Control Service

**Why native service instead of Python subprocess?** DDC/CI calls are synchronous and relatively fast
(200–400 ms each), so blocking Node.js threads is acceptable. Native registration simplifies the
caching layer and state management — no subprocess protocol overhead. Windows-only via `@hensm/ddcci`.

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

**DdcService** (`src/main/services/apis/ddc/service.ts`):
- **Constructor**: tries to load `@hensm/ddcci`; sets `available = false` on error
- **State**:
  - `cachedMonitors: DdcMonitor[]` — persisted across calls
  - `cacheTimestamp: number` — for cache freshness checking
  - `devicePaths: Map<number, string>` — monitorId → device path (stable across polls)
  - `stateChangedCallback: (monitors: DdcMonitor[]) => void` — called whenever cache updates
  - `logEmitter: (level, msg) => void` — wired to the About page terminal log
- **Methods**:
  - `refreshMonitors(): Promise<DdcMonitor[]>` — enumerate, read brightness/contrast/input; update cache; notify callback
  - `setBrightness(monitorId, value)` — write to hardware + update cache
  - `setInputSource(monitorId, inputValue)` — write via VCP code 0x60 + update cache
  - `getInputName(inputHex): string` — map hex codes to friendly names (VGA 1, HDMI 1, etc.)
  - `isAvailable(): boolean` — true if module loaded and service is running
  - `start() / stop()` — service lifecycle

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
}
```

**IPC channels**:
- `DDC_GET_MONITORS` — invoke to get monitors (forces refresh if cache >60s old)
- `DDC_SET_BRIGHTNESS` — invoke(monitorId, value) — queued + coalesced
- `DDC_SET_INPUT_SOURCE` — invoke(monitorId, inputValue) — direct write + refresh
- `DDC_UPDATE` — push event (broadcast on state change or periodic poll)

**Main process architecture** (`src/main/index.ts`):
- Module-level state: `ddcCache`, `ddcCacheTs`, `ddcInFlight` flag, `ddcPollTimer`, `ddcQueue` Map
- **Command queue** (`ddcQueue: Map<monitorId, { value }>`) — coalesces rapid brightness changes
  from slider drags. Called via:
  ```typescript
  ddcQueue.set(monitorId, { value })
  setImmediate(flushDdcQueue)  // batch writes
  ```
- **`refreshDdcMonitors()`** — calls service `refreshMonitors()`, guarded by `ddcInFlight` flag
  to prevent overlapping reads (DDC is slow)
- **`broadcastDdcMonitors()`** — sends `DDC_UPDATE` to all renderer windows
- **`startDdcPolling() / stopDdcPolling()`** — 60s background refresh via `setInterval`

**Smart refresh strategy** (minimize slow DDC calls):
1. **Startup**: after `serviceManager.startAll()`, schedule refresh with 5 retries (5s delays)
2. **Navigation**: `App.tsx` refreshes when navigating to home page or DDC settings tab
3. **Periodic**: 60s interval (configurable in DDC settings, default 60s)
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
- **Layout**: `rounded-lg px-4 py-3` card with monitor name + ID header, feature badges
- **Pattern**: write-lock prevents echoed `DDC_UPDATE` from clobbering user's in-flight drag

**Home page display grid** (`src/renderer/src/pages/Home.tsx`):
```tsx
{ddcMonitors.length > 0 && (
  <HomeSection title="Display">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
      {ddcMonitors.map(m => <DisplayCard key={m.monitor_id} monitor={m} />)}
    </div>
  </HomeSection>
)}
```
Responsive: 2 columns on wide screens, 1 on narrow (CSS `auto-fit` + `minmax`).

**Input source mapping** (case-insensitive lookup via `INPUT_NAME_MAP: Record<string, string>`):
- Keys are lowercase hex: `'0x01'`, `'0x02'`, `'0x0f'`, etc.
- Values: `'VGA 1'`, `'DVI 1'`, `'DisplayPort 1'`, `'HDMI 1'`, `'USB-C'`
- Padding: always `padStart(2, '0')` and `.toLowerCase()` on hex strings to ensure consistency

**Architectural lessons**:
1. **DDC latency**: 200–400 ms per call. Caching + in-flight guard prevents UI hangs from
   overlapping reads. Always guard `ddcInFlight = true/false` around actual refreshes.
2. **Optimistic UI**: local draft state in DisplayCard + write-lock pattern avoids flashing
   old values when echoed updates arrive from the backend.
3. **Command coalescing**: rapid slider drags produce many `DDC_SET_BRIGHTNESS` calls. Queue
   + `setImmediate` ensures we only write to hardware once per gesture, not once per tick.
4. **Input discovery**: Rather than querying monitor capabilities (slow + unreliable), use a
   fixed list of common input codes. Always include the current input in `available_inputs`.
5. **Service callback**: `setStateChangedCallback()` decouples the service from IPC. Main process
   calls `broadcastDdcMonitors()` when the callback fires, keeping renderer in sync without
   explicit polling.

---

## Adding a New Page / Section

1. Add a new `NavItemDef` entry to the `MAIN_NAV` array in [Sidebar.tsx](src/renderer/src/components/layout/Sidebar.tsx).
2. Add the `id` to the `AppView` union in [shared/types.ts](src/shared/types.ts).
3. Create a page component in `src/renderer/src/pages/`.
4. Add a case in [MainContent.tsx](src/renderer/src/components/layout/MainContent.tsx).

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

**Auto-commit:** After completing any set of code changes, commit them to the current branch immediately without waiting for the user to ask. Stage only the files that were modified as part of the task — never include `.claude/`, `tsconfig.*.tsbuildinfo`, or other build/tooling artifacts.

---

## Running the App (once `npm install` is done)

```powershell
npm install          # Install all dependencies
npm run dev          # Start Electron with Vite HMR (renderer hot-reloads on save)
npm run build        # Build all processes for production
npm run package      # Build + package as Windows installer
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
- [ ] Settings (theme choice) not persisted — wire up `electron-store` or `localStorage`
- [ ] Auto-updater (`electron-updater`) not configured — needs a release server URL
- [ ] No test suite yet — add Vitest for renderer, Vitest + mocks for main process services
- [ ] `FloatingSidebar` and `Sidebar` duplicate nav item definitions — extract shared `MAIN_NAV`
      and icon components into a `src/renderer/src/components/layout/nav.tsx` shared module
- [ ] Settings chip chevron currently decorative — could open a settings sub-menu or just navigate
- [ ] HeadsetCard updates on events only — add periodic state polling for initial sync on late attach
- [ ] Arctis service: no write commands wired yet (volume, ANC mode, mute) — UI controls TBD
- [ ] Service log in About tab not clearable — add a Clear button
- [ ] Home page has no empty state when no devices are connected (Audio section shows blank)
