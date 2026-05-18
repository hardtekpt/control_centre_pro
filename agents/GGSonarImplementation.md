# GG Sonar Integration — Implementation Reference

## Status: Implemented

The GG Sonar integration is complete. This document describes what was built, how it works,
and key decisions made during implementation.

For the full REST API reference, see [GGSonarHttpRestApi.md](GGSonarHttpRestApi.md).

---

## Context

GG Sonar is SteelSeries' software audio mixer. It exposes a local HTTP REST API discovered
dynamically via `https://127.0.0.1:6327/subApps`. The port changes on every GG restart.

Unlike the Arctis service (Python subprocess for USB HID), Sonar connects to an already-running
process via HTTP. No Python subprocess is needed — the service lives in the Electron main process
as a Node.js HTTP polling client (`src/main/services/sonarService.ts`).

---

## Architecture

```
GG Sonar (running separately)
    ↑ HTTP polls every 1–5 s
src/main/services/sonarService.ts
    ↓ IPC push: SONAR_STATE_CHANGE
src/renderer/src/stores/sonarStore.ts
    ↓ reads
src/renderer/src/pages/GGSonar.tsx + components/gg-sonar/
```

Write path (renderer → hardware):
```
User action (drag fader / click preset)
  → window.api.sonarSetVolume(channel, value)
  → IPC SONAR_SET_VOLUME
  → sonarService.ts: optimistic state update + HTTP PUT
  → IPC push: SONAR_STATE_CHANGE (updated state)
  → sonarStore updated
```

---

## Service: sonarService.ts

**Discovery**: `GET https://127.0.0.1:6327/subApps` (HTTPS, `rejectUnauthorized: false`)
→ read `subApps.sonar.metadata.webServerAddress` for the dynamic port.
On failure: set `available: false`, retry discovery on next poll cycle.

**Polling intervals**:

| Interval | Endpoints |
|---|---|
| 1 s (fast) | `/mode`, `/volumeSettings/classic`, `/volumeSettings/streamer`, `/chatMix` |
| 5 s (slow) | `/configs`, `/configs/selected`, `/AudioDeviceRouting`, `/audioDevices`, `/classicRedirections`, `/streamRedirections` |

**Write commands** (all optimistic — update local state immediately, send HTTP async):
- Set classic volume: `PUT /volumeSettings/classic/{channelKey}/Volume/{value}`
- Set classic mute: `PUT /volumeSettings/classic/{channelKey}/Mute/{true|false}`
- Set streamer volume: `PUT /volumeSettings/streamer/{mix}/{channelKey}/volume/{value}`
- Set mode: `PUT /mode/{classic|stream}`
- Select preset: `PUT /configs/{configId}/select`
- Set redirection: `PUT /classicRedirections/{channelDictKey}/deviceId/{deviceId}`
- Route process: `PUT /AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}`

**All PUT endpoints use path parameters only — no JSON body.**

---

## Channel Key Naming (Critical Detail)

Sonar uses three different key formats depending on context. Using the wrong one silently fails.

| Channel | JSON response key | HTTP volume path | ChannelDict (redirection) |
|---|---|---|---|
| Master | `masters` | `Master` | `master` |
| Game | `game` | `game` | `game` |
| Chat (render) | `chatRender` | `chatRender` | `chat` |
| Mic (capture) | `chatCapture` | `chatCapture` | `mic` |
| Media | `media` | `media` | `media` |
| Aux | `aux` | `aux` | `aux` |

Note: the mode API uses `"stream"` not `"streamer"` — observed from actual API responses.

---

## Preset Limitations

**Preset creation, editing, and deletion are NOT supported via the HTTP API.**

The API only allows:
- `GET /configs` — read all presets
- `GET /configs/selected` — read currently active preset per channel
- `PUT /configs/{configId}/select` — activate an existing preset

To create or modify presets, users must use the SteelSeries GG application. This is confirmed by
the [SteelSeries-NET-API source](https://github.com/DataNext27/SteelSeries-NET-API) — only GET
and PUT /select are implemented; no POST/DELETE or edit endpoints exist.

The UI makes this clear: the PresetEditor panel is read-only, showing preset data with a banner
explaining that editing requires GG.

---

## Zustand Store: sonarStore.ts

```typescript
interface SonarStoreState {
  sonarState: SonarState | null        // null until first successful poll
  activePresetIds: Record<string, string>  // virtualAudioDevice -> configId
}
```

`sonarState` mirrors the full API response shape. `activePresetIds` is a flat map from
`virtualAudioDevice` (channel name) to the currently selected config ID — derived from
`GET /configs/selected` and updated on every preset switch.

---

## UI Components

### GGSonar.tsx

The main page. Shows:
- Status indicator (GG detected / not detected)
- Classic / Streamer mode toggle
- `ChannelMixer` component with all 6 channels

### ChannelMixer.tsx

Container for 6 `ChannelStrip` columns. Maps routing sessions and presets to each channel.
Handles `handleVolume`, `handleMute`, `handlePresetSelect`.

### ChannelStrip.tsx

Vertical channel column:
```
┌──────────┐
│  MASTER  │
│  100%    │
│          │
│  [fader] │  ← custom div-based vertical slider (flex-1 height, mouse events)
│          │
│  [mute]  │
│──────────│
│ FPS   ✎  │  ← preset dropdown + edit button
│──────────│
│ ● Steam  │  ← routed apps from AudioDeviceRouting
│ ● Game   │
└──────────┘
```

The fader is a custom div element using mouse drag events rather than `<input type="range">`,
which allows vertical orientation without CSS hacks and fills available height naturally.

### PresetEditor.tsx

Right-side overlay (320px). Shows full config data read-only: EQ, boosts, spatial, smart volume,
voice features. Displays a note that preset content cannot be edited via the API.

---

## IPC Channels

```typescript
SONAR_GET_STATE: 'sonar:getState',
SONAR_STATE_CHANGE: 'sonar:stateChange',
SONAR_SET_VOLUME: 'sonar:setVolume',
SONAR_SET_MUTE: 'sonar:setMute',
SONAR_SELECT_PRESET: 'sonar:selectPreset',
SONAR_SET_MODE: 'sonar:setMode',
SONAR_GET_POLLING_CONFIG: 'sonar:getPollingConfig',
SONAR_SET_POLLING_CONFIG: 'sonar:setPollingConfig',
SONAR_SET_REDIRECTION: 'sonar:setRedirection',
SONAR_ROUTE_PROCESS: 'sonar:routeProcess',
SONAR_REFRESH_DEVICES: 'sonar:refreshDevices',
```

---

## Preset Auto-Switcher Integration

The preset auto-switcher (`activeWindowMonitor.ts`) calls `sonarService.selectPreset()` directly
when a foreground app match is detected. It does not go through the renderer IPC path.

When a user manually selects a preset in the GG Sonar page, the switcher marks that channel as
"manually overridden" and does not re-apply the rule until the foreground app changes.

---

## Shared Types (src/shared/types.ts)

```typescript
export type SonarMode = 'classic' | 'stream'   // note: API returns "stream" not "streamer"
export const SONAR_CHANNELS = ['master','game','chatRender','chatCapture','media','aux'] as const
export type SonarChannel = (typeof SONAR_CHANNELS)[number]

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
export interface SonarConfig {
  id: string; name: string; virtualAudioDevice: string; data: SonarConfigData
  isPreset: boolean; isFavorite: boolean; favoritePosition: number
  image: string; createdAt: string; updatedAt: string
}
export interface SonarState {
  available: boolean; mode: SonarMode
  classic: SonarClassicVolumes | null; streamer: SonarStreamerVolumes | null
  configs: SonarConfig[]; routing: SonarDeviceRoute[]
  chatMix: SonarChatMix | null
  audioDevices: SonarAudioDevice[]; classicRedirections: SonarClassicRedirection[]
  streamRedirections: SonarStreamRedirection[]; selectedConfigs: SonarConfig[]
}
```

---

## Key Lessons Learned

1. **Port changes on every GG restart**: discovery must be re-attempted on every connection
   failure, not just on startup.

2. **Three channel key formats**: the naming inconsistency (`chatRender` vs `chatCapture` vs
   `chat` vs `mic`) is a Sonar API quirk, not a bug. Always use the correct key for the
   endpoint you're calling.

3. **Mode is `"stream"` not `"streamer"`**: the GET `/mode` response and PUT `/mode/{key}`
   both use `"stream"`. Using `"streamer"` silently fails.

4. **Optimistic updates prevent lag**: Sonar HTTP round-trips take ~50–200ms. Applying state
   locally before the HTTP call completes gives the UI instant response for volume fader drags.

5. **`/configs/selected` vs `/configs`**: `/configs` returns all presets; `/configs/selected`
   returns only the active ones per channel. Use `/configs/selected` to know what's currently
   active without scanning the full list.

6. **Audio device routing GUIDs**: `GET /AudioDeviceRouting` returns entries with a `deviceId`
   that is Sonar's **virtual** channel device GUID, not a Windows physical device GUID. For
   routing a process to a channel: use `targetVirtualDeviceId` from the routing response.
   For assigning a physical device to a channel: use the Windows GUID from `/audioDevices`.

7. **Preset editing is truly impossible via API**: no workaround exists. The GG application is
   the only edit surface. The UI should make this clear rather than hiding the limitation.
