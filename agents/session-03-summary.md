# Session 03 — Summary & Learnings

**Date:** 2026-05-18
**Branch work:** `development`

---

## What Was Built

### 1. GG Sonar Integration (sonarService.ts)

Full HTTP REST polling client for SteelSeries GG Sonar. Lives in the Electron main process as
a Node.js service — no Python subprocess required.

Key decisions:
- Dynamic port discovery via `GET https://127.0.0.1:6327/subApps` (HTTPS, `rejectUnauthorized: false`).
  The port changes on every GG restart so discovery is re-attempted on every connection failure.
- Two-tier polling: 1s for volumes/mode/chatMix; 5s for presets/routing/devices.
- Optimistic writes: state is updated locally before the HTTP PUT completes, giving instant
  fader response without waiting for the network round-trip.

Confirmed API quirk: the mode API uses `"stream"` (not `"streamer"`) for both GET and PUT.
Three channel key formats in use depending on endpoint context (see DdcFeatureReport.md).

Preset limitation discovered: the Sonar HTTP API has no endpoint for creating/editing/deleting
presets — only reading and selecting. Documented in GGSonarImplementation.md and surfaced in
the PresetEditor UI with a read-only banner.

### 2. Preset Auto-Switcher (activeWindowMonitor.ts)

Polls the Windows foreground window. When the active process matches a `PresetSwitcherRule`,
calls `sonarService.selectPreset()` for the configured channel and preset.

Manual override tracking: when a user manually picks a preset in the GG Sonar page, the switcher
backs off for that channel until the foreground app changes away and back. This prevents the
switcher from immediately undoing a deliberate user choice.

### 3. Notification System — Renderer-Driven OSD

Replaced the earlier main-process-driven OSD approach with a renderer-driven design.

**Architecture shift**: notification logic (checking settings, deciding shape/TTL) moved from
scattered main-process handlers into `notifyFromEvent.ts` in the renderer. This co-locates
notification decisions with the rest of the UI logic and keeps the main process thinner.

**Flow**:
```
hardware event → App.tsx → notifyFromEvent.ts → window.api.notifPush(spec)
  → main process → forwards to OSD BrowserWindow (notification.html)
  → NotificationOverlay.tsx adds to stack with TTL
```

**Four notification shapes**: `circle`, `ring`, `volume`, `rect` — each rendered as a React
component in the persistent OSD `BrowserWindow`.

**Key deduplication**: rapid repeat events (e.g. volume scroll) replace rather than stack,
using the `key` field. The same `key` arriving a second time replaces the existing entry.

**Previous-state tracking**: module-level variables in `notifyFromEvent.ts` track the last
known headset state. `seedArctisTrackingState()` is called on app startup so a headset already
connected at launch doesn't fire connect/battery/ANC notifications.

### 4. Notification Settings (NotificationsSettings.tsx)

Per-event-type toggles and shape selectors. Each notification type has an `enabled` flag and
a `shape` option in `AppSettings.notifications`. The settings form uses the global save pattern
(dirty state + `registerSave` context) — no local Save button.

### 5. Display Input Change Notifications

`notifyDisplayInputChange()` fires when DDC input source changes, showing the display name and
the new input label. Wired in `App.tsx` to the `DDC_UPDATE` IPC push — compares previous vs
current input source per monitor.

### 6. GG Sonar Preset Change Notifications

`notifySonarPresetChange()` fires when the preset auto-switcher or the user manually switches
a preset. Shows the preset name. Wired in both `App.tsx` (for user-initiated changes) and
`activeWindowMonitor.ts` (for auto-switcher changes).

---

## Key Learnings / Patterns

### Renderer-Driven Notification Logic

Moving notification decisions to the renderer (`notifyFromEvent.ts`) is cleaner than having
them in the main process. The renderer already has the settings in Zustand state and receives
all hardware events via IPC push — making it the natural place to decide what to display.
The main process becomes a thin forwarder.

### Previous-State Seeding

When the app starts with a device already connected, the first `connected` message from the
service gives the current hardware state. Without seeding the tracking variables, every field
would look like a "change from null" and fire spurious notifications (e.g. "battery charging"
when nothing changed). `seedArctisTrackingState()` sets the initial values without firing.

### Sonar Port Discovery Race

If GG is restarting while the app polls, discovery fails. The service sets `available: false`
and retries discovery on the next poll cycle. No exponential backoff is needed because 1-second
polling is already low enough frequency that a few failed attempts don't cause issues.

### Channel Key Naming Inconsistency (Sonar)

Sonar uses three different key formats for the same channel depending on which endpoint is being
called. This is not documented by SteelSeries — it was discovered by scanning the REST API and
cross-referencing the [SteelSeries-NET-API C# source](https://github.com/DataNext27/SteelSeries-NET-API).
Always verify which key format an endpoint expects; using the wrong one silently fails.

### OSD BrowserWindow as Persistent Renderer

A dedicated `BrowserWindow` loaded with `notification.html` (its own Vite entry) is a cleaner
approach than spawning a new window per notification. React state handles the notification stack,
and TTL-based removal is clean via `useEffect` + `setTimeout`. The window stays running but
click-through when no notifications are active.

---

## Files Changed This Session

| File | Change |
|---|---|
| `src/main/services/sonarService.ts` | New — HTTP polling client for GG Sonar |
| `src/main/services/activeWindowMonitor.ts` | New — foreground window polling + preset auto-switch |
| `src/main/services/notifications/windowService.ts` | New — system notification BrowserWindows |
| `src/main/services/notifications/timerService.ts` | New — keyed timer map |
| `src/main/index.ts` | GG Sonar IPC handlers, preset switcher handlers, notification IPC handler |
| `src/shared/types.ts` | SonarState interfaces, notification types, new IPC channels |
| `src/preload/index.ts` | Sonar + notification API methods |
| `src/renderer/src/types/electron.d.ts` | Sonar + notification declarations on window.api |
| `src/renderer/src/stores/sonarStore.ts` | New — Zustand store for Sonar state |
| `src/renderer/src/stores/notificationStore.ts` | New — notification stack state |
| `src/renderer/src/lib/notifyFromEvent.ts` | New — hardware event → OSD push mapping |
| `src/renderer/src/NotificationOverlay.tsx` | New — OSD React renderer |
| `src/renderer/notification.tsx` | New — ReactDOM entry for OSD window |
| `src/renderer/notification.html` | New — HTML entry for OSD BrowserWindow |
| `src/renderer/src/components/notifications/` | New — NotificationCircle, NotificationRect, icons |
| `src/renderer/src/components/gg-sonar/` | New — ChannelMixer, ChannelStrip, PresetEditor |
| `src/renderer/src/pages/GGSonar.tsx` | Replaced stub with full page |
| `src/renderer/src/pages/Shortcuts.tsx` | New — preset auto-switcher rules UI |
| `src/renderer/src/pages/Notifications.tsx` | New — notification preview page |
| `src/renderer/src/pages/settings/NotificationsSettings.tsx` | New — per-event settings |
| `src/renderer/src/pages/settings/GGSonarSettings.tsx` | New — Sonar polling settings |
| `src/renderer/src/App.tsx` | Sonar + notification IPC subscriptions, notifyFromEvent wiring |
| `electron.vite.config.ts` | Added notification.html as a second renderer entry |
