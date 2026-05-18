# Discord Voice Service

**Status**: ✅ Working  
**Implemented**: 2026-05-18  
**Branch**: development

---

## What It Does

A native Discord RPC service that connects to the Discord desktop client over its local named-pipe IPC socket. Provides:

- Self mic mute/unmute and deafen/undeafen
- Input and output volume control (0–100)
- Per-participant local volume (0–200) and local mute
- Live speaking indicators
- Auto-reconnect on disconnect (10 s)
- Token persistence — OAuth popup appears once, then the access token is cached to `userData/discord-token.json`

---

## Key Files

| File | Purpose |
|---|---|
| `src/main/services/discordService.ts` | Transport + auth + service class |
| `src/renderer/src/stores/discordStore.ts` | Zustand state for the renderer |
| `src/renderer/src/pages/settings/DiscordSettings.tsx` | Settings UI (Client ID, Client Secret, controls) |
| `src/shared/types.ts` | `DiscordState`, `DiscordParticipant`, IPC channels, `AppSettings.discordClientId/Secret` |
| `src/main/index.ts` | Service instantiation, IPC handlers, settings wiring |
| `src/preload/index.ts` | `window.api` bridge methods |
| `src/renderer/src/types/electron.d.ts` | TypeScript declarations for `window.api` |
| `src/renderer/src/App.tsx` | IPC subscription `useEffect` |

---

## Wire Protocol

Discord exposes a named-pipe RPC server on Windows:

```
Pipe path:  \\.\pipe\discord-ipc-{0..9}   (try sequentially; first that connects wins)

Frame format:
  [opcode: uint32 LE][length: uint32 LE][JSON body: utf-8]

Opcodes:
  0 = HANDSHAKE   1 = FRAME   2 = CLOSE   3 = PING   4 = PONG
```

The service uses a hand-rolled `DiscordRpcTransport` (no npm package). No external dependency.

### Handshake

Send opcode 0:
```json
{ "v": 1, "client_id": "<id>" }
```

Discord responds with a DISPATCH READY frame (opcode 1):
```json
{ "cmd": "DISPATCH", "evt": "READY", "data": { ... } }
```

**Critical**: READY arrives as a `DISPATCH` frame, not a standalone `evt: "READY"` frame. The transport checks `frame.cmd === 'DISPATCH' && frame.evt === 'READY'` and emits the internal `ready` event from there.

### Command / Response

Command (opcode 1):
```json
{ "cmd": "COMMAND_NAME", "args": { ... }, "nonce": "<uuid>" }
```

Response (opcode 1):
```json
{ "cmd": "COMMAND_NAME", "data": { ... }, "nonce": "<uuid>", "evt": null }
```

Errors return `evt: "ERROR"` with `data.code` and `data.message`.

### Subscribe / Unsubscribe

`evt` must be a **top-level field** on the frame, not inside `args`:

```json
{ "cmd": "SUBSCRIBE", "evt": "VOICE_CHANNEL_SELECT", "args": {}, "nonce": "<uuid>" }
```

Sending `evt` inside `args` produces Discord error code 4004 ("Invalid event: undefined").

---

## Authentication Flow

```
1. transport.connect(clientId)
   → try \\.\pipe\discord-ipc-0 … 9 in order
   → send HANDSHAKE, wait for DISPATCH READY

2. loadCachedToken()
   → found + not expired: skip to step 5
   → not found / expired: continue

3. AUTHORIZE { client_id, scopes: ["rpc","rpc.voice.read","rpc.voice.write"] }
   → Discord shows a consent popup in the client
   → response: { code }

4. POST https://discord.com/api/oauth2/token
   → Content-Type: application/x-www-form-urlencoded  ← required, not automatic
   → body: grant_type=authorization_code, code, redirect_uri=http://127.0.0.1,
           client_id, client_secret
   → response: { access_token, expires_in }
   → saveCachedToken() → userData/discord-token.json

5. AUTHENTICATE { access_token }
   → authenticated

6. GET_VOICE_SETTINGS → seed selfMuted, selfDeafened, inputVolume, outputVolume
7. SUBSCRIBE VOICE_CHANNEL_SELECT
8. SUBSCRIBE VOICE_SETTINGS_UPDATE
9. GET_SELECTED_VOICE_CHANNEL → null if not in a channel; null-guarded with ?.id
   → if in channel: handleChannelJoin(channelId)
```

---

## IPC Channels

Defined in `src/shared/types.ts` under `IPC_CHANNELS`:

| Constant | Channel string | Direction | Purpose |
|---|---|---|---|
| `DISCORD_GET_STATE` | `discord:getState` | invoke | Get current `DiscordState` |
| `DISCORD_STATE_CHANGE` | `discord:stateChange` | push | State update from service |
| `DISCORD_SET_SELF_MUTE` | `discord:setSelfMute` | invoke | Mute/unmute self |
| `DISCORD_SET_SELF_DEAF` | `discord:setSelfDeaf` | invoke | Deafen/undeafen self |
| `DISCORD_SET_INPUT_VOLUME` | `discord:setInputVolume` | invoke | Mic input volume (0–100) |
| `DISCORD_SET_OUTPUT_VOLUME` | `discord:setOutputVolume` | invoke | Output volume (0–100) |
| `DISCORD_SET_LOCAL_VOLUME` | `discord:setLocalVolume` | invoke | Participant volume (0–200) |
| `DISCORD_SET_LOCAL_MUTE` | `discord:setLocalMute` | invoke | Locally mute participant |
| `DISCORD_RECONNECT` | `discord:reconnect` | invoke | Force reconnect + clear token |

---

## Write Commands

| Action | RPC command | Args |
|---|---|---|
| Self mute/unmute | `SET_VOICE_SETTINGS` | `{ mute: boolean }` |
| Self deafen/undeafen | `SET_VOICE_SETTINGS` | `{ deaf: boolean }` |
| Input volume | `SET_VOICE_SETTINGS` | `{ input: { volume: 0-100 } }` |
| Output volume | `SET_VOICE_SETTINGS` | `{ output: { volume: 0-100 } }` |
| Participant volume | `SET_USER_VOICE_SETTINGS` | `{ user_id, volume: 0-200 }` |
| Participant local mute | `SET_USER_VOICE_SETTINGS` | `{ user_id, mute: boolean }` |

---

## Subscribed Events

| Event | Scope | Action |
|---|---|---|
| `VOICE_CHANNEL_SELECT` | global | Join/leave channel |
| `VOICE_SETTINGS_UPDATE` | global | Update self mute/deaf/volumes |
| `VOICE_STATE_CREATE` | per channel_id | Add participant |
| `VOICE_STATE_UPDATE` | per channel_id | Update participant |
| `VOICE_STATE_DELETE` | per channel_id | Remove participant |
| `SPEAKING_START` | per channel_id | Set `speaking: true` |
| `SPEAKING_STOP` | per channel_id | Set `speaking: false` |

Channel-specific events are subscribed in `handleChannelJoin` and unsubscribed in `handleChannelLeave`.

---

## Settings

Two fields in `AppSettings` (`src/shared/types.ts`):

```typescript
discordClientId: string      // default: ''
discordClientSecret: string  // default: ''
```

Both are stored in `userData/settings.json` via the standard `SETTINGS_GET`/`SETTINGS_SET` flow. Neither is ever sent to a third party except `client_secret` to `discord.com/api/oauth2/token` during the one-time token exchange.

**`redirect_uri` registration**: `http://127.0.0.1` (no trailing slash, no port) must be added under OAuth2 → Redirects in the Discord Developer Portal.

---

## User Setup

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → New Application
2. General Information → copy **Application ID** (this is the Client ID)
3. OAuth2 tab → copy **Client Secret**
4. OAuth2 → Redirects → Add `http://127.0.0.1`
5. In Control Centre Pro: Settings → Discord → paste both values → Save
6. A browser popup will ask you to authorise the app — grant the requested scopes
7. The token is saved locally; subsequent starts authenticate silently

---

## Bugs Fixed During Implementation

| Bug | Root cause | Fix |
|---|---|---|
| Handshake hung after pipe open | READY is sent as `cmd: "DISPATCH"` + `evt: "READY"` — `DISPATCH` branch returned before the `evt === "READY"` check ran | Check `frame.evt === "READY"` inside the DISPATCH branch; emit `ready` there |
| OAuth token exchange returned HTTP 400 | `net.request` doesn't set `Content-Type` automatically; Discord rejected the untyped form body | Add `req.setHeader('Content-Type', 'application/x-www-form-urlencoded')` before `req.write()` |
| `authenticate()` crashed with "Cannot read properties of null (reading 'id')" | `GET_SELECTED_VOICE_CHANNEL` returns `null` when not in a channel | Type the response as `{ id?: string } \| null` and access via `selectedChannel?.id` |
| Subscriptions failed with "Invalid event: undefined" (code 4004) | `subscribe()` routed through `request()`, which placed `evt` inside `args` instead of at frame top level | `subscribe`/`unsubscribe` now build their own frames with `evt` at top level |
