# Control Centre Pro — Developer Guide

## Overview

This guide covers the implementation details, design decisions, and architectural patterns used
in Control Centre Pro. It is intended for developers extending the app or adding new features.

For a quick reference of architecture rules and API details, see [CLAUDE.md](../CLAUDE.md).
For per-feature implementation reports, see the [agents/](../agents/) folder.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [IPC Communication Pattern](#2-ipc-communication-pattern)
3. [State Management](#3-state-management)
4. [Service System](#4-service-system)
5. [DDC/CI Display Control](#5-ddcci-display-control)
6. [GG Sonar Integration](#6-gg-sonar-integration)
7. [Notification System](#7-notification-system)
8. [Settings Persistence](#8-settings-persistence)
9. [UI Patterns](#9-ui-patterns)
10. [Design System](#10-design-system)
11. [Build Configuration](#11-build-configuration)
12. [Adding New Features](#12-adding-new-features)
13. [Known Issues and Errors](#13-known-issues-and-errors)

---

## 1. Architecture Overview

Control Centre Pro is an Electron application split into three processes:

```
Main Process (Node.js)         Renderer Process (React)         OSD Process (React)
src/main/index.ts              src/renderer/src/App.tsx         src/renderer/NotificationOverlay.tsx
                               [main window]                    [notification.html window]
      ↕ IPC (contextBridge)         ↕                                 ↕
src/preload/index.ts           window.api.*                     window.api.*
```

**Main process**: hardware services, IPC handlers, file I/O, window management.
**Renderer process**: React UI, Zustand state, user interactions.
**OSD process**: standalone React renderer for hardware OSD notifications.

The three processes communicate exclusively via typed IPC channels defined in `src/shared/types.ts`.

### Security Boundaries

| Setting | Value | Reason |
|---|---|---|
| `nodeIntegration` | `false` | Prevents renderer from accessing Node.js APIs |
| `contextIsolation` | `true` | Isolates preload from renderer; contextBridge is the only bridge |
| `webSecurity` | `true` (default) | No overrides |

The preload script (`src/preload/index.ts`) is the only surface where the renderer can access
main-process functionality. It exposes a typed `window.api` object via `contextBridge.exposeInMainWorld`.

---

## 2. IPC Communication Pattern

### Channel Constants

All channel names are constants in `src/shared/types.ts`:

```typescript
export const IPC_CHANNELS = {
  DDC_GET_MONITORS: 'ddc:getMonitors',
  DDC_UPDATE: 'ddc:update',
  // ...
} as const
```

Never use string literals for channel names — a typo silently fails. The typed constant fails
at compile time.

### Invoke vs Push

| Pattern | Main side | Renderer side | Use for |
|---|---|---|---|
| **Invoke** (request/response) | `ipcMain.handle(channel, handler)` | `ipcRenderer.invoke(channel, ...args)` | Get data, send commands |
| **Push** (main → renderer) | `webContents.send(channel, data)` | `ipcRenderer.on(channel, handler)` | Real-time state updates |

The preload bridge wraps both patterns into typed methods:

```typescript
// Invoke example
ddcGetMonitors: () => ipcRenderer.invoke(IPC_CHANNELS.DDC_GET_MONITORS),

// Push subscription example (returns unsubscribe function)
onDdcUpdate: (callback) => {
  const handler = (_event: any, monitors: DdcMonitor[]) => callback(monitors)
  ipcRenderer.on(IPC_CHANNELS.DDC_UPDATE, handler)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.DDC_UPDATE, handler)
}
```

### Adding a Channel

1. Add to `IPC_CHANNELS` in `src/shared/types.ts`.
2. Add `ipcMain.handle(...)` in `src/main/index.ts`.
3. Add method to the contextBridge object in `src/preload/index.ts`.
4. Add declaration to `Window['api']` in `src/renderer/src/types/electron.d.ts`.

---

## 3. State Management

### Zustand Stores

| Store | What it holds |
|---|---|
| `appStore.ts` | Current view/page, sidebar width/collapsed state, peek panel state, theme, window maximized |
| `serviceStore.ts` | Service list, log entries, ArctisState, DdcMonitors[], AppSettings |
| `sonarStore.ts` | SonarState (volumes, presets, routing, mode), activePresetIds |
| `notificationStore.ts` | Notification queue and active stack |

All stores use plain Zustand (no middleware). Subscriptions and IPC wiring happen in `App.tsx` via `useEffect`.

### Why Zustand, Not Context

React Context re-renders all consumers when any value changes. For hardware state that updates
frequently (volume, battery), this causes unnecessary renders across the tree. Zustand's
selector pattern (`useStore(state => state.specificField)`) re-renders only the components that
consume a specific field.

### Module-Level Variables for Timers

Debounce timers shared between sibling components (e.g. the peek panel hide timer between
`TopBar` and `FloatingSidebar`) live as module-level variables in the store file:

```typescript
let _peekHideTimer: ReturnType<typeof setTimeout> | null = null

export function schedulePeekHide() {
  _peekHideTimer = setTimeout(() => { /* hide */ }, 180)
}

export function cancelPeekHide() {
  if (_peekHideTimer) clearTimeout(_peekHideTimer)
}
```

Putting timer IDs in Zustand state causes unnecessary re-renders. They are opaque handles
that never need to be reactive.

---

## 4. Service System

### Python Subprocess Services

The `ServiceManager` class (`src/main/services/serviceManager.ts`) spawns Python scripts as
child processes and manages their lifecycle.

**stdout protocol**: every line on stdout must be valid JSON with a `type` field:

```json
{ "type": "log",         "level": "info|warn|error", "message": "..." }
{ "type": "connected",   "data": { ...device state... } }
{ "type": "disconnected" }
{ "type": "event",       "event": "EventClassName",  "data": { ... } }
{ "type": "fatal",       "message": "..." }
```

`fatal` triggers `sys.exit(1)` — only for truly unrecoverable errors like a missing Python package.

**Reconnect loop**: Python services must implement an internal reconnect loop. If the device
disconnects, the service should sleep and retry rather than exiting. The service manager does
not restart a cleanly-exited service.

**stdin commands**: services can optionally read stdin for write commands (e.g. set volume).
Commands are sent as JSON lines: `{ "cmd": "setVolume", "value": 80 }`.

### Native Services

DDC and Sonar are "native services" registered via `serviceManager.registerNativeService()`.
They follow the same start/stop lifecycle as Python services but run as Node.js objects in the
main process instead of subprocesses.

---

## 5. DDC/CI Display Control

Full implementation notes: [agents/DdcFeatureReport.md](../agents/DdcFeatureReport.md)

### Worker Thread Architecture

All blocking DDC calls and PowerShell queries run in a `worker_threads.Worker`. The main thread
posts messages and resolves Promises via a `pendingCallbacks` map keyed by a unique `id`:

```typescript
// Async request (needs a response)
const result = await this.sendRequest({ type: 'refresh' })

// Fire-and-forget (no id, no callback stored)
this.worker.postMessage({ type: 'setBrightness', devicePath, value })
```

The worker needs its own Vite build entry — see [Build Configuration](#11-build-configuration).

### Primary Display Detection

`EnumDisplayDevices` with `EDD_GET_DEVICE_INTERFACE_NAME` returns device interface paths in the
same format as `@hensm/ddcci`, enabling reliable matching. The PowerShell C# P/Invoke script
that calls this must be delivered via a temp `.ps1` file (not `-Command` inline) because
PowerShell here-strings require the closing `'@` at column 0.

### Optimistic UI + Write Lock

`DisplayCard.tsx` maintains a local `draftBrightness` and a `lockedUntilRef` timestamp. When
the user releases the slider, the lock is set for 1200ms. During the lock window, incoming
`DDC_UPDATE` broadcasts are ignored — this prevents the hardware echo from clobbering the
user's value while the DDC write is in flight.

---

## 6. GG Sonar Integration

Full implementation notes: [agents/GGSonarImplementation.md](../agents/GGSonarImplementation.md)
Full REST API reference: [agents/GGSonarHttpRestApi.md](../agents/GGSonarHttpRestApi.md)

### Discovery

```
GET https://127.0.0.1:6327/subApps
→ subApps.sonar.metadata.webServerAddress  (e.g. "http://127.0.0.1:58748")
```

The port is dynamic — it changes on every GG restart. Discovery is retried on every failed poll.

### Channel Key Formats

Three formats, three different contexts — using the wrong one silently fails:

- **JSON key** (`chatRender`, `chatCapture`): used in GET response bodies
- **HTTP path key** (`chatRender`, `chatCapture`): used in PUT URL paths for volume/mute
- **ChannelDict key** (`chat`, `mic`): used in PUT URL paths for redirections

### Preset API Limitation

`PUT /configs/{configId}/select` is the only write. No create/edit/delete. Users must use
SteelSeries GG to manage preset content.

---

## 7. Notification System

Full documentation: [agents/notification_system.md](../agents/notification_system.md)

### Two Surfaces

1. **System notifications** (`windowService.ts`): per-notification `BrowserWindow` with inline HTML.
   Positioned top-right, auto-stacking. Used for service-level messages.

2. **OSD overlays** (`NotificationOverlay.tsx`): persistent React `BrowserWindow` loaded from
   `notification.html`. Used for all real-time hardware feedback.

### Renderer-Driven Design

Notification logic lives in the renderer (`notifyFromEvent.ts`), not the main process. The renderer
already has all hardware events via IPC push and has the settings in Zustand state. The main
process is a thin forwarder.

```
Hardware event
  → App.tsx IPC subscription
  → notifyFromEvent.ts function
  → check settings from serviceStore
  → window.api.notifPush(spec)
  → main: NOTIF_PUSH handler
  → forward to OSD window
```

### SerializedNotification Shape

```typescript
type SerializedNotification =
  | { kind: 'circle'; key: string; iconId: string; ttl: number }
  | { kind: 'ring';   key: string; iconId: string; value: number; ttl: number }
  | { kind: 'volume'; key: string; iconId: string; label: string; value: number; ttl: number }
  | { kind: 'rect';   key: string; iconId: string; title: string; subtitle?: string; tail?: string; ttl: number }
```

Same-key notifications replace rather than stack. TTL is per-notification in milliseconds.

### Previous-State Tracking

`notifyFromEvent.ts` has module-level variables that track the last known hardware state.
This prevents spurious notifications on app startup (when the device state is read fresh but
nothing has actually changed). Call `seedArctisTrackingState(state)` after loading initial
state on startup.

---

## 8. Settings Persistence

### AppSettings System

`src/shared/types.ts` defines `AppSettings` and `DEFAULT_SETTINGS`. Settings persist to
`app.getPath('userData')/settings.json`.

Load: `SETTINGS_GET` → returns `AppSettings`
Save: `SETTINGS_SET` → writes `AppSettings`

### Settings Page Pattern

Every settings page registers with the global save context:

```typescript
const { setDirty, registerSave } = useSettingsForm()

// Track dirty state
useEffect(() => {
  setDirty(draftValue !== savedValue)
}, [draftValue, savedValue])

// Register save handler
useEffect(() => {
  registerSave(async () => {
    const current = await window.api.getSettings()
    await window.api.setSettings({ ...current, myField: draftValue })
    setSavedValue(draftValue)
  })
  return () => registerSave(null)  // cleanup
}, [draftValue])
```

The global **Save** button in `SettingsLayout.tsx` triggers all registered save handlers.
An **Unsaved Changes** dialog appears if the user tries to navigate away with dirty state.

Never add local Save/Apply buttons to individual settings pages.

### Settings That Need Immediate Effect

Some settings must be applied in the main process immediately (not just on next app restart).
For these, add a dedicated IPC channel:

```typescript
// In main/index.ts:
ipcMain.handle(IPC_CHANNELS.MY_SETTING_APPLY, async (_, value: number) => {
  const settings = loadAppSettings()
  settings.mySetting = value
  saveAppSettings(settings)
  applyMySetting(value)  // restart timer, update service, etc.
})
```

The settings page calls this channel inside `registerSave()` instead of `setSettings`.

---

## 9. UI Patterns

### Sidebar

**Collapsed state**: `sidebarCollapsed` in `appStore` — when true, `Sidebar` component unmounts.
There is no icon-only strip. The sidebar toggle in `TopBar` uses `forwardRef` + `getBoundingClientRect()`
to anchor the `FloatingSidebar` peek panel.

**FloatingSidebar sync rule**: `Sidebar.tsx` and `FloatingSidebar.tsx` both contain the nav item list.
These must always be updated together. See the feedback memory for this rule. The long-term fix is
to extract a shared `MAIN_NAV` constant — tracked in CLAUDE.md Known Gaps.

**Resize handle**: 6px invisible div on the right edge of the sidebar's outer container.
Lives on the outer div (not inside the rounded card) to avoid clipping by `border-radius`.
During drag: `document.body.style.cursor = 'col-resize'` and `userSelect = 'none'`.

### Portal Rendering

Any overlay that must escape `overflow: hidden` parents uses `ReactDOM.createPortal(element, document.body)`:

```typescript
import ReactDOM from 'react-dom'

// Inside render:
return ReactDOM.createPortal(
  <div style={{ position: 'fixed', top: anchor.bottom, left: anchor.x }}>
    {/* content */}
  </div>,
  document.body
)
```

Used by: `FloatingSidebar` (peek panel). The OSD notification window is a separate `BrowserWindow`
rather than a portal — portals can't cross window boundaries.

### Optimistic UI

When a user interaction triggers a slow async operation (DDC brightness write, Sonar volume write),
apply the change to local state immediately and ignore the echoed confirmation for a short window:

```typescript
const [draftValue, setDraftValue] = useState<number | null>(null)
const lockedUntilRef = useRef<number>(0)

// On user interaction:
setDraftValue(newValue)

// On commit (pointer up, key up):
window.api.myWrite(newValue)
lockedUntilRef.current = Date.now() + LOCK_DURATION_MS
setTimeout(() => setDraftValue(null), LOCK_DURATION_MS)

// On incoming push update:
if (Date.now() < lockedUntilRef.current) return  // ignore echo

// Display value:
const displayValue = draftValue ?? serverValue
```

Used by: `DisplayCard` (DDC brightness), `ChannelStrip` (Sonar volume).

---

## 10. Design System

### Color Tokens

All colors are CSS custom properties defined in `src/renderer/src/styles/globals.css`.
Never hardcode hex values in components.

```css
/* Reference in inline styles: */
style={{ color: 'var(--color-text-primary)' }}

/* Or in Tailwind via arbitrary values: */
className="text-[var(--color-text-primary)]"
```

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#F5F5F5` | `#1C1C1C` |
| `--color-surface` | `#EBEBEB` | `#252525` |
| `--color-surface-raised` | `#E3E3E3` | `#2C2C2C` |
| `--color-text-primary` | `#141414` | `#EBEBEB` |
| `--color-text-secondary` | `#8C8C8C` | `#888888` |
| `--color-accent` | `#525252` | `#B0B0B0` |
| `--color-border` | `#D8D8D8` | `#383838` |
| `--color-code-bg` | `#E5E5E5` | `#252525` |

Dark mode is toggled by setting `data-theme="dark"` on `<html>`.

### Design Rules

- **Pure neutral grays only** — no warm or cool undertones anywhere
- **Gray is the only accent** — no color accents (no blue, no orange, no purple)
- **No gradients** — especially no purple/brand gradients
- **No heavy shadows** — depth via background color steps (surface → surface-raised → bg)
- **Tailwind for layout** (spacing, flex, grid, rounding, font size)
- **CSS vars for color** (text, background, border, accent)
- **Monospace class** for code, paths, version strings: use `.mono` from globals.css

### Typography

- UI chrome: `Segoe UI Variable, Segoe UI, system-ui`
- Code/monospace: `JetBrains Mono, Cascadia Code, Consolas` (`.mono` utility class)
- Font is currently loaded from Google Fonts — bundle locally for offline use (tracked in Known Gaps)

---

## 11. Build Configuration

### electron.vite.config.ts

The app has **three build targets**:

1. **`main`** — Node.js entry + DDC worker (two rollup input entries)
2. **`preload`** — preload script
3. **`renderer`** — React app (main window + OSD window via two HTML entry points)

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
},
renderer: {
  // Two HTML entries: main window + OSD window
  input: {
    main:         resolve('src/renderer/index.html'),
    notification: resolve('src/renderer/notification.html'),
  }
}
```

The DDC worker compiles to `out/main/ddcWorker.js`. Reference at runtime:
```typescript
new Worker(join(__dirname, 'ddcWorker.js'))
```

### ASAR Unpacking

Native modules that load `.node` files cannot be inside the ASAR archive. Configure in `package.json`:

```json
"build": {
  "asarUnpack": [
    "**/node_modules/@hensm/ddcci/**"
  ]
}
```

### extraResources

Files needed at runtime outside the ASAR:

```json
"build": {
  "extraResources": [
    { "from": "resources/nircmd", "to": "nircmd" },
    { "from": "resources/services", "to": "services" }
  ]
}
```

Path resolution at runtime:
```typescript
const basePath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources')
const nircmdPath = path.join(basePath, 'nircmd', 'nircmd.exe')
const scriptPath = path.join(basePath, 'services', 'arctis_hid_service.py')
```

---

## 12. Adding New Features

### New Device / Hardware Service

1. Create `resources/services/<id>_service.py` with the JSON stdout protocol and internal reconnect loop.
2. Add entry to `SERVICE_DEFS` in `serviceManager.ts`.
3. Add state interface and IPC channels to `shared/types.ts`.
4. Handle new message types in `ServiceManager.handleMessage()`.
5. Add IPC handlers in `main/index.ts`.
6. Expose via `preload/index.ts` and declare in `electron.d.ts`.
7. Create a Zustand store slice or extend `serviceStore.ts`.
8. Wire IPC subscriptions in `App.tsx`.
9. Create UI components and a page.
10. Add nav item to `Sidebar.tsx` and `FloatingSidebar.tsx` (both must be updated).
11. Add view id to `AppView` union and route in `MainContent.tsx`.

### New Notification Type

1. Add a function in `notifyFromEvent.ts`.
2. Register the icon in `components/notifications/icons.tsx`.
3. Add the config type to `AppSettings.notifications` in `types.ts` + default in `DEFAULT_SETTINGS`.
4. Add UI toggle + shape selector in `NotificationsSettings.tsx`.
5. Wire the call from the appropriate IPC subscription in `App.tsx`.

### New Settings Tab

1. Add tab id to `SettingsTab` in `types.ts`.
2. Add entry to `SETTINGS_NAV` in `SettingsSidebar.tsx`.
3. Create page in `pages/settings/`.
4. Add case in `SettingsLayout.tsx`.
5. Settings page must use `useSettingsForm()` context — no local Save buttons.

---

## 13. Known Issues and Errors

### FloatingSidebar / Sidebar Nav Duplication

`Sidebar.tsx` and `FloatingSidebar.tsx` both define the navigation item list independently.
They must be kept in sync manually. If you add a nav item to one, add it to the other.
The long-term fix is a shared `MAIN_NAV` constant in a `nav.tsx` module.

### DDC Worker PowerShell Timeout

The PowerShell `EnumDisplayDevices` query has a hardcoded 8-second timeout. On very slow systems
or after a sleep/wake cycle, this can time out and leave `is_primary: false` on all monitors.
The refresh will correct on the next poll.

### Sonar Port Discovery on GG Restart

When SteelSeries GG restarts, its Sonar port changes. The service detects this on the next failed
poll (~1–5 seconds later) and re-discovers. During this window the GG Sonar page shows "unavailable".

### Headset State on Late Connect

The headset is event-driven — if the app starts while the headset is already connected, initial
state is read from `get_status()` on connect. But if the headset connects after `App.tsx`
has already mounted and subscribed, the `connected` event fires and populates state correctly.
Periodic state polling for late-attach sync is on the roadmap.

### Notification Previous-State Seeding

If `seedArctisTrackingState()` is not called on app startup (e.g. after a refactor), the
`_prev*` tracking variables start as `null`. Any transition from `null` to a real value is
treated as a genuine change and fires a notification. This manifests as spurious "battery low"
or "ANC mode changed" notifications on the first connect. Always call `seed` on startup.

### Settings Save Error Handling

The global save button in `SettingsLayout.tsx` catches errors from `registerSave` handlers and
shows an error state. Individual save handlers should throw on failure so this error path works.
Currently not all handlers are consistent about this.

### Sidebar Width Persistence

Sidebar width and collapsed state are stored in Zustand memory only — they reset on app restart.
Wiring to `localStorage` or `electron-store` is tracked in the Known Gaps section of CLAUDE.md.
