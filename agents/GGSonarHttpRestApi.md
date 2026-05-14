# GG Sonar REST API

_Source of truth: [logs/sonar-api-scan-20260512-014948.json](/c:/Users/ffvd/Documents/arctis_centre/src/Apps/control-centre-full-app/logs/sonar-api-scan-20260512-014948.json)_

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

### Write

- Set classic channel volume for `master`, `game`, `chatRender`, `chatCapture`, `media`, `aux`.
- Set classic channel mute for `master`, `game`, `chatRender`, `chatCapture`, `media`, `aux`.
- Select a Sonar config by preset/config id.

## Endpoint Mapping

| Feature | Method | Endpoint | Data returned or accepted | Description |
|---|---|---|---|---|
| Discover Sonar host | `GET` | `https://127.0.0.1:6327/subApps` | Returns `subApps.sonar.metadata.webServerAddress` | GG discovery endpoint used to resolve the local Sonar HTTP server. |
| Read mode | `GET` | `/mode` or `/mode/` | Returns JSON string, observed: `"classic"` | Current Sonar operating mode. |
| Read classic volume state | `GET` | `/volumeSettings/classic` or `/VolumeSettings/classic` | Returns `{ masters, devices }` | Classic per-channel volume and mute state. |
| Read streamer volume state | `GET` | `/volumeSettings/streamer` or `/VolumeSettings/streamer` | Returns `{ masters, devices }` | Streamer mix state with `stream.streaming` and `stream.monitoring` branches. |
| Read chat mix | `GET` | `/chatMix` | Returns `{ balance, state }` | Chat mix wheel/balance state. Observed `state: "finiteWheel"`. |
| Read routing | `GET` | `/AudioDeviceRouting` or `/audioDeviceRouting` | Returns array of route entries | Device-role routing table with nested `audioSessions`. |
| Read preset catalog | `GET` | `/configs` or `/Configs` | Returns array of config objects | Full Sonar preset/config catalog. |
| Set classic channel volume | `PUT` | `/volumeSettings/classic/{channel}/Volume/{value}` or `/VolumeSettings/classic/{channel}/Volume/{value}` | Accepts `channel` and decimal `value` like `1` or `0.56`; returns updated `{ masters, devices }` payload | Sets classic volume for a channel. |
| Set classic channel mute | `PUT` | `/volumeSettings/classic/{channel}/Mute/{true|false}` or `/VolumeSettings/classic/{channel}/Mute/{true|false}` | Accepts `channel` and `true`/`false`; returns updated `{ masters, devices }` payload | Sets classic mute state for a channel. |
| Select preset/config | `PUT` | `/configs/{presetId}/select` or `/Configs/{presetId}/select` | Accepts preset/config id; returns the selected config object | Activates a Sonar config entry. |

## Data Carried By Working Endpoints

### 1. `/mode`

Observed response:

```json
"classic"
```

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
- `devices.{channel}.stream.streaming.muted`
- `devices.{channel}.stream.monitoring.volume`
- `devices.{channel}.stream.monitoring.muted`

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
        "id": "{session-id}",
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

Top-level route fields:

- `deviceId`
- `role`
- `dataFlow`
- `audioSessions`

Nested `audioSessions` fields observed:

- `id`
- `processName`
- `processId`
- `isSystemSound`
- `state`
- `displayName`
- `isRoutingErrorProne`
- `routingErrorDetected`

Observed route roles in the log include:

- `none`
- `media`
- `game`

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

Top-level config fields:

- `id`
- `name`
- `createdAt`
- `updatedAt`
- `virtualAudioDevice`
- `data`
- `schemaVersion`
- `isPreset`
- `defaultData`
- `image`
- `isFavorite`
- `favoritePosition`
- `releaseVersion`

Observed `virtualAudioDevice` values:

- `game`
- `chatRender`
- `chatCapture`
- `media`
- `aux`

Observed `data` / `defaultData` feature groups for output-style channels like `game`, `media`, `aux`:

- `bassBoostState`
- `trebleBoostState`
- `voiceClarityState`
- `smartVolume`
- `generalGain`
- `parametricEQ`
- `virtualSurroundState`
- `virtualSurroundChannels`
- `reverbGainDB`
- `formFactor`
- `globalEnableState`

Observed `data` / `defaultData` feature groups for voice-style channels like `chatRender`, `chatCapture`:

- `noiseReductionState`
- `volumeStabilizerState`
- `noiseGateState`
- `automaticNoiseGateState`
- `parametricEQ`
- `impactNoiseReductionState`
- `noiseCancelingState`
- `acousticEchoCancelingState`
- `globalEnableState`

### 7. `PUT /configs/{presetId}/select`

Observed successful response:

- returns the selected config object
- object shape matches an item from `/configs`

Returned fields:

- `id`
- `name`
- `createdAt`
- `updatedAt`
- `virtualAudioDevice`
- `data`
- `schemaVersion`
- `isPreset`
- `defaultData`
- `image`
- `isFavorite`
- `favoritePosition`
- `releaseVersion`

## Confirmed Channel Values For Classic Write Endpoints

Use these exact channel path values:

```text
master
game
chatRender
chatCapture
media
aux
```

## Practical Minimal API

```http
GET  /mode
GET  /volumeSettings/classic
GET  /volumeSettings/streamer
GET  /chatMix
GET  /AudioDeviceRouting
GET  /configs

PUT  /volumeSettings/classic/{channel}/Volume/{value}
PUT  /volumeSettings/classic/{channel}/Mute/{true|false}
PUT  /configs/{presetId}/select
```
