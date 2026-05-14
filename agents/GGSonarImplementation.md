# GG Sonar Full Integration — Implementation Plan

## Context

GG Sonar is SteelSeries' software audio mixer. It exposes a local REST HTTP API (discovered dynamically via `https://127.0.0.1:6327/subApps`) running on a random port that changes each GG restart. The goal is to replace the stub `GGSonar.tsx` placeholder with a full-featured Sonar control panel: a complete audio mixer, preset manager, preset editor (EQ, spatial, boosts, smart volume), routing display, streamer mode, and enable/disable — a local replacement for the GG Sonar desktop app.

Unlike the Arctis service (Python subprocess for USB HID), Sonar connects to an already-running process via HTTP. No Python subprocess needed — the service lives in the Electron main process as a Node.js HTTP polling client.

---

## Confirmed API Endpoints

```
GET  https://127.0.0.1:6327/subApps       → discover dynamic Sonar port (HTTPS, rejectUnauthorized: false)
GET  /mode                                → "classic" | "streamer"
GET  /volumeSettings/classic             → masters + 5 channel volumes/mutes
GET  /volumeSettings/streamer            → streaming + monitoring mixes per channel
GET  /chatMix                             → { balance, state }
GET  /AudioDeviceRouting                  → device roles + routed audio sessions
GET  /configs                             → full preset catalog (EQ, boosts, spatial, etc.)

PUT  /volumeSettings/classic/{channel}/Volume/{value}   → set volume (0.0–1.0)
PUT  /volumeSettings/classic/{channel}/Mute/{true|false}→ set mute
PUT  /configs/{presetId}/select                         → activate a preset
```

Channels: `master`, `game`, `chatRender`, `chatCapture`, `media`, `aux`

**Investigate (build UI, try at runtime):**
- `PUT /mode` with body `"classic"` or `"streamer"` — streamer mode toggle
- `PUT /volumeSettings/streamer/{channel}/Volume/{value}` — streamer volume writes
- `PUT /configs/{id}` with full config body — preset editing (EQ, boosts)

---

## New Types — `src/shared/types.ts`

Add after existing Arctis types:

```typescript
export type SonarMode = 'classic' | 'streamer'
export const SONAR_CHANNELS = ['master','game','chatRender','chatCapture','media','aux'] as const
export type SonarChannel = (typeof SONAR_CHANNELS)[number]
export type SonarDeviceChannel = 'game' | 'chatRender' | 'chatCapture' | 'media' | 'aux'

export interface SonarChannelVolume { volume: number; muted: boolean }
export interface SonarStreamerMix { streaming: SonarChannelVolume; monitoring: SonarChannelVolume }

export interface SonarClassicVolumes {
  masters: { classic: SonarChannelVolume; stream: object }
  devices: Record<SonarDeviceChannel, { classic: SonarChannelVolume; stream: object }>
}
export interface SonarStreamerVolumes {
  masters: { stream: SonarStreamerMix; classic: SonarChannelVolume }
  devices: Record<SonarDeviceChannel, { stream: SonarStreamerMix; classic: SonarChannelVolume }>
}
export interface SonarAudioSession {
  id: string; processName: string; processId: number; displayName: string
  isSystemSound: boolean; state: string
  isRoutingErrorProne: boolean; routingErrorDetected: boolean
}
export interface SonarDeviceRoute { deviceId: string; role: string; dataFlow: string; audioSessions: SonarAudioSession[] }
export interface SonarConfigData {
  bassBoostState?: { enabled: boolean; value: number }
  trebleBoostState?: { enabled: boolean; value: number }
  voiceClarityState?: { enabled: boolean; value: number }
  smartVolume?: { enabled: boolean; volumeLevel: number; loudness: string }
  generalGain?: number
  parametricEQ?: { enabled: boolean }
  virtualSurroundState?: boolean; reverbGainDB?: number; formFactor?: string; globalEnableState?: boolean
  noiseReductionState?: { enabled: boolean }; volumeStabilizerState?: { enabled: boolean }
  noiseGateState?: { enabled: boolean }; automaticNoiseGateState?: { enabled: boolean }
  impactNoiseReductionState?: { enabled: boolean }; noiseCancelingState?: { enabled: boolean }
  acousticEchoCancelingState?: { enabled: boolean }
}
export interface SonarConfig {
  id: string; name: string; virtualAudioDevice: string; data: SonarConfigData
  isPreset: boolean; isFavorite: boolean; favoritePosition: number
  image: string; createdAt: string; updatedAt: string
}
export interface SonarChatMix { balance: number; state: string }
export interface SonarState {
  available: boolean; mode: SonarMode
  classic: SonarClassicVolumes | null; streamer: SonarStreamerVolumes | null
  configs: SonarConfig[]; routing: SonarDeviceRoute[]; chatMix: SonarChatMix | null
}
```

New IPC channels:
```typescript
SONAR_GET_STATE: 'sonar:getState',
SONAR_STATE_CHANGE: 'sonar:stateChange',
SONAR_SET_VOLUME: 'sonar:setVolume',
SONAR_SET_MUTE: 'sonar:setMute',
SONAR_SELECT_PRESET: 'sonar:selectPreset',
SONAR_SET_MODE: 'sonar:setMode',
```

---

## New File: `src/main/services/sonarService.ts`

Node.js HTTP polling service. Uses `https` module (rejectUnauthorized: false) for discovery, `http` for all Sonar calls.

- **Discovery**: `GET https://127.0.0.1:6327/subApps` → parse `subApps.sonar.metadata.webServerAddress`
- **Fast poll (1 s)**: `/mode`, `/volumeSettings/classic`, `/volumeSettings/streamer`, `/chatMix`
- **Slow poll (5 s)**: `/configs`, `/AudioDeviceRouting`
- **On failure**: clear `baseUrl`, set `available: false`, retry discovery on next poll

Write commands do optimistic local state updates + push to renderer.

---

## Channel Layout (key design)

Each channel column contains ALL its controls stacked vertically:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  MASTER  │   GAME   │   CHAT   │   MIC    │  MEDIA   │   AUX    │
│  100%    │   80%    │   56%    │  100%    │  100%    │    6%    │
│          │          │          │          │          │          │
│  [fader] │  [fader] │  [fader] │  [fader] │  [fader] │  [fader] │
│          │          │          │          │          │          │
│  [mute]  │  [mute]  │  [mute]  │  [mute]  │  [mute]  │  [mute]  │
│──────────│──────────│──────────│──────────│──────────│──────────│
│  (none)  │ FPS   ✎  │ Voice ✎  │ Mic   ✎  │ Music ✎  │ Aux   ✎  │
│──────────│──────────│──────────│──────────│──────────│──────────│
│          │ ● Steam  │ ● Discord│          │ ● Spotify│          │
│          │ ● Game   │          │          │ ● Chrome │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

Custom div-based vertical fader (mouse drag), fills available height.

---

## New UI Components

### `src/renderer/src/components/gg-sonar/ChannelStrip.tsx`
Vertical channel column. Custom fader (div + mouse events, `flex-1` height). Below: mute button, divider, preset dropdown + edit button, divider, routed apps list.

### `src/renderer/src/components/gg-sonar/ChannelMixer.tsx`
Container for 6 ChannelStrip columns. Maps routing sessions and presets to each channel. Handles `handleVolume`, `handleMute`, `handlePresetSelect`.

### `src/renderer/src/components/gg-sonar/PresetEditor.tsx`
Fixed right-side overlay (320px). Shows full config data read-only (EQ, boosts, spatial, smart volume, voice features). Favorites display. Read-only banner noting write endpoint investigation.

---

## File Change Summary

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `SonarState`, 7 interfaces, `SONAR_CHANNELS`, 6 IPC channels |
| `src/main/services/sonarService.ts` | **New** — HTTP discovery + polling + write commands |
| `src/main/index.ts` | Init `SonarService`, 5 IPC handlers |
| `src/preload/index.ts` | 6 new Sonar API methods |
| `src/renderer/src/types/electron.d.ts` | Declare 6 Sonar methods on `Window['api']` |
| `src/renderer/src/stores/sonarStore.ts` | **New** — Zustand store with activePresetIds |
| `src/renderer/src/App.tsx` | Add sonar state init + subscription effect |
| `src/renderer/src/components/gg-sonar/ChannelStrip.tsx` | **New** |
| `src/renderer/src/components/gg-sonar/ChannelMixer.tsx` | **New** |
| `src/renderer/src/components/gg-sonar/PresetEditor.tsx` | **New** |
| `src/renderer/src/pages/GGSonar.tsx` | Replace 30-line stub with full page |

---

## Verification

1. `npm run dev` — app starts.
2. With GG running: open GG Sonar page → status dot is green, all channels show real volumes.
3. Drag a volume fader → GG Sonar app reflects the change immediately.
4. Click mute → channel mutes in GG app.
5. Click a preset dropdown → preset activates in GG app.
6. Click Classic ↔ Streamer toggle → mixer switches to streaming/monitoring view.
7. With GG closed: status shows "not detected", page shows unavailable state.
8. Start GG while app is open → page auto-reconnects within ~5 s.
9. Click preset edit button → PresetEditor slides in with EQ/boost/spatial data.
