# Control Centre Pro

A Windows desktop application for managing hardware devices and running custom background services. Think of it as a personal control panel: monitor connected devices, start and stop services, and get at-a-glance status for everything running on your machine.

The app is designed as an extensible shell. The MVP establishes the layout, navigation patterns, and service infrastructure; device and service plugins are added as sidebar sections over time.

---

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Desktop shell | Electron | 31+ |
| UI framework | React | 18.3+ |
| Language | TypeScript | 5.5+ (strict mode) |
| Bundler | electron-vite | 2.3+ |
| Styling | Tailwind CSS + CSS custom properties | 3.4+ |
| State management | Zustand | 4.5+ |
| Packaging | electron-builder | 24.13+ |
| Background services | Python subprocesses | (newline-delimited JSON over stdout) |
| Hardware APIs | @hensm/ddcci | (latest) |
| Audio processing | naudiodon2, fft.js | (latest) |
| Auto-updates | electron-updater | 6.1+ |

---

## Features

### Device Management
- **Arctis Nova Pro headset support** — battery level (headset + dock), ANC mode, mic mute, volume, all via direct USB HID (no SteelSeries GG required)
- **Live event-driven updates** — headset state refreshes instantly on `VolumeEvent`, `BatteryEvent`, `AncModeEvent`, `MicMuteEvent`
- **Auto-connect / auto-disconnect** — `HeadsetCard` mounts and unmounts automatically as the device is plugged in or removed
- **DDC/CI display control** — brightness and contrast adjustment, input source switching, and primary display detection for all DDC-capable monitors
- **Primary display switching** — set any monitor as the primary display with a single click (via NirCmd)

### Audio (GG Sonar)
- **Real-time volume control** — per-channel mixing for game, chat, media, and auxiliary streams
- **EQ and effects** — bass boost, treble boost, voice clarity adjustments
- **Audio device routing** — redirect channels to different Windows playback devices
- **Preset system** — favorite presets with one-click switching
- **Preset auto-switcher** — automatic preset switching based on active application

### Service System
- Background services run as managed Python subprocesses
- Each service is individually enable/disable-able from General Settings
- Configurable Python executable path (for virtual environments)
- Live terminal log in the About page showing all service output
- Services persist their enabled state and config to `userData/services.json`

### UI Shell
- **Collapsible sidebar** — collapses entirely (no icon strip); default 240px, resizable 180–320px
- **Floating peek panel** — hover the toggle button while collapsed to preview nav without expanding
- **Light / dark theme** — pure neutral gray palette, toggled via `data-theme` on `<html>`
- **Settings area** — tabbed layout (General, About) accessed via chip-style button at the bottom of the sidebar
- **About page** — version info + scrollable live service log

### Architecture
- Strict main / renderer separation; `contextIsolation: true`, `nodeIntegration: false`
- All IPC channels typed via `IPC_CHANNELS` constants in `shared/types.ts` — no magic strings
- All file I/O and subprocess management in the main process
- Preload bridge (`window.api.*`) is the only surface the renderer touches

---

## Project Structure

```
resources/
├── services/
│   └── arctis_hid_service.py        # Arctis Nova Pro HID service
├── nircmd/
│   └── nircmd.exe                   # NirCmd binary (set primary display)
└── *.png                             # App icons

src/
├── main/
│   ├── index.ts                      # Window creation, IPC handlers, lifecycle
│   └── services/
│       ├── serviceManager.ts         # Spawns/monitors Python subprocesses
│       ├── sonarService.ts           # GG Sonar HTTP REST API client
│       ├── activeWindowMonitor.ts    # Monitor active window for preset switching
│       └── apis/ddc/
│           └── service.ts            # DDC/CI display control service
├── preload/
│   └── index.ts                      # contextBridge — exposes window.api
├── shared/
│   └── types.ts                      # IPC channel names + shared interfaces
└── renderer/src/
    ├── App.tsx                       # Theme, IPC subscriptions, FloatingSidebar
    ├── stores/
    │   ├── appStore.ts               # View, sidebar width/collapse, peek panel
    │   └── serviceStore.ts           # Services list, logs, ArctisState
    ├── components/
    │   ├── layout/                   # TopBar, Sidebar, FloatingSidebar, MainLayout
    │   ├── settings/                 # SettingsLayout, SettingsSidebar
    │   ├── home/                     # HeadsetCard, DisplayCard
    │   └── sonar/                    # Sonar volume mixer, presets, routing
    └── pages/
        ├── Home.tsx
        ├── Arctis.tsx
        ├── GgSonar.tsx
        └── settings/
            ├── GeneralSettings.tsx
            ├── DdcSettings.tsx
            ├── SonarSettings.tsx
            └── About.tsx
```

---

## Getting Started

```powershell
npm install
npm run dev        # Electron + Vite HMR
npm run build      # Production build
npm run package    # Build + Windows installer
```

### Required Dependencies

#### Python Packages
The Arctis HID service requires the `arctis_hid` Python package:

```powershell
python -m pip install git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development
```

If you use a non-default Python environment, set the executable path in **General Settings → Services → Python executable**.

#### Native Binaries
For primary display switching via DDC/CI, the app requires **NirCmd** (freeware):

1. Download `nircmd.exe` from https://www.nirsoft.net/utils/nircmd.html
2. Place it in `resources/nircmd/nircmd.exe`
3. The app will bundle it automatically during `npm run package`

#### Node.js Modules
- `@hensm/ddcci` — Windows DDC/CI library (included in `package.json`, auto-unpacked by electron-builder)
- `naudiodon2` — Audio device enumeration (requires `node-gyp` build; auto-rebuilt via `npm rebuild`)
- `fft.js` — FFT frequency analysis (pure JS, no native build)

---

## Implemented Features

- ✅ Arctis Nova Pro HID device support with event-driven state updates
- ✅ GG Sonar audio device routing and preset switching
- ✅ Auto-preset switching based on active window
- ✅ DDC/CI display control (brightness, contrast, input source)
- ✅ Primary display detection and switching
- ✅ Service enable/disable and log streaming
- ✅ Responsive sidebar with collapse/peek functionality
- ✅ Dark/light theme with CSS custom properties

## Roadmap

- [ ] Sidebar width and collapsed state persistence (`localStorage` / `electron-store`)
- [ ] Settings and theme persistence (`electron-store`)
- [ ] Headset write commands (volume, ANC mode, mute toggle, EQ adjustments)
- [ ] HDR / advanced monitor controls via DDC/CI
- [ ] Empty state on Home page when no devices are connected
- [ ] Clearable service log in About tab
- [ ] Periodic state polling for late-attach device sync
- [ ] Bundle JetBrains Mono font (currently loaded from Google Fonts)
- [ ] Auto-updater (`electron-updater`) — needs a release server URL
- [ ] Test suite (Vitest for renderer + main, Playwright for IPC integration)
- [ ] Mobile companion app (app state sync, remote control)
