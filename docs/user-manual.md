# Control Centre Pro — User Manual

## What Is Control Centre Pro?

Control Centre Pro is a Windows desktop application that gives you one place to manage all your connected hardware and audio settings. It currently supports:

- **SteelSeries Arctis Nova Pro Wireless** headset — battery, ANC, volume, mic, ChatMix
- **DDC/CI monitors** — brightness, input source, primary display switching
- **SteelSeries GG Sonar** — per-channel audio mixing, preset management, app routing

The app runs in the background and shows real-time on-screen notifications when hardware events occur (volume change, mic mute, preset change, etc.).

---

## Getting Started

### First Launch

On first launch the app will appear with its sidebar visible. The main dashboard shows connected hardware. If nothing is connected yet, the sections will be empty.

### Sidebar Navigation

The left sidebar contains the main navigation:

| Section | What it does |
|---|---|
| **Home** | Dashboard with connected devices at a glance |
| **Arctis** | Full headset control panel |
| **GG Sonar** | Audio mixer and preset management |
| **Shortcuts** | Preset auto-switcher rules |
| **Notifications** | Preview and configure OSD notifications |

At the bottom of the sidebar is the **Settings** button (gear icon). Click it to open the settings panel.

### Collapsing the Sidebar

Click the sidebar toggle button in the top bar to collapse the sidebar. While collapsed, **hover over the toggle button** to see a floating peek panel — you can navigate without fully expanding the sidebar.

Drag the right edge of the sidebar to resize it. The sidebar remembers its width.

### Theme

Go to **Settings → General** to switch between light and dark theme.

---

## Home Dashboard

The Home page shows all connected hardware in a grid:

- **Headset card** (top) — appears when the Arctis Nova Pro is connected. Shows battery levels, ANC mode, mic status, and volume.
- **Display cards** — one card per DDC-capable monitor. Shows brightness, current input, and a "Primary" badge.

---

## Headset (Arctis Nova Pro)

The headset is controlled via direct USB HID — **SteelSeries GG is not required**. However, the Python service must be running (see [Service Requirements](#service-requirements)).

### What the App Shows

- **Battery** — headset and dock percentage
- **ANC mode** — Off, Transparency, or Active Noise Cancellation
- **Mic mute** status
- **Volume** level
- **Wireless** and Bluetooth connection state

### Notifications

When any headset state changes, a small on-screen notification appears (center-bottom of screen). You can configure which notifications fire and their style in **Settings → Notifications** or the **Notifications** page.

---

## Displays (DDC/CI)

DDC/CI is a monitor standard that lets software control brightness, contrast, and input source over the video cable.

### Brightness

Drag the brightness slider on any display card. The change is applied immediately. The slider uses optimistic updates — the value updates on screen before the hardware confirms.

### Input Source

Click the input source dropdown and select a source. The monitor switches immediately. A notification appears showing the new input name.

### Primary Display

Each display card shows a **Primary** badge on the current primary monitor. To change the primary display:

1. Find the monitor you want to set as primary.
2. Click **Set as primary** on that card.
3. Windows display settings will reflect the change immediately.

> **Note**: This requires `nircmd.exe` to be present at `resources/nircmd/nircmd.exe`. See [Setup](#setup).

### Not Seeing Your Monitor?

Some monitors do not support DDC/CI, or the feature may be disabled in the monitor's OSD menu. Check your monitor's settings under "Advanced" or "Display" options and enable "DDC/CI".

---

## GG Sonar Audio Mixer

GG Sonar is SteelSeries' audio mixer software. Control Centre Pro connects to it over its local HTTP API. **SteelSeries GG must be running** for this feature to work.

### Volume Mixer

The GG Sonar page shows a vertical mixer with one column per channel:

| Channel | What it controls |
|---|---|
| **Master** | Overall output level |
| **Game** | Game audio |
| **Chat** | Voice chat (render, e.g. Discord output) |
| **Mic** | Microphone input level |
| **Media** | Media players (Spotify, browser video, etc.) |
| **Aux** | Auxiliary channel |

Drag the fader to adjust volume. Click the mute button below the fader to mute/unmute.

### Classic vs Streamer Mode

Toggle between Classic and Streamer mode at the top of the page:

- **Classic**: single mix output
- **Streamer**: separate streaming and monitoring mixes per channel

### Presets

Below each channel fader is a preset dropdown. Select a preset to activate it for that channel. The preset list comes from your GG Sonar library.

> **You cannot create or edit presets from Control Centre Pro** — the GG Sonar HTTP API only supports selecting existing presets. To create or edit presets, use the SteelSeries GG application.

### Audio Device Routing

Below the preset selector for each channel, the mixer shows which apps are currently routed to that channel (e.g. "Steam", "Discord", "Spotify"). This is read-only — routing is managed by Windows and GG Sonar automatically.

### GG Not Detected

If GG Sonar is not running or GG is not installed, the page shows an "unavailable" state. Start SteelSeries GG and the app will reconnect within a few seconds automatically.

---

## Preset Auto-Switcher (Shortcuts)

The Shortcuts page lets you configure rules that automatically switch a GG Sonar preset when a specific app becomes the active (foreground) window.

### Creating a Rule

1. Go to the **Shortcuts** page.
2. Click **Add rule**.
3. Set the **process name** (e.g. `Spotify.exe`, `chrome.exe`).
4. Select the **Sonar channel** and **preset** to activate.
5. Save.

When you switch to the matching app, the selected preset is activated automatically.

### Manual Override

If you manually select a different preset while an auto-switcher rule is active, the auto-switcher will not override your choice until you switch away from the app and back.

### Enable / Disable

Use the toggle at the top of the Shortcuts page to enable or disable the auto-switcher globally without deleting your rules.

---

## Notifications

The Notifications page lets you preview the different notification shapes and configure which events trigger a notification.

### Notification Shapes

| Shape | Description |
|---|---|
| **Circle** | Small icon-only badge |
| **Ring** | Icon with a circular progress arc (for values like volume or battery) |
| **Volume** | Wide pill with icon, label, and horizontal bar |
| **Rect** | Icon with title and subtitle text |

### Configuring Notifications

Go to **Settings → Notifications** to configure each notification type:

- Toggle individual notifications on or off
- Choose the shape for each event type
- Set the global display duration

Events you can configure:

**Headset:**
- Power on / Power off
- Wireless connected / disconnected
- Bluetooth connected / disconnected
- Mic mute / unmute
- Volume change
- ANC mode change
- Battery low warning
- Battery charging
- Dock inserted / removed
- ChatMix change
- Sidetone change

**GG Sonar:**
- Preset change

**Display:**
- Input source change

---

## Settings

Access settings via the **Settings chip** at the bottom of the sidebar.

### General

- **Theme** — Light or Dark
- **Minimize to tray on close** — when enabled, closing the window keeps the app running in the system tray

**Services:**
- **Python executable** — path to the Python interpreter used to run hardware services. Change this if you use a virtual environment (e.g. `C:\Python311\python.exe` or a venv path).
- Enable/disable each service individually.

### DDC (Display)

- **Poll interval** — how often the app re-reads monitor state in the background (default 60 seconds). Faster intervals give more responsive state but slow down on lower-end DDC hardware.

### GG Sonar

- Polling configuration for Sonar API refresh rates.

### Notifications

- Global duration for OSD notifications (minimum 2 seconds).
- Per-event enable/disable and shape selection.

### About

- App version
- Live service log — scrollable terminal showing all output from background services. Useful for diagnosing connection issues with the headset service.

---

## Service Requirements

Control Centre Pro uses two types of background services:

### Python Service (Arctis HID)

The Arctis headset is controlled via a Python script. You need:

1. **Python 3.x** installed on your machine.
2. The `arctis_hid` package:
   ```
   python -m pip install git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development
   ```

If you use a virtual environment, set the Python path in **Settings → General → Python executable**.

If the service fails to start, the error is shown in **Settings → About**.

### GG Sonar (HTTP)

GG Sonar connects automatically to a running instance of **SteelSeries GG**. No configuration is needed. If GG is not running, the GG Sonar page shows an unavailable state.

### NirCmd (Primary Display Switching)

To use the "Set as primary" feature on display cards, place `nircmd.exe` at:
```
resources/nircmd/nircmd.exe
```
Download from: https://www.nirsoft.net/utils/nircmd.html

---

## System Tray

If **Minimize to tray** is enabled in General Settings, closing the main window keeps the app running in the system tray. Right-click the tray icon to:

- Open the main window
- Quit the app

OSD notifications continue to work while the app is in the tray.

---

## Troubleshooting

### Headset not detected

1. Check that SteelSeries GG is **not running** (it conflicts with direct HID access).
2. Check that the Python service is running — look in **Settings → About** for error messages.
3. Verify the Python executable path in **Settings → General**.
4. Try unplugging and replugging the headset USB dongle.

### Display brightness slider not responding

1. Verify your monitor supports DDC/CI. Check the monitor's OSD menu and enable it if available.
2. Wait a few seconds — DDC calls can take 200–400ms per operation.
3. Try unplugging and replugging the monitor video cable.

### GG Sonar showing "not detected"

1. Ensure SteelSeries GG is running and Sonar is open inside GG.
2. The app will reconnect automatically within ~5 seconds of GG starting.

### OSD notifications not appearing

1. Check **Settings → Notifications** and verify the specific notification type is enabled.
2. Check that **Global notifications** is not disabled.
3. Ensure the OSD duration is set high enough to see (minimum 2 seconds).
