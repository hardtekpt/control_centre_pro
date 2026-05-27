# GG Sonar REST API

_Confirmed from: Fiddler Classic captures (2026-05-27) + [SteelSeries-NET-API (DataNext27)](https://github.com/DataNext27/SteelSeries-NET-API)_

## Discovery

Resolve Sonar from GG:

```http
GET https://127.0.0.1:6327/subApps
```

Response:

```json
{
  "subApps": {
    "sonar": {
      "metadata": {
        "webServerAddress": "http://127.0.0.1:58748"
      }
    }
  }
}
```

Use the `webServerAddress` value as the base URL for all Sonar endpoints. Port is dynamic.

## Available Features

### Read

- Full one-shot status (mode, per-channel device + config)
- Mode (`classic` / `stream`)
- Classic channel volumes and mute state
- Streamer channel volumes for `streaming` and `monitoring` mixes
- Chat mix balance
- Audio device routing and routed audio sessions
- Full preset/config catalog (369+ presets including built-in and user)
- Currently selected config per channel
- Available Windows audio devices
- Classic and streamer channel device redirections
- Physical output selection (HeadphoneOut / LineOut)
- Stream monitoring lock state
- Audio preview samples + playback state
- Fallback device lists per channel
- Quickset game-profile map
- OSD overlay settings
- Volume link-all state

### Write

- Create / modify / rename / reset / delete configs (full CRUD via `PUT /configs` upsert + `DELETE /configs/{id}`)
- Toggle config favorite (`PUT /configs/{id}/isFavorite/{bool}`)
- Select active config per channel
- Set mode
- Set classic/streamer channel volume and mute
- Assign Windows audio device to a channel
- Route audio process to a channel
- Set chat mix balance
- Toggle stream monitoring
- Play audio preview samples

## Channel Name Maps

Sonar uses different channel key strings depending on the endpoint context:

| Channel | JSON / `devices` key | HTTP volume path key | ChannelDict (redirection path) |
|---|---|---|---|
| Master | `masters` | `Master` | `master` |
| Game | `game` | `game` | `game` |
| Chat (render) | `chatRender` | `chatRender` | `chat` |
| Mic (capture) | `chatCapture` | `chatCapture` | `mic` |
| Media | `media` | `media` | `media` |
| Aux | `aux` | `aux` | `aux` |

## Endpoint Mapping

| Feature | Method | Endpoint | Notes |
|---|---|---|---|
| Discover Sonar host | `GET` | `https://127.0.0.1:6327/subApps` | Returns `subApps.sonar.metadata.webServerAddress` |
| **One-shot status** | `GET` | `/v1/status` | Mode + all channel devices + active config per channel |
| Read mode | `GET` | `/mode` | Returns JSON string: `"classic"` or `"stream"` |
| Read classic volumes | `GET` | `/volumeSettings/classic/` | Returns `{ masters, devices }` |
| Read streamer volumes | `GET` | `/volumeSettings/streamer/` | Returns `{ masters, devices }` with streaming/monitoring branches |
| Read device volumes | `GET` | `/volumeSettings/devices/volumes` | Per-physical-device volume: `[{ deviceId, volume }]` |
| Read chat mix | `GET` | `/chatMix` | Returns `{ balance, state }` |
| Read routing | `GET` | `/AudioDeviceRouting` | Array of route entries with nested `audioSessions` |
| Read all configs | `GET` | `/configs` | Array of all config objects (user + built-in) |
| Read selected configs | `GET` | `/configs/selected` | Array of currently selected config per channel |
| Read audio devices | `GET` | `/audioDevices` | Array; filter `role === "none"` for physical Windows devices |
| Read classic redirections | `GET` | `/classicRedirections` | **Array** of `{ id, deviceId }` per channel |
| Read streamer redirections | `GET` | `/streamRedirections` | **Array** of `{ streamRedirectionId, deviceId }` |
| Read stream monitoring state | `GET` | `/streamRedirections/isStreamMonitoringEnabled` | Boolean |
| Read stream monitoring lock | `GET` | `/streamRedirections/isStreamMonitoringLocked` | Boolean — true when hardware controls monitoring |
| Read physical output | `GET` | `/deviceOut` | `{ selectedDeviceOut, deviceOutSettings[] }` |
| Read audio samples | `GET` | `/audioSamples/samples` | `[{ role, id, isPlaying }]` — available preview samples |
| Read recording state | `GET` | `/audioSamples/isRecording` | Boolean |
| Read fallback lists | `GET` | `/fallbackSettings/lists` | Per-channel device lists with `isPrevious`/`isNext`/`isSteelseriesWirelessSupported` metadata |
| Read fallback enabled | `GET` | `/fallbackSettings/isEnabled` | Boolean |
| Read link-all | `GET` | `/linkAll/isRenderLinkAllEnabled` | Boolean |
| Read OSD overlays | `GET` | `/overlays` | `{ settings[], subAppOverlaysEnabled }` |
| Read quickset profiles | `GET` | `/quickset/profiles` | Array of `{ id, name, isGame, gameImagePath, sonarConfigId }` |
| **Set mode** | `PUT` | `/mode/{modeKey}` | `modeKey`: `classic` or `stream`. No body. |
| **Set classic volume** | `PUT` | `/volumeSettings/classic/{channelHttpKey}/Volume/{value}` | No body. |
| **Set classic mute** | `PUT` | `/volumeSettings/classic/{channelHttpKey}/Mute/{true\|false}` | No body. |
| **Set streamer volume** | `PUT` | `/volumeSettings/streamer/{mix}/{channelHttpKey}/volume/{value}` | `mix`: `monitoring` or `streaming`. No body. |
| **Set streamer mute** | `PUT` | `/volumeSettings/streamer/{mix}/{channelHttpKey}/isMuted/{true\|false}` | No body. |
| **Create / modify config** | `PUT` | `/configs` | JSON body: full config object. Returns saved config. See below. |
| **Delete config** | `DELETE` | `/configs/{configId}` | No body. Returns 204 No Content. |
| **Select config** | `PUT` | `/configs/{configId}/select` | No body. Returns selected config object. |
| **Toggle config favorite** | `PUT` | `/configs/{configId}/isFavorite/{true\|false}` | No body. Returns updated config list for that channel. |
| **Set classic redirection** | `PUT` | `/classicRedirections/{channelDictKey}/deviceId/{deviceId}` | `channelDictKey` uses ChannelDict column. No body. GUID braces URL-encoded. |
| **Set streamer redirection (mic)** | `PUT` | `/streamRedirections/{channelDictKey}/deviceId/{deviceId}` | `channelDictKey` = `mic`. No body. |
| **Set streamer redirection (mix)** | `PUT` | `/streamRedirections/{mix}/deviceId/{deviceId}` | `mix`: `monitoring` or `streaming`. No body. |
| **Route process to channel** | `PUT` | `/AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}` | `dataFlow`: `render` or `capture`. No body. |
| **Set chat mix balance** | `PUT` | `/chatMix?balance={value}` | Query param. Range: -1.0 to 1.0. No body. |
| **Toggle stream monitoring** | `PUT` | `/streamRedirections/isStreamMonitoringEnabled/{true\|false}` | No body. |
| **Play audio sample** | `PUT` | `/audioSamples/{role}/{sampleId}` | Plays preview sample. No body. Returns updated samples array. |
| **Toggle link-all** | `PUT` | `/linkAll/isRenderLinkAllEnabled/{true\|false}` | No body. |

> **Most PUT endpoints use path parameters only — no JSON body. Exception: `PUT /configs` takes the full config object as JSON body.**

---

## Config CRUD — `PUT /configs`

All config mutations (create, modify, rename, duplicate, reset) use the same endpoint:

```http
PUT /configs
Content-Type: application/json
```

The server uses the `id` field in the body to determine create vs update. Response is always the saved config object.

### Create new config

Supply a client-generated UUID v4 with `createdAt` = `updatedAt` = current UTC timestamp. `isPreset` must be `false`. `isFavorite` = `false`, `favoritePosition` = `-1`.

```json
{
  "id": "<new-uuid-v4>",
  "name": "My Preset",
  "createdAt": "2026-05-27T18:25:42.000Z",
  "updatedAt": "2026-05-27T18:25:42.000Z",
  "virtualAudioDevice": "game",
  "data": { /* full data object — see schema below */ },
  "schemaVersion": 5,
  "isPreset": false,
  "defaultData": { /* same as data */ },
  "image": "8.svg",
  "isFavorite": false,
  "favoritePosition": -1,
  "releaseVersion": null
}
```

### Modify / rename / reset

Send the full config object with the existing `id`. Only `data`, `name`, or both need to change — all other fields pass through unchanged. Set `updatedAt` to the current timestamp.

**Reset to defaults**: copy `defaultData` into `data` and send.

### Duplicate

Read the source config from `GET /configs`, generate a new UUID v4, set `createdAt` = `updatedAt` = now, `isFavorite` = `false`, `favoritePosition` = `-1`, and optionally append ` *` to the name (GG's convention). Send as a create.

### Delete

```http
DELETE /configs/{configId}
```

Response: `204 No Content`. Cannot delete built-in presets (`isPreset: true`).

---

## Config Data Schemas

### Game / Media / Aux / ChatRender (`schemaVersion: 5`)

```json
{
  "bassBoostState":      { "enabled": true,  "value": 0 },
  "trebleBoostState":    { "enabled": true,  "value": 0 },
  "voiceClarityState":   { "enabled": true,  "value": 0 },
  "smartVolume":         { "enabled": false, "volumeLevel": 0, "loudness": "balanced" },
  "generalGain":         0,
  "parametricEQ": {
    "enabled": true,
    "filter1":  { "enabled": true, "qFactor": 0.7071, "frequency": 35,    "gain": 0, "type": "peakingEQ" },
    "filter2":  { "enabled": true, "qFactor": 0.7071, "frequency": 120,   "gain": 0, "type": "peakingEQ" },
    "filter3":  { "enabled": true, "qFactor": 0.7071, "frequency": 1000,  "gain": 0, "type": "peakingEQ" },
    "filter4":  { "enabled": true, "qFactor": 0.7071, "frequency": 6000,  "gain": 0, "type": "peakingEQ" },
    "filter5":  { "enabled": true, "qFactor": 0.7071, "frequency": 18000, "gain": 0, "type": "peakingEQ" },
    "filter6":  { "enabled": false, "qFactor": 0.7071, "frequency": 1000,  "gain": 0, "type": "peakingEQ" },
    "filter7":  { "enabled": false, "qFactor": 0.7071, "frequency": 2000,  "gain": 0, "type": "peakingEQ" },
    "filter8":  { "enabled": false, "qFactor": 0.7071, "frequency": 4000,  "gain": 0, "type": "peakingEQ" },
    "filter9":  { "enabled": false, "qFactor": 0.7071, "frequency": 8000,  "gain": 0, "type": "peakingEQ" },
    "filter10": { "enabled": false, "qFactor": 0.7071, "frequency": 16000, "gain": 0, "type": "peakingEQ" }
  },
  "virtualSurroundState": false,
  "virtualSurroundChannels": {
    "frontLeft":  { "position":  30, "gain": 0 },
    "frontRight": { "position": -30, "gain": 0 },
    "center":     { "position":   0, "gain": 0 },
    "subWoofer":  { "position":   0, "gain": 0 },
    "rearLeft":   { "position": 150, "gain": 0 },
    "rearRight":  { "position":-150, "gain": 0 },
    "sideLeft":   { "position":  90, "gain": 0 },
    "sideRight":  { "position": -90, "gain": 0 }
  },
  "reverbGainDB": -6,
  "formFactor": "headphones",
  "globalEnableState": true
}
```

EQ filter `type` values observed: `"peakingEQ"`, `"highPass"`, `"lowShelving"`, `"highShelving"`.

### ChatCapture (mic) (`schemaVersion: 6`)

Completely different schema — no bass/treble/surround, adds noise processing:

```json
{
  "noiseReductionState":       { "enabled": true,  "value": 1 },
  "volumeStabilizerState":     { "enabled": false, "value": 0 },
  "noiseGateState":            { "enabled": true,  "value": -38.8 },
  "automaticNoiseGateState":   { "enabled": true,  "value": 0 },
  "impactNoiseReductionState": { "enabled": false, "value": 0 },
  "noiseCancelingState":       { "enabled": false, "value": 1 },
  "acousticEchoCancelingState": false,
  "parametricEQ": {
    "enabled": true,
    "filter1":  { "enabled": true, "qFactor": 0.7071, "frequency": 31,    "gain": 0, "type": "lowShelving" },
    "filter2":  { "enabled": true, "qFactor": 0.7071, "frequency": 62,    "gain": 0, "type": "peakingEQ"   },
    "filter3":  { "enabled": true, "qFactor": 0.7071, "frequency": 125,   "gain": 0, "type": "peakingEQ"   },
    "filter4":  { "enabled": true, "qFactor": 0.7071, "frequency": 250,   "gain": 0, "type": "peakingEQ"   },
    "filter5":  { "enabled": true, "qFactor": 0.7071, "frequency": 500,   "gain": 0, "type": "peakingEQ"   },
    "filter6":  { "enabled": true, "qFactor": 0.7071, "frequency": 1000,  "gain": 0, "type": "peakingEQ"   },
    "filter7":  { "enabled": true, "qFactor": 0.7071, "frequency": 2000,  "gain": 0, "type": "peakingEQ"   },
    "filter8":  { "enabled": true, "qFactor": 0.7071, "frequency": 4000,  "gain": 0, "type": "peakingEQ"   },
    "filter9":  { "enabled": true, "qFactor": 0.7071, "frequency": 8000,  "gain": 0, "type": "peakingEQ"   },
    "filter10": { "enabled": true, "qFactor": 0.7071, "frequency": 16000, "gain": 0, "type": "highShelving" }
  },
  "globalEnableState": true
}
```

---

## Data Carried By Other Key Endpoints

### `/v1/status`

```json
{
  "isEnabled": true,
  "isOnboardingDone": true,
  "mode": "classic",
  "areEndpointsConfigured": true,
  "devices": [
    {
      "id": "{virtual-device-guid}",
      "dataFlow": "render",
      "virtualAudioDevice": "media",
      "defaultRole": "console",
      "isChannelEnabled": true,
      "streamRedirectionDevice": "{physical-device-guid}",
      "streamRedirectionDeviceName": "arctis_nova_pro_wireless_tx",
      "config": { "id": "72f387fc-...", "name": "NATURAL" }
    }
  ]
}
```

Use for initial load — replaces separate calls to `/mode`, `/configs/selected`, `/classicRedirections`.

### `/deviceOut`

```json
{
  "selectedDeviceOut": "HeadphoneOut",
  "deviceOutSettings": [
    { "volume": 0.25, "mute": false, "feature": "HeadphoneOut" },
    { "volume": 0.25, "mute": false, "feature": "LineOut" }
  ]
}
```

Write (inferred): `PUT /deviceOut/{HeadphoneOut|LineOut}` — no body.

### `/mode`

```json
"classic"
```

Possible values: `"classic"`, `"stream"` (not `"streamer"`).

### `/volumeSettings/classic`

```json
{
  "masters": { "stream": {}, "classic": { "volume": 1.0, "muted": false } },
  "devices": {
    "game":        { "stream": {}, "classic": { "volume": 1.0,       "muted": false } },
    "chatRender":  { "stream": {}, "classic": { "volume": 0.56,      "muted": false } },
    "chatCapture": { "stream": {}, "classic": { "volume": 1.0,       "muted": false } },
    "media":       { "stream": {}, "classic": { "volume": 1.0,       "muted": false } },
    "aux":         { "stream": {}, "classic": { "volume": 0.06028607,"muted": false } }
  }
}
```

### `/volumeSettings/streamer`

```json
{
  "masters": {
    "stream": {
      "streaming":  { "volume": 1.0, "muted": false },
      "monitoring": { "volume": 1.0, "muted": false }
    }
  },
  "devices": {
    "game": {
      "stream": {
        "streaming":  { "volume": 1.0, "muted": false },
        "monitoring": { "volume": 1.0, "muted": false }
      }
    }
  }
}
```

### `/chatMix`

```json
{ "balance": 0.0, "state": "finiteWheel" }
```

### `/AudioDeviceRouting`

```json
[
  {
    "deviceId": "{virtual-channel-guid}",
    "role": "media",
    "dataFlow": "render",
    "audioSessions": [
      {
        "id": "{session-id-path}",
        "processName": "zen",
        "processId": 13832,
        "isSystemSound": false,
        "state": "active",
        "displayName": "Zen",
        "isRoutingErrorProne": false,
        "routingErrorDetected": false
      }
    ]
  }
]
```

`deviceId` here is Sonar's **virtual** channel GUID, used as `targetVirtualDeviceId` in the routing write.

### `/audioDevices`

```json
[
  {
    "id": "{windows-device-guid}",
    "friendlyName": "Speakers (SteelSeries Arctis Nova Pro Wireless)",
    "dataFlow": "render",
    "role": "none"
  }
]
```

Filter `role === "none"` for physical Windows devices available for redirection.

### `/classicRedirections`

```json
[
  { "id": "game",  "deviceId": "{windows-device-guid}" },
  { "id": "chat",  "deviceId": "{windows-device-guid}" },
  { "id": "media", "deviceId": "{windows-device-guid}" },
  { "id": "aux",   "deviceId": "{windows-device-guid}" },
  { "id": "mic",   "deviceId": "{windows-device-guid}" }
]
```

`id` uses the **ChannelDict** key (`chat` not `chatRender`, `mic` not `chatCapture`).

### `/streamRedirections`

```json
[
  { "streamRedirectionId": "streaming",  "deviceId": "{windows-device-guid}" },
  { "streamRedirectionId": "monitoring", "deviceId": "{windows-device-guid}" },
  { "streamRedirectionId": "mic",        "deviceId": "{windows-device-guid}" }
]
```

### `/audioSamples/samples`

```json
[
  { "role": "game", "id": "gaming",          "isPlaying": false },
  { "role": "game", "id": "virtualSurround", "isPlaying": false },
  { "role": "game", "id": "movie",           "isPlaying": false },
  { "role": "game", "id": "music",           "isPlaying": false }
]
```

Play via `PUT /audioSamples/{role}/{id}`. Playing a second sample stops the current one automatically.

### `/fallbackSettings/lists`

Per-channel array of all available Windows audio devices with fallback metadata:

```json
{
  "game": [
    {
      "id": "{windows-device-guid}",
      "label": "Headphones (Arctis Nova Pro Wireless)",
      "isActive": true,
      "isPrevious": false,
      "isNext": false,
      "isSteelseriesWirelessSupported": true,
      "isSteelseriesWirelessConnected": true,
      "isExcluded": false
    }
  ],
  "chatCapture": [ /* capture devices */ ]
}
```

More detailed than `/audioDevices` — use this when building a device-picker UI.

### `/quickset/profiles`

```json
[
  {
    "id": "4bc5a9d7-...",
    "name": "Counter-Strike 2",
    "isGame": true,
    "gameImagePath": "C:\\ProgramData\\SteelSeries\\GG\\shared\\externalAppIcons\\Counter-Strike2.png",
    "sonarConfigId": "e6979db3-..."
  }
]
```

GG's own game→preset map. `sonarConfigId` is null when no preset assigned.

---

## Write Endpoint Detail

### `PUT /configs` (upsert)

- Supply the **full config object** as JSON body.
- The `id` field determines create vs update.
- **Creating**: generate a UUID v4 client-side. Set `createdAt` = `updatedAt` = ISO 8601 UTC with trailing `Z`. Set `isPreset: false`, `isFavorite: false`, `favoritePosition: -1`.
- **Resetting**: copy `defaultData` values back into `data` and send.
- Built-in presets (`isPreset: true`) can be modified client-side but the GG app may restore them on restart — only modify user configs (`isPreset: false`).

### `PUT /classicRedirections/{channelDictKey}/deviceId/{deviceId}`

- `channelDictKey`: `game`, `chat`, `media`, `aux`, `mic`
- `deviceId`: Windows GUID from `/audioDevices[].id`. Braces are URL-encoded (`{` → `%7B`, `}` → `%7D`).
- No request body.

### `PUT /AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}`

- `dataFlow`: `render` for all render channels; `capture` for mic
- `targetVirtualDeviceId`: `deviceId` from the target entry in `GET /AudioDeviceRouting` (Sonar virtual GUID)
- `processId`: integer from `audioSessions[i].processId`
- No request body.

---

## Practical Minimal API

```http
# Initial load (prefer /v1/status over individual calls)
GET  /v1/status
GET  /configs
GET  /volumeSettings/classic/
GET  /volumeSettings/streamer/
GET  /chatMix
GET  /AudioDeviceRouting
GET  /audioDevices
GET  /classicRedirections
GET  /streamRedirections
GET  /streamRedirections/isStreamMonitoringEnabled
GET  /streamRedirections/isStreamMonitoringLocked
GET  /deviceOut

# Volume / mute
PUT  /mode/{classic|stream}
PUT  /volumeSettings/classic/{channelHttpKey}/Volume/{value}
PUT  /volumeSettings/classic/{channelHttpKey}/Mute/{true|false}
PUT  /volumeSettings/streamer/{mix}/{channelHttpKey}/volume/{value}
PUT  /volumeSettings/streamer/{mix}/{channelHttpKey}/isMuted/{true|false}
PUT  /chatMix?balance={value}

# Config CRUD
PUT  /configs                              # create or modify (JSON body)
DELETE /configs/{configId}                 # delete (204)
PUT  /configs/{configId}/select            # activate
PUT  /configs/{configId}/isFavorite/{bool} # toggle favorite

# Routing
PUT  /classicRedirections/{channelDictKey}/deviceId/{deviceId}
PUT  /streamRedirections/{channelDictKey|mix}/deviceId/{deviceId}
PUT  /AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}

# Monitoring
PUT  /streamRedirections/isStreamMonitoringEnabled/{true|false}

# Preview
GET  /audioSamples/samples
PUT  /audioSamples/{role}/{sampleId}
```
