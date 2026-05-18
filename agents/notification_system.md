# Notification System Guide

This document describes how the app creates and manages notifications. Read it before touching any notification-related code.

---

## Two Surfaces, Different Purposes

The app uses **two parallel notification surfaces**, both implemented as native Electron `BrowserWindow` instances. The OS notification API (`Notification`) is intentionally avoided — it would create Action Center entries, lose styling control, and cause focus interruptions.

---

## Surface 1: System Notifications

**File:** `src/main/services/notifications/windowService.ts`
**Triggered from:** `showSystemNotification(title, body)` in `src/main/index.ts`

Used for informational messages not tied to a hardware control event (service errors, preset failures, debug messages).

### Lifecycle

1. Each call spawns a **new** `BrowserWindow` (340×108 px, frameless, transparent, `alwaysOnTop`, non-focusable, skip taskbar).
2. HTML content is built as a string inline and loaded via `loadURL('data:text/html,...')` — no renderer process, no React, no IPC round-trip.
3. `setIgnoreMouseEvents(true)` + `setFocusable(false)` after show — purely visual, never steals focus.
4. A `setTimeout` auto-closes the window using the user-configured `notificationTimeout` (enforced ≥ 2s via `MIN_TIMEOUT_SECONDS`).

### Stacking Layout

`relayout()` walks the active window list and positions them top-right, 12px from the work area edge, 10px gap between windows. It runs on show and on each window's `closed` event so the stack collapses cleanly.

### Theme

`resolveVisualTheme()` reads the current theme mode (system/dark/light), computing concrete CSS `rgba()` values at creation time. Dark/light variants use glass-like semi-transparent backgrounds.

### Security

`escapeHtml()` is applied to `title` and `body` before embedding them in the HTML template, preventing XSS from untrusted strings (e.g. device names sourced from hardware).

---

## Surface 2: Hardware OSD Overlays

**Architecture:** A persistent `BrowserWindow` loads `notification.html` which mounts `NotificationOverlay.tsx` — a full React renderer. This is entirely separate from the main app window.

**Key difference from Surface 1:** The OSD window is persistent and React-powered. Notifications are pushed into it as data and rendered as React components. No window is spawned per notification.

### How Notifications Fire (Renderer-Driven Flow)

```
Hardware event (e.g. VolumeEvent from Arctis HID)
  → main process receives it via service stdout
  → IPC push: ARCTIS_EVENT → renderer App.tsx
  → App.tsx calls notifyFromEvent.ts function
  → notifyFromEvent.ts reads settings from serviceStore
  → calls window.api.notifPush(spec)    ← renderer → main IPC
  → main process receives NOTIF_PUSH
  → forwards SerializedNotification to OSD BrowserWindow
  → NotificationOverlay.tsx adds it to the visible stack with TTL
```

This renderer-driven design means notification logic (reading settings, deciding shape/TTL)
lives in the renderer alongside the rest of the UI logic — not scattered across the main process.

### notifyFromEvent.ts

**File:** `src/renderer/src/lib/notifyFromEvent.ts`

Each function maps a specific hardware event type to a `SerializedNotification` push:

| Function | Fires on |
|---|---|
| `notifyArctisConnected(state)` | Headset USB connection |
| `notifyArctisDisconnected()` | Headset USB disconnect |
| `notifyArctisEvent(eventName, data)` | All HID events (VolumeEvent, BatteryEvent, AncModeEvent, MicMuteEvent, ConnectivityEvent, SidetoneEvent, ChatMixEvent) |
| `notifySonarPresetChange(presetName)` | Sonar preset activated |
| `notifyDisplayInputChange(displayName, inputName)` | DDC input source change |

Functions check the relevant `AppSettings.notifications` fields before pushing. If the notification type is disabled in settings, nothing fires.

**Previous-state tracking**: module-level variables (`_prevBatteryHeadset`, `_prevAncMode`, etc.) track the last known values. This prevents spurious notifications on initial connection (e.g. battery level is always read fresh on connect but should not fire a "low battery" alert for a state that existed before the app started).

- `seedArctisTrackingState(state)` — seeds state without firing, called on app startup if headset is already connected.
- `resetArctisTrackingState()` — clears state, called on disconnect so reconnect fires correctly.

### SerializedNotification Shape

```typescript
type SerializedNotification =
  | { kind: 'circle'; key: string; iconId: string; ttl: number }
  | { kind: 'ring';   key: string; iconId: string; value: number; ttl: number }
  | { kind: 'volume'; key: string; iconId: string; label: string; value: number; ttl: number }
  | { kind: 'rect';   key: string; iconId: string; title: string; subtitle?: string; tail?: string; ttl: number }
```

### Key Deduplication

Each notification has a `key` string. A new notification with the same `key` replaces any currently visible notification with that key — no stacking for the same event type. Examples:

- `'headset-volume'` — scrolling the volume dial replaces the existing volume OSD, extends TTL.
- `'mic-mute'` — toggling mic replaces the existing mute OSD.
- `'anc-mode'` — cycling ANC modes replaces the last ANC OSD.
- `'battery-low'` and `'battery-charging'` are different keys so they can coexist.

### TTL Handling

The `ttl` field is milliseconds until the OSD is removed. The user-configured `durationMs` in `AppSettings.notifications` is the default used by most events. Per-event TTL overrides are hardcoded for time-critical events (e.g. connectivity = 2400ms fixed).

### OSD Window Geometry

OSD windows are positioned **center-bottom** (above the taskbar, horizontally centered), matching the ergonomics of system volume overlays. Position is calculated from `screen.getPrimaryDisplay().workAreaSize`.

The OSD `BrowserWindow` is:
- Frameless, transparent background
- `alwaysOnTop: true`, `skipTaskbar: true`
- `focusable: false`, `setIgnoreMouseEvents(true)` — click-through
- Sized to fit the current notification stack

### NotificationOverlay.tsx

**File:** `src/renderer/src/NotificationOverlay.tsx`

The React root for the OSD BrowserWindow. Receives `SerializedNotification` objects via
`window.api.onNotifPush()` (IPC push from main). Manages a list of active notifications,
removes them when their TTL expires, and renders the appropriate component per `kind`:

| kind | Component |
|---|---|
| `'circle'` | `NotificationCircle` |
| `'ring'` | `NotificationCircle` with ring arc |
| `'volume'` | Custom volume bar layout |
| `'rect'` | `NotificationRect` |

Multiple notifications with **different keys** stack vertically. Same-key notifications replace.

### Icons

**File:** `src/renderer/src/components/notifications/icons.tsx`

Maps `iconId` strings to SVG components. The icon map must be registered here before a new `iconId` can be used in a push spec. Currently registered icons include:
`volume`, `mic`, `mic-off`, `battery`, `battery-low`, `battery-charging`, `anc`, `transparency`,
`wireless`, `bluetooth`, `link`, `unlink`, `sonar`, `monitor`, `chatmix`, `sidetone`

When adding a new hardware event notification, add the SVG icon here first, then reference it by `iconId` in `notifyFromEvent.ts`.

---

## Timer Management

**File:** `src/main/services/notifications/timerService.ts`

A thin keyed `Map<string, NodeJS.Timeout>`. Each notification type has a semantic key matching its `SerializedNotification.key`. Calling `schedule(key, delayMs, callback)` **replaces** any pending timer for that key, so rapid hardware events extend the timeout rather than stacking closures.

---

## Guard: isNotifEnabled

Before pushing any notification, `notifyFromEvent.ts` checks the settings directly from `serviceStore`:

```typescript
function getSettings(): HeadsetNotificationSettings {
  return useServiceStore.getState().settings.notifications.headset
}
```

Individual notification events check their specific `cfg.eventType.enabled` flag. If the flag is false, the `push()` call is skipped entirely.

---

## Adding a New OSD Notification

1. Add a function to `notifyFromEvent.ts`:
   ```typescript
   export function notifyMyEvent(data: MyData): void {
     const cfg = getSettings()
     if (!cfg.myEvent.enabled) return
     push({ kind: 'circle', key: 'my-event', iconId: 'my-icon', ttl: 2000 })
   }
   ```
2. Register the icon in `src/renderer/src/components/notifications/icons.tsx`.
3. Add `myEvent: { enabled: boolean; shape: string }` to the relevant notification settings
   interface in `types.ts` and add a default in `DEFAULT_SETTINGS`.
4. Add a UI toggle + shape selector in `NotificationsSettings.tsx`.
5. Call `notifyMyEvent(data)` from the appropriate IPC subscription handler in `App.tsx`.

---

## Summary Table

| Concern | System Notifications | Hardware OSD |
|---|---|---|
| File | `services/notifications/windowService.ts` | `NotificationOverlay.tsx` |
| Window lifecycle | Spawned per notification | Persistent, React-rendered |
| Content | Inline HTML string | React components |
| Content update | New window each time | State update, React re-render |
| Position | Top-right, stacked | Center-bottom |
| Input passthrough | Yes (`setIgnoreMouseEvents`) | Yes |
| Auto-close | Timer inside windowService | TTL field in SerializedNotification |
| Theme | Computed at creation time | CSS vars + React theme context |
| Notification logic | Main process | Renderer (`notifyFromEvent.ts`) |
| Settings check | `isServiceEnabled()` in main | `serviceStore.getState()` in renderer |
