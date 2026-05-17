# GG Sonar REST API

_Source of truth: [logs/sonar-api-scan-20260512-014948.json](/c:/Users/ffvd/Documents/arctis_centre/src/Apps/control-centre-full-app/logs/sonar-api-scan-20260512-014948.json)_
_Endpoint shapes confirmed from: [SteelSeries-NET-API (DataNext27)](https://github.com/DataNext27/SteelSeries-NET-API)_

## Discovery

Resolve Sonar from GG:

```http
GET https://127.0.0.1:6327/subApps
```

Read:

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

Use:

```text
http://127.0.0.1:58748
```

## Available Features

### Read

- Get Sonar mode.
- Read classic channel volumes and mute state for `master`, `game`, `chatRender`, `chatCapture`, `media`, `aux`.
- Read streamer volume state for `streaming` and `monitoring` mixes per channel.
- Read chat mix state.
- Read audio-device routing and routed audio sessions.
- Read the full preset/config catalog.
- Read currently selected config per channel.
- Read available Windows audio devices.
- Read classic and streamer channel redirections.

### Write

- Set classic channel volume for `master`, `game`, `chatRender`, `chatCapture`, `media`, `aux`.
- Set classic channel mute for `master`, `game`, `chatRender`, `chatCapture`, `media`, `aux`.
- Set streamer channel volume and mute.
- Set mode (`classic` / `stream`).
- Select a Sonar config by preset/config id.
- Assign a Windows audio device to a classic channel.
- Assign a Windows audio device to a streamer channel/mix.
- Route an audio process to a Sonar channel.
- Set chat mix balance.
- Toggle stream monitoring (audience monitoring).

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
| Discover Sonar host | `GET` | `https://127.0.0.1:6327/subApps` | GG discovery; returns `subApps.sonar.metadata.webServerAddress` |
| Read mode | `GET` | `/mode` | Returns JSON string: `"classic"` or `"stream"` |
| Read classic volumes | `GET` | `/volumeSettings/classic/` | Returns `{ masters, devices }` |
| Read streamer volumes | `GET` | `/volumeSettings/streamer/` | Returns `{ masters, devices }` with streaming/monitoring branches |
| Read chat mix | `GET` | `/chatMix` | Returns `{ balance, state }` |
| Read routing | `GET` | `/AudioDeviceRouting` | Returns array of route entries with nested `audioSessions` |
| Read all configs | `GET` | `/configs` | Returns array of config objects |
| Read selected configs | `GET` | `/configs/selected` | Returns array of currently selected config per channel |
| Read audio devices | `GET` | `/audioDevices` | Returns array; filter `role === "none"` for physical Windows devices |
| Read classic redirections | `GET` | `/classicRedirections` | Returns **array** of `{ id, deviceId }` per channel |
| Read streamer redirections | `GET` | `/streamRedirections` | Returns **array** of `{ streamRedirectionId, deviceId }` |
| Read stream monitoring state | `GET` | `/streamRedirections/isStreamMonitoringEnabled` | Returns boolean |
| **Set mode** | `PUT` | `/mode/{modeKey}` | `modeKey`: `classic` or `stream`. No body. |
| **Set classic volume** | `PUT` | `/volumeSettings/classic/{channelHttpKey}/Volume/{value}` | `channelHttpKey` uses HTTP column above. No body. |
| **Set classic mute** | `PUT` | `/volumeSettings/classic/{channelHttpKey}/Mute/{true\|false}` | No body. |
| **Set streamer volume** | `PUT` | `/volumeSettings/streamer/{mix}/{channelHttpKey}/volume/{value}` | `mix`: `monitoring` or `streaming`. No body. |
| **Set streamer mute** | `PUT` | `/volumeSettings/streamer/{mix}/{channelHttpKey}/isMuted/{true\|false}` | No body. |
| **Select config** | `PUT` | `/configs/{configId}/select` | No body. Returns selected config object. |
| **Set classic redirection** | `PUT` | `/classicRedirections/{channelDictKey}/deviceId/{deviceId}` | `channelDictKey` uses ChannelDict column above. No body. `deviceId` = Windows device GUID (braces URL-encoded). |
| **Set streamer redirection (mic)** | `PUT` | `/streamRedirections/{channelDictKey}/deviceId/{deviceId}` | `channelDictKey` = `mic`. No body. |
| **Set streamer redirection (mix)** | `PUT` | `/streamRedirections/{mix}/deviceId/{deviceId}` | `mix`: `monitoring` or `streaming`. No body. |
| **Route process to channel** | `PUT` | `/AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}` | `dataFlow`: `render` (all channels) or `capture` (mic only). `targetVirtualDeviceId` = `deviceId` from the target route entry in `GET /AudioDeviceRouting`. `processId` = integer from session. No body. |
| **Set chat mix balance** | `PUT` | `/chatMix?balance={value}` | Query param. No body. Value range: -1.0 to 1.0. |
| **Toggle stream monitoring** | `PUT` | `/streamRedirections/isStreamMonitoringEnabled/{true\|false}` | No body. |

> **All PUT endpoints use path parameters only — no JSON body.**

## Config/Preset Limitations

⚠️ **Preset creation, editing, and deletion are NOT supported via the Sonar HTTP API.** The API only allows:
- Reading the full config catalog (`GET /configs`)
- Reading currently selected configs per channel (`GET /configs/selected`)
- **Selecting** an existing config (`PUT /configs/{configId}/select`)

To create or modify presets, users must do so through the **SteelSeries GG application directly**. The HTTP API is read-only for preset content; only the active preset selection can be changed programmatically.

Confirmed by: [SteelSeries-NET-API repository](https://github.com/DataNext27/SteelSeries-NET-API) (see ConfigurationManager.cs — only GET and PUT /select are implemented; no POST/DELETE or PUT for editing config data)

## Data Carried By Working Endpoints

### 1. `/mode`

Observed response:

```json
"classic"
```

Possible values: `"classic"`, `"stream"` (not `"streamer"`).

### 2. `/volumeSettings/classic`

Observed response shape:

```json
{
  "masters": {
    "stream": {},
    "classic": {
      "volume": 1.0,
      "muted": false
    }
  },
  "devices": {
    "game": {
      "stream": {},
      "classic": {
        "volume": 1.0,
        "muted": false
      }
    },
    "chatRender": {
      "stream": {},
      "classic": {
        "volume": 0.56,
        "muted": false
      }
    },
    "chatCapture": {
      "stream": {},
      "classic": {
        "volume": 1.0,
        "muted": false
      }
    },
    "media": {
      "stream": {},
      "classic": {
        "volume": 1.0,
        "muted": false
      }
    },
    "aux": {
      "stream": {},
      "classic": {
        "volume": 0.06028607,
        "muted": false
      }
    }
  }
}
```

Useful fields:

- `masters.classic.volume`
- `masters.classic.muted`
- `devices.{channel}.classic.volume`
- `devices.{channel}.classic.muted`

### 3. `/volumeSettings/streamer`

Observed response shape:

```json
{
  "masters": {
    "stream": {
      "streaming": {
        "volume": 1.0,
        "muted": false
      },
      "monitoring": {
        "volume": 1.0,
        "muted": false
      }
    },
    "classic": {
      "volume": 0.0,
      "muted": false
    }
  },
  "devices": {
    "game": {
      "stream": {
        "streaming": {
          "volume": 1.0,
          "muted": false
        },
        "monitoring": {
          "volume": 1.0,
          "muted": false
        }
      },
      "classic": {
        "volume": 0.0,
        "muted": false
      }
    }
  }
}
```

Useful fields:

- `masters.stream.streaming.volume`
- `masters.stream.streaming.muted`
- `masters.stream.monitoring.volume`
- `masters.stream.monitoring.muted`
- `devices.{channel}.stream.streaming.volume`
- `devices.{channel}.stream.monitoring.volume`

Observed channels in the full payload:

- `game`
- `chatRender`
- `chatCapture`
- `media`
- `aux`

### 4. `/chatMix`

Observed response:

```json
{
  "balance": 0.0,
  "state": "finiteWheel"
}
```

Useful fields:

- `balance`
- `state`

### 5. `/AudioDeviceRouting`

Observed response shape:

```json
[
  {
    "deviceId": "{device-guid}",
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

Notes:
- `deviceId` on the route entry is the Sonar **virtual** channel device GUID (used in process routing writes).
- `audioSessions[i].processId` (integer) is used for the `PUT /AudioDeviceRouting` write.
- `audioSessions[i].id` has the format `something|processPath` — not used for writes.
- Observed route `role` values: `none`, `media`, `game`. `none` = unassigned.

### 6. `/configs`

Observed response shape:

```json
[
  {
    "id": "e6979db3-3e00-4399-b58c-6f026c9ef6ba",
    "name": "Custom",
    "createdAt": "2025-12-14T13:29:35",
    "updatedAt": "2026-02-22T14:39:56.4346307",
    "virtualAudioDevice": "game",
    "data": {
      "bassBoostState": { "enabled": true, "value": 0 },
      "trebleBoostState": { "enabled": true, "value": 0 },
      "voiceClarityState": { "enabled": true, "value": 0 },
      "smartVolume": { "enabled": false, "volumeLevel": 0, "loudness": "balanced" },
      "generalGain": 0,
      "parametricEQ": { "enabled": true },
      "virtualSurroundState": false,
      "virtualSurroundChannels": {},
      "reverbGainDB": -6,
      "formFactor": "headphones",
      "globalEnableState": true
    },
    "schemaVersion": 5,
    "isPreset": false,
    "defaultData": {},
    "image": "8.svg",
    "isFavorite": true,
    "favoritePosition": 4,
    "releaseVersion": null
  }
]
```

### 7. `/configs/selected`

Returns the same array shape as `/configs`, but only includes the currently selected config per `virtualAudioDevice`. Use this to determine which config is active for each channel.

### 8. `PUT /configs/{configId}/select`

Returns the selected config object (same shape as a `/configs` item).

### 9. `/audioDevices`

Returns an array of Windows audio devices. Shape confirmed from C# source:

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

Fields:
- `id` — Windows device GUID (with braces)
- `friendlyName` — display name
- `dataFlow` — `"render"` (output) or `"capture"` (input)
- `role` — `"none"` for physical Windows devices; other values for Sonar's own virtual channel devices

**Filter**: use `role === "none"` to get physical Windows audio devices available for redirection.

### 10. `/classicRedirections`

Returns an **array** (not an object). Shape confirmed from C# source:

```json
[
  { "id": "game",  "deviceId": "{windows-device-guid}" },
  { "id": "chat",  "deviceId": "{windows-device-guid}" },
  { "id": "media", "deviceId": "{windows-device-guid}" },
  { "id": "aux",   "deviceId": "{windows-device-guid}" },
  { "id": "mic",   "deviceId": "{windows-device-guid}" }
]
```

- `id` uses the **ChannelDict** key (`chat` not `chatRender`, `mic` not `chatCapture`).
- `deviceId` is the Windows physical device GUID.

### 11. `/streamRedirections`

Returns an **array**. Shape confirmed from C# source:

```json
[
  { "streamRedirectionId": "streaming",  "deviceId": "{windows-device-guid}" },
  { "streamRedirectionId": "monitoring", "deviceId": "{windows-device-guid}" },
  { "streamRedirectionId": "mic",        "deviceId": "{windows-device-guid}" }
]
```

## Write Endpoint Detail

### `PUT /classicRedirections/{channelDictKey}/deviceId/{deviceId}`

Assigns a Windows audio device to a classic-mode channel.

- `channelDictKey`: use the **ChannelDict** column (`game`, `chat`, `media`, `aux`, `mic`)
- `deviceId`: the Windows device GUID from `/audioDevices[].id`
- Device GUIDs (containing `{` and `}`) are URL-encoded automatically by the HTTP client (`{` → `%7B`, `}` → `%7D`)
- **No request body.**

### `PUT /AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}`

Routes a running audio process to a different Sonar virtual channel.

- `dataFlow`: `render` for all channels except mic; `capture` for mic (`chatCapture`)
- `targetVirtualDeviceId`: the `deviceId` from the target route entry in `GET /AudioDeviceRouting` — this is the Sonar **virtual** device GUID, not a Windows physical device GUID
- `processId`: the integer `processId` from `audioSessions[i].processId` in `GET /AudioDeviceRouting`
- **No request body.**

## Practical Minimal API

```http
GET  /mode
GET  /volumeSettings/classic/
GET  /volumeSettings/streamer/
GET  /chatMix
GET  /AudioDeviceRouting
GET  /configs
GET  /configs/selected
GET  /audioDevices
GET  /classicRedirections
GET  /streamRedirections

PUT  /mode/{classic|stream}
PUT  /volumeSettings/classic/{channelHttpKey}/Volume/{value}
PUT  /volumeSettings/classic/{channelHttpKey}/Mute/{true|false}
PUT  /volumeSettings/streamer/{mix}/{channelHttpKey}/volume/{value}
PUT  /volumeSettings/streamer/{mix}/{channelHttpKey}/isMuted/{true|false}
PUT  /configs/{configId}/select
PUT  /classicRedirections/{channelDictKey}/deviceId/{deviceId}
PUT  /streamRedirections/{channelDictKey|mix}/deviceId/{deviceId}
PUT  /AudioDeviceRouting/{dataFlow}/{targetVirtualDeviceId}/{processId}
PUT  /chatMix?balance={value}
PUT  /streamRedirections/isStreamMonitoringEnabled/{true|false}
```
