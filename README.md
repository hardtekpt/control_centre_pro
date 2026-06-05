# Control Centre Pro

A Windows desktop application for managing hardware devices and running custom background services. Think of it as a personal control panel: monitor connected devices, adjust audio and display settings, and get real-time feedback for everything connected to your machine.

The app is designed as an extensible shell. The MVP establishes the layout, navigation patterns, and service infrastructure; device and service plugins are added as sidebar sections over time.

---

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Desktop shell | Electron | 31+ |
| UI framework | React + TypeScript | 18.3+ / 5.5+ strict |
| Bundler | electron-vite | 2.3+ |
| Styling | Tailwind CSS + CSS custom properties | 3.4+ |
| State management | Zustand | 4.5+ |
| Packaging | electron-builder | 24.13+ |
| Background services | Python subprocesses | newline-delimited JSON over stdout |
| Display control | @hensm/ddcci | Windows DDC/CI native module |
| Audio | naudiodon2, fft.js | (latest) |
| Auto-updates | electron-updater | 6.1+ |

---

## Features

### Headset — Arctis Nova Pro Wireless
- Direct USB HID control via Python service — no SteelSeries GG required
- Battery level display for headset and charging dock
- Real-time event-driven state: volume, mic mute, ANC mode, ChatMix, sidetone, Bluetooth, wireless connectivity
- Auto-mount/unmount: `HeadsetCard` appears and disappears as the device is plugged in or removed
- OSD notifications for every hardware event (configurable per event type)

### Audio — GG Sonar
- Real-time per-channel volume mixing: master, game, chat, mic, media, aux
- Classic and streamer mode support
- One-click preset selection per channel
- Audio device routing display (which apps route to which channels)
- Channel redirection: assign any Windows audio device to any Sonar channel
- **Preset auto-switcher**: automatically activates a Sonar preset when a specific app becomes the foreground window
- OSD notification on preset change

### Display — DDC/CI
- Brightness and contrast adjustment for all DDC-capable monitors
- Input source switching with friendly names (HDMI 1, DisplayPort 1, USB-C, etc.)
- Primary display detection via `EnumDisplayDevices` Win32 API
- Set-primary-display action via NirCmd (no UAC elevation required)
- Worker-thread architecture: all blocking DDC calls run off the main event loop
- Optimistic UI with write-lock to prevent echoed updates clobbering in-flight slider drags
- OSD notification on input source change

### Notification System
- **OSD overlays** rendered in a dedicated frameless `BrowserWindow` with React
- Four overlay shapes: `circle` (icon only), `ring` (icon + progress arc), `volume` (horizontal bar), `rect` (icon + title + subtitle)
- Notifications stack and collapse automatically; each type has a named key so rapid repeat events replace rather than pile up
- Fully configurable per notification type: enable/disable, shape, TTL
- Global duration setting with per-type override support
- Fires from the renderer via `window.api.notifPush()` — event-driven, no polling

### Discord Voice
- Direct RPC connection to the Discord desktop client via local named-pipe IPC (`\\.\pipe\discord-ipc-{0-9}`)
- Hand-rolled wire protocol — no `discord-rpc` npm package
- Self mic mute/unmute and deafen/undeafen
- Input and output volume control
- Per-participant local volume (0–200) and local mute
- Live speaking indicators
- OAuth2 authorization code flow with token persistence — browser consent popup appears once
- Auto-reconnect on disconnect

### Service System
- Background services run as managed Python subprocesses (Arctis HID) or native Node.js services (DDC, Sonar, Discord)
- Each service is individually enable/disable-able from General Settings
- Configurable Python executable path for virtual environments
- Live terminal log in the About page showing all service stdout/stderr
- Services persist enabled state and config to `userData/services.json`

### UI Shell
- **Collapsible sidebar**: collapses entirely (no icon strip); default 240px, resizable 180–320px
- **Floating peek panel**: hover the collapsed-state toggle button to preview navigation without expanding
- **Light / dark theme**: pure neutral gray palette (`#F5F5F5` / `#1C1C1C`), toggled via `data-theme` on `<html>`
- **Settings area**: tabbed layout (General, DDC, GG Sonar, Notifications, About) accessed via chip-style button at the bottom of the sidebar
- **About page**: version info + scrollable live service log
- Minimize to tray on close (configurable)

---

## Project Structure

```
resources/
├── services/
│   └── arctis_hid_service.py        # Arctis Nova Pro HID subprocess
├── nircmd/
│   └── nircmd.exe                   # NirCmd binary (set primary display)
└── *.png                             # App icons

src/
├── main/
│   ├── index.ts                      # Window creation, IPC handlers, lifecycle
│   └── services/
│       ├── serviceManager.ts         # Spawns/monitors Python subprocesses
│       ├── sonarService.ts           # GG Sonar facade over the gg-sonar Python service
│       ├── activeWindowMonitor.ts    # Foreground window monitor (preset switcher)
│       ├── notifications/
│       │   ├── windowService.ts      # System notification BrowserWindows
│       │   └── timerService.ts       # Keyed auto-close timers
│       └── apis/ddc/
│           ├── service.ts            # DDC/CI async wrapper
│           └── ddcWorker.ts          # Worker thread: blocking DDC + PowerShell calls
├── preload/
│   └── index.ts                      # contextBridge — exposes window.api
├── shared/
│   └── types.ts                      # IPC channel names + shared interfaces
└── renderer/src/
    ├── App.tsx                       # Theme, IPC subscriptions, FloatingSidebar
    ├── NotificationOverlay.tsx       # OSD renderer (separate BrowserWindow target)
    ├── stores/
    │   ├── appStore.ts               # View, sidebar width/collapse, peek panel
    │   ├── serviceStore.ts           # Services, logs, ArctisState, DdcMonitors, settings
    │   ├── sonarStore.ts             # Sonar volumes, presets, routing, mode
    │   ├── discordStore.ts           # Discord RPC voice state
    │   └── notificationStore.ts      # Notification queue and stack state
    ├── lib/
    │   └── notifyFromEvent.ts        # Maps hardware events to OSD push calls
    ├── components/
    │   ├── layout/                   # TopBar, Sidebar, FloatingSidebar, MainLayout
    │   ├── settings/                 # SettingsLayout, SettingsSidebar
    │   ├── home/                     # HeadsetCard, CompactHeadsetCard, DisplayCard
    │   ├── gg-sonar/                 # ChannelMixer, ChannelStrip, PresetEditor
    │   └── notifications/            # NotificationCircle, NotificationRect, icons
    ├── contexts/
    │   └── settingsFormContext.tsx   # Global dirty-state + save-handler registry
    └── pages/
        ├── Home.tsx                  # Dashboard (headset + displays)
        ├── Arctis.tsx                # Full headset control panel
        ├── GGSonar.tsx               # Audio mixer (ChannelMixer)
        ├── Shortcuts.tsx             # Preset auto-switcher rules
        ├── Notifications.tsx         # Notification preview and config
        └── settings/
            ├── GeneralSettings.tsx   # Theme, tray, Python path, services
            ├── DDCSettings.tsx       # Poll interval, monitor prefs
            ├── GGSonarSettings.tsx   # Sonar polling config
            ├── NotificationsSettings.tsx  # Per-notification toggles and shapes
            ├── DiscordSettings.tsx   # Discord RPC Client ID/Secret, voice controls
            └── About.tsx             # Version + live service log
```

---

## Getting Started

```powershell
npm install
npm run dev        # Electron + Vite HMR
npm run build      # Production build
npm run package    # Build + Windows installer
```

### Python Packages

The Arctis HID service requires the `arctis_hid` Python package:

```powershell
python -m pip install git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development
```

If you use a non-default Python environment, set the executable path in **General Settings → Services → Python executable**.

### Native Binaries

For primary display switching, the app requires **NirCmd** (freeware, ~50 KB):

1. Download `nircmd.exe` from https://www.nirsoft.net/utils/nircmd.html
2. Place it at `resources/nircmd/nircmd.exe`

The app bundles it automatically during `npm run package`.

### Node.js Native Modules

- `@hensm/ddcci` — Windows DDC/CI library (included in `package.json`, ASAR-unpacked by electron-builder)
- `naudiodon2` — audio device enumeration (requires `node-gyp`; auto-rebuilt via `npm rebuild`)

### GG Sonar

GG Sonar integration requires **SteelSeries GG** to be installed and running. The app discovers the Sonar HTTP endpoint automatically — no configuration required.

---

## Implementation Status

| Feature | Status |
|---|---|
| Arctis Nova Pro HID — read state | ✅ |
| Arctis Nova Pro HID — write commands (volume, ANC, mute) | ✅ Partial |
| GG Sonar volume mixer (classic + streamer) | ✅ |
| GG Sonar preset selection per channel | ✅ |
| GG Sonar channel redirection | ✅ |
| Preset auto-switcher (active window → preset) | ✅ |
| DDC/CI brightness + contrast | ✅ |
| DDC/CI input source switching | ✅ |
| Primary display detection + switching | ✅ |
| OSD notification overlay | ✅ |
| Per-event notification settings | ✅ |
| Service enable/disable + log streaming | ✅ |
| Discord voice control (mute, deafen, volumes, participants) | ✅ |
| Responsive sidebar with collapse/peek | ✅ |
| Dark/light theme | ✅ |
| Minimize to tray | ✅ |
| Settings persistence | ✅ |

---

## Roadmap

- [ ] Sidebar width and collapsed state persistence (`localStorage` / `electron-store`)
- [ ] Headset write commands — full EQ and sidetone adjustments
- [ ] HDR and advanced monitor controls via DDC/CI
- [ ] Empty state on Home page when no devices are connected
- [ ] Clearable service log in About tab
- [ ] Periodic state polling for late-attach device sync
- [ ] Bundle JetBrains Mono font (currently loaded from Google Fonts)
- [ ] Auto-updater (`electron-updater`) — needs a release server URL
- [ ] Test suite (Vitest for renderer + main, Playwright for IPC integration)
- [ ] GG Sonar: chatMix balance control
- [ ] GG Sonar: stream monitoring toggle
