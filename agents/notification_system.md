# Notification System Guide

This document describes how the app creates and manages notifications. Read it before touching any notification-related code.

---

## Two surfaces, different purposes

The app uses **two parallel notification surfaces**, both implemented as native Electron `BrowserWindow` instances. The OS notification API (`Notification`) is intentionally avoided — it would create Action Center entries, lose styling control, and cause focus interruptions.

---

## Surface 1: System notifications

**Service:** `src/main/services/notifications/windowService.ts`  
**Entry point:** `showSystemNotification(title, body)` in `src/main/index.ts`

Used for informational messages not tied to a hardware control (service errors, preset failures, debug messages).

### Lifecycle

1. Each `showNotification()` call spawns a **new** `BrowserWindow` (340×108 px, frameless, transparent, `alwaysOnTop`, non-focusable, skip taskbar).
2. HTML content is built as a string inline and loaded via `loadURL('data:text/html,...')` — no renderer process, no React, no IPC round-trip.
3. `setIgnoreMouseEvents(true)` + `setFocusable(false)` after show — purely visual, never steals focus.
4. A `setTimeout` auto-closes the window using the user-configured `notificationTimeout` (enforced ≥ 2 s via `MIN_TIMEOUT_SECONDS`).

### Stacking layout

`relayout()` walks the active window list and positions them top-right, 12 px from the work area edge, 10 px gap between windows. It runs on show and on each window's `closed` event so the stack collapses cleanly.

### Theme

`resolveVisualTheme()` reads the current theme mode (system/dark/light) and user accent color, computing concrete CSS `rgba()` values at creation time. Dark/light variants use glass-like semi-transparent backgrounds.

### Security

`escapeHtml()` is applied to `title` and `body` before embedding them in the HTML template, preventing XSS from untrusted strings (e.g. device names sourced from hardware).

---

## Surface 2: Hardware OSD overlays

**Location:** `src/main/index.ts` (inline, not yet extracted to a service)

Used for real-time hardware feedback: headset volume, mic mute, sidetone, ChatMix, ANC mode, connectivity, preset changes, USB input switching, battery alerts, OLED display.

### Key difference from system notifications: windows are reused

Each OSD type has a **persistent, module-level window variable** (e.g. `headsetVolumeNotificationWindow`, `micMuteNotificationWindow`). On repeated events the window is updated in-place via `executeJavaScript()` calling page-global hooks (`window.__setHeadsetAudio?.()`, `window.__setHeadsetAccent?.()`, etc.) rather than reloading. This gives smooth value transitions and avoids flash.

### Geometry

All OSD windows are positioned **center-bottom** (above the taskbar, horizontally centered), matching the ergonomics of system volume overlays — unlike system notifications which stack top-right.

Layout helpers:
- `resolveSquareOsdLayout(baseSize, minSize)` — used by most hardware OSDs (mic mute, ANC, connectivity, battery, etc.)
- `resolveHeadsetVolumeOsdLayout(showChatMix)` — special case: expands from single row (volume only) to double row (volume + ChatMix) based on user settings
- `resolvePresetChangeOsdLayout()` — wide pill shape, not square

All layouts scale to the current display's work area using a resolution scale factor clamped to `[0.82, 1.18]` relative to a 1080p baseline. `resolveUiDisplay()` returns the primary display or the display under the cursor/focused window when `useActiveDisplay` is enabled in settings.

### OSD constants (src/main/index.ts)

```
HEADSET_VOLUME_OSD_BASE_WIDTH       = 210
HEADSET_VOLUME_OSD_BASE_HEIGHT_SINGLE = 46
HEADSET_VOLUME_OSD_BASE_HEIGHT_DOUBLE = 70
MIC_MUTE_OSD_BASE_SIZE              = 62
OLED_OSD_BASE_SIZE                  = 108
SIDETONE_OSD_BASE_SIZE              = 108
PRESET_CHANGE_OSD_BASE_WIDTH        = 256
PRESET_CHANGE_OSD_BASE_HEIGHT       = 58
USB_INPUT_OSD_BASE_SIZE             = 102
ANC_MODE_OSD_BASE_SIZE              = 62
CONNECTIVITY_OSD_BASE_SIZE          = 102
CONNECTIVITY_OSD_TIMEOUT_MS         = 3000
BATTERY_LOW_OSD_BASE_SIZE           = 104
BASE_BATTERY_STATUS_OSD_BASE_SIZE   = 98
```

---

## Timer management

**Service:** `src/main/services/notifications/timerService.ts`

A thin keyed `Map<NotificationTimerKey, NodeJS.Timeout>`. Each OSD type has a semantic key:

```
"headsetVolume" | "micMute" | "oled" | "sidetone" | "presetChange"
| "usbInput" | "ancMode" | "connectivity" | "batteryLow" | "baseBatteryStatus"
```

Calling `schedule(key, delayMs, callback)` **replaces** any pending timer for that key, so rapid hardware events (e.g. scrolling volume) extend the timeout rather than stacking closures.

`connectivity` uses `CONNECTIVITY_OSD_TIMEOUT_MS` (3 s fixed). All others use `scheduleStandardNotificationClose()` which reads `settings.notificationTimeout`.

Each OSD type has a pair of named helpers in `index.ts`:
- `clear<Type>NotificationTimer()` — wraps `notificationTimerService.clear(key)`
- `schedule<Type>NotificationClose(win)` — wraps `scheduleStandardNotificationClose(key, win)`

---

## Guard: isNotifEnabled

Before triggering any notification, call:

```ts
isNotifEnabled(key: keyof UiSettings["notifications"]): boolean
// returns false if global notificationsEnabled is off, or the specific key is disabled
```

For OLED-specific notifications use `isOledNotifEnabled()` instead.

`showSystemNotification()` already checks `isServiceEnabled("notificationsEnabled")` internally.

---

## Summary table

| Concern | System notifications | Hardware OSD |
|---|---|---|
| File | `services/notifications/windowService.ts` | `src/main/index.ts` |
| Window lifecycle | Spawned per notification | Persistent, reused |
| Content update | New window + HTML string | `executeJavaScript()` in-place |
| Position | Top-right, stacked | Center-bottom |
| Input passthrough | Yes (`setIgnoreMouseEvents`) | Yes |
| Auto-close | Timer inside windowService | `notificationTimerService` keyed per type |
| Theme | Computed at creation | Re-applied via JS hooks on update |
| Connectivity timeout | User setting (≥ 2 s) | Fixed 3 s |
