# Control Centre Pro

A Windows desktop application for managing hardware devices and running custom background services. Think of it as a personal control panel: monitor connected devices, start and stop services, and get at-a-glance status for everything running on your machine.

The app is designed as an extensible shell. The MVP establishes the layout, navigation patterns, and service infrastructure; device and service plugins are added as sidebar sections over time.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 31+ |
| UI | React 18 + TypeScript (strict mode) |
| Bundler | electron-vite |
| Styling | Tailwind CSS + CSS custom properties |
| State | Zustand |
| Packaging | electron-builder |
| Background services | Python subprocesses (newline-delimited JSON over stdout) |

---

## Features

### Device Management
- **Arctis Nova Pro headset support** — battery level (headset + dock), ANC mode, mic mute, volume, all via direct USB HID (no SteelSeries GG required)
- **Live event-driven updates** — headset state refreshes instantly on `VolumeEvent`, `BatteryEvent`, `AncModeEvent`, `MicMuteEvent`
- **Auto-connect / auto-disconnect** — `HeadsetCard` mounts and unmounts automatically as the device is plugged in or removed

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
└── services/
    └── arctis_hid_service.py     # Arctis Nova Pro HID service

src/
├── main/
│   ├── index.ts                  # Window creation, IPC handlers, lifecycle
│   └── services/
│       └── serviceManager.ts     # Spawns/monitors Python subprocesses
├── preload/
│   └── index.ts                  # contextBridge — exposes window.api
├── shared/
│   └── types.ts                  # IPC channel names + shared interfaces
└── renderer/src/
    ├── App.tsx                   # Theme, IPC subscriptions, FloatingSidebar
    ├── stores/
    │   ├── appStore.ts           # View, sidebar width/collapse, peek panel
    │   └── serviceStore.ts       # Services list, logs, ArctisState
    ├── components/
    │   ├── layout/               # TopBar, Sidebar, FloatingSidebar, MainLayout
    │   ├── settings/             # SettingsLayout, SettingsSidebar
    │   └── home/                 # HeadsetCard
    └── pages/
        ├── Home.tsx
        └── settings/
            ├── GeneralSettings.tsx
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

The Arctis HID service requires the `arctis_hid` Python package:

```powershell
python -m pip install git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development
```

If you use a non-default Python environment, set the executable path in **General Settings → Services → Python executable**.

---

## Roadmap

- [ ] Sidebar width and collapsed state persistence (`localStorage` / `electron-store`)
- [ ] Theme persistence
- [ ] Write commands for headset (volume, ANC mode, mute toggle)
- [ ] Empty state on Home page when no devices are connected
- [ ] Clearable service log in About tab
- [ ] Periodic state polling for late-attach device sync
- [ ] Bundle JetBrains Mono font (currently loaded from Google Fonts)
- [ ] Auto-updater (`electron-updater`) — needs a release server URL
- [ ] Test suite (Vitest for renderer + main, Playwright for IPC integration)
