# Discord RPC — Direct Implementation Plan

Replace the abandoned `discord-rpc` npm package with a hand-rolled IPC transport that speaks the
official Discord RPC wire protocol directly. This fixes two correctness bugs (`VOICE_STATE_DELETE`
never handled; undocumented `SET_LOCAL_VOLUME` / `SET_LOCAL_MUTE` commands used) and removes a
stale dependency that requires a TypeScript module-declaration hack to call its own public methods.

---

## Why Replace the Package

| Issue | Impact |
|---|---|
| `discord-rpc` last updated ~2021, effectively abandoned | Connection reliability degrades over Discord updates |
| `request()` not in TS types → module declaration hack (lines 8–12 of discordService.ts) | Build noise; signals the package is broken by design |
| `SET_LOCAL_VOLUME` / `SET_LOCAL_MUTE` are undocumented internal commands | Could silently break on any Discord release |
| `VOICE_STATE_DELETE` never subscribed → participants never removed on leave | Participants accumulate in the list forever |
| OAuth token held in memory only → browser popup on every app start | Poor UX |
| No `client_secret` needed by package (uses undocumented `rpc_token` bypass) | Works today; no guarantee tomorrow |

---

## OAuth / client_secret Strategy

The Discord OAuth2 authorization code flow requires a `client_secret` to exchange the
authorization code for an access token (`POST /oauth2/token`). The package worked around this
using the undocumented `/oauth2/token/rpc` endpoint that skips the secret, but that endpoint
is not in the official documentation and its continued existence is not guaranteed.

**Chosen approach: user-provided client secret stored in AppSettings.**

The user already visits the Discord Developer Portal to get their `client_id`. The
`client_secret` lives on the same page (OAuth2 tab → Client Secret). Adding a second copy-paste
to the settings UI is trivial and matches how other personal desktop tools (e.g. Streamlabs,
Medal) handle this.

- Both values live in `AppSettings` → persisted to `userData/settings.json` (not in the repo).
- The secret is never sent to any third party — only to `discord.com/api/oauth2/token` during
  the one-time auth exchange.
- After exchange, the access token is persisted to `userData/discord-token.json` so the OAuth
  browser popup only appears once, not on every app start. If the token is still valid on startup,
  the AUTHORIZE step is skipped; AUTHENTICATE is called directly with the cached token.

---

## Wire Protocol Reference (summary)

```
Pipe path (Windows):  \\.\pipe\discord-ipc-{0..9}   (try sequentially)

Frame format:
  [opcode: uint32 LE][length: uint32 LE][JSON body: utf-8]

Opcodes:
  0 = HANDSHAKE   1 = FRAME   2 = CLOSE   3 = PING   4 = PONG

Handshake body:   { v: 1, client_id: "<id>" }
Command frame:    { cmd: "COMMAND_NAME", args: {...}, nonce: "<uuid>" }
Response frame:   { cmd: "COMMAND_NAME", data: {...}, nonce: "<uuid>", evt: null }
Event frame:      { cmd: "DISPATCH", data: {...}, evt: "EVENT_NAME", nonce: null }
Error frame:      { cmd: "...", data: { code, message }, evt: "ERROR", nonce: "<uuid>" }
```

---

## Files Changed

| File | Action |
|---|---|
| `src/main/services/discordService.ts` | **Full rewrite** — replace package with direct transport |
| `src/shared/types.ts` | Add `discordClientSecret: string` to `AppSettings` + `DEFAULT_SETTINGS` |
| `src/renderer/src/pages/settings/DiscordSettings.tsx` | Add Client Secret field; update setup instructions; update token-persistence copy |
| `package.json` | Remove `discord-rpc` and `@types/discord-rpc` from dependencies |

**No changes needed in:**
- `src/main/index.ts` — IPC handlers call the same `DiscordService` public API
- `src/preload/index.ts` — bridge methods unchanged
- `src/renderer/src/stores/discordStore.ts` — store shape unchanged
- `src/renderer/src/App.tsx` — integration unchanged
- `src/shared/types.ts` IPC channels — all channel names unchanged
- `src/shared/types.ts` `DiscordState` / `DiscordParticipant` — unchanged
- `src/renderer/src/types/electron.d.ts` — unchanged

---

## Step-by-Step Implementation

---

### Step 1 — Remove the package dependency

**`package.json`**

Remove from `dependencies`:
```json
"discord-rpc": "^4.0.1"
```

Remove from `devDependencies`:
```json
"@types/discord-rpc": "^4.0.8"
```

Remove from `build.asarUnpack`:
```json
"**/node_modules/discord-rpc/**"
```

Then run:
```powershell
npm install
```

---

### Step 2 — Extend AppSettings with client secret

**`src/shared/types.ts`**

In `AppSettings` interface, add after `discordClientId`:
```typescript
discordClientSecret: string
```

In `DEFAULT_SETTINGS`, add after `discordClientId: ''`:
```typescript
discordClientSecret: '',
```

No IPC channel changes — settings flow through the existing `SETTINGS_GET` / `SETTINGS_SET`
channels unchanged.

---

### Step 3 — Rewrite discordService.ts

Delete the entire file and replace with the implementation described below. The public API
surface (`start`, `stop`, `isAvailable`, `getState`, `setSelfMute`, `setSelfDeaf`,
`setInputVolume`, `setOutputVolume`, `setLocalVolume`, `setLocalMute`, `reconnect`,
`setClientId`, `setWindow`, `setLogEmitter`, `setStateChangeNotifier`) is **identical** to the
current service — `main/index.ts` needs no changes.

#### 3a — DiscordRpcTransport (inner class, ~120 lines)

Owns the raw named-pipe connection. Exposes:
- `connect(clientId): Promise<void>` — opens the pipe and sends the HANDSHAKE frame
- `send(opcode, payload): void` — encodes and writes one frame
- `request(cmd, args): Promise<unknown>` — posts a FRAME command with a random nonce,
  returns a Promise resolved/rejected when the matching response arrives
- `subscribe(evt, args): Promise<void>` — sends `SUBSCRIBE` command
- `unsubscribe(evt, args): Promise<void>` — sends `UNSUBSCRIBE` command
- `destroy(): void` — destroys the socket
- `on(evt, handler)` / `off(evt, handler)` — event subscription for dispatched events

**Implementation notes:**
```typescript
import { createConnection, Socket } from 'net'
import { randomUUID } from 'crypto'

// Try pipes 0–9, resolve with the first that connects
async function openPipe(clientId: string): Promise<Socket> { ... }

// Frame encoding
function encode(opcode: number, payload: object): Buffer {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  const header = Buffer.allocUnsafe(8)
  header.writeUInt32LE(opcode, 0)
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

// Frame decoding — accumulate partial reads in a buffer
// Each read: extract all complete [header(8) + body(length)] frames
// Emit 'frame' events for each complete frame
```

Request/response matching:
```typescript
private pending = new Map<string, { resolve(v: unknown): void; reject(e: Error): void }>()

request(cmd, args): Promise<unknown> {
  const nonce = randomUUID()
  return new Promise((resolve, reject) => {
    this.pending.set(nonce, { resolve, reject })
    this.send(1, { cmd, args, nonce })
  })
}

// In frame handler:
if (frame.nonce && this.pending.has(frame.nonce)) {
  const cb = this.pending.get(frame.nonce)!
  this.pending.delete(frame.nonce)
  if (frame.evt === 'ERROR') cb.reject(new Error(frame.data?.message ?? 'RPC error'))
  else cb.resolve(frame.data)
}
```

#### 3b — Token persistence helpers (~40 lines)

```typescript
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'

interface TokenCache { access_token: string; expires_at: number }

function tokenCachePath(): string {
  return join(app.getPath('userData'), 'discord-token.json')
}

function loadCachedToken(): string | null {
  try {
    const raw = JSON.parse(readFileSync(tokenCachePath(), 'utf8')) as TokenCache
    if (Date.now() < raw.expires_at - 60_000) return raw.access_token
    return null
  } catch { return null }
}

function saveCachedToken(token: string, expiresInSeconds: number): void {
  const cache: TokenCache = { access_token: token, expires_at: Date.now() + expiresInSeconds * 1000 }
  writeFileSync(tokenCachePath(), JSON.stringify(cache), 'utf8')
}

function clearCachedToken(): void {
  try { unlinkSync(tokenCachePath()) } catch { /* ignore */ }
}
```

#### 3c — OAuth helpers (~50 lines)

```typescript
import { net } from 'electron'   // Electron's net module, respects proxy settings

// Exchange authorization code for an access token
async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://127.0.0.1',    // must match the redirect registered in the Dev Portal
    client_id: clientId,
    client_secret: clientSecret,
  })
  // POST to https://discord.com/api/oauth2/token
  // Parse JSON response; throw on non-2xx or missing access_token
}
```

`redirect_uri: 'http://127.0.0.1'` — same value currently used by the package. This must be
added as an allowed redirect in the Discord Developer Portal (already in the setup instructions).

#### 3d — DiscordService class (~180 lines)

Replaces the current class. Same constructor signature, same public methods.

**`connect()` flow:**

```
1. Validate clientId + clientSecret both non-empty — emit error state if missing
2. Create new DiscordRpcTransport
3. transport.connect(clientId) — handshake, get READY event
4. State → available:true, authenticated:false
5. Check loadCachedToken()
   a. Token found → skip to step 8
   b. No token → send AUTHORIZE command with scopes
      { cmd: "AUTHORIZE", args: { client_id, scopes: ["rpc","rpc.voice.read","rpc.voice.write"] } }
      → response gives { code }
6. exchangeCode(code, clientId, clientSecret)
7. saveCachedToken(access_token, expires_in)
8. Send AUTHENTICATE: { cmd: "AUTHENTICATE", args: { access_token } }
   → response gives { user, scopes, expires }
9. State → authenticated:true, error:null
10. Fetch initial voice settings (GET_VOICE_SETTINGS)
11. Subscribe VOICE_CHANNEL_SELECT
12. Subscribe VOICE_SETTINGS_UPDATE
13. Check GET_SELECTED_VOICE_CHANNEL → if in channel, call handleChannelJoin()
```

**On `VOICE_CHANNEL_SELECT` event:**
```
data.channel_id non-null → handleChannelJoin(channelId)
data.channel_id null     → handleChannelLeave()
```

**`handleChannelJoin(channelId)`:**
```
1. GET_CHANNEL { channel_id } → get channel name, guild_id, voice_states[]
2. GET_GUILD { guild_id } → get guild name (catch: DMs have no guild)
3. Map voice_states to DiscordParticipant[] (same logic as current code)
4. State → voiceChannel + participants
5. SUBSCRIBE VOICE_STATE_CREATE { channel_id }   ← NEW
6. SUBSCRIBE VOICE_STATE_UPDATE { channel_id }
7. SUBSCRIBE VOICE_STATE_DELETE { channel_id }   ← NEW (fixes participant leave bug)
8. SUBSCRIBE SPEAKING_START { channel_id }
9. SUBSCRIBE SPEAKING_STOP { channel_id }
```

**`handleChannelLeave()`:**
```
UNSUBSCRIBE channel-specific events
State → voiceChannel: null, participants: []
```

**Event handlers:**

| Event | Handler |
|---|---|
| `VOICE_STATE_CREATE` | Add participant to `participants[]` if not already present |
| `VOICE_STATE_UPDATE` | Update existing participant; if not found, add (same as CREATE) |
| `VOICE_STATE_DELETE` | Remove participant by `user.id` from `participants[]` — **bug fix** |
| `SPEAKING_START` | Set `speaking: true` for `user_id` |
| `SPEAKING_STOP` | Set `speaking: false` for `user_id` |
| `VOICE_SETTINGS_UPDATE` | Update `selfMuted`, `selfDeafened`, `inputVolume`, `outputVolume` |

**Write command changes** — replace undocumented commands with documented ones:

| Current (undocumented) | Replacement (official docs) |
|---|---|
| `SET_LOCAL_VOLUME { user_id, volume }` | `SET_USER_VOICE_SETTINGS { user_id, volume }` |
| `SET_LOCAL_MUTE { user_id, mute }` | `SET_USER_VOICE_SETTINGS { user_id, mute }` |

All other write commands (`SET_VOICE_SETTINGS` for self mute/deaf/volumes) are already using the
correct documented command name and args.

**On transport disconnect / error:**
```
State → available:false, authenticated:false, voiceChannel:null, participants:[]
transport.destroy()
scheduleReconnect(10_000) — only if !stopped
```

**On auth failure (AUTHENTICATE rejected):**
```
clearCachedToken()   ← so next connect re-runs AUTHORIZE
State → available:true, authenticated:false, error: message
```
This handles the case where the cached token is rejected (revoked by user in Discord settings).

**`reconnect()` (public):**
```
clearCachedToken()
destroyTransport()
connect()
```
User-triggered reconnect always clears the cache to force a fresh OAuth flow.

**`setClientId(id)` / `setClientSecret(secret)` (new):**
Store locally in `this.clientId` / `this.clientSecret`. Called from `main/index.ts` on settings
load, same pattern as current `setClientId`.

**Debug probe:** Remove the `probeDiscordPipes()` method and all `[DEBUG]` log lines — these
were diagnostic scaffolding for the package's unreliable connection and are no longer needed.
The direct transport will log connection attempts at `info` level instead.

---

### Step 4 — Wire client secret in main/index.ts

In `main/index.ts`, wherever `discordService.setClientId(...)` is called, add:

```typescript
discordService.setClientSecret(settings.discordClientSecret ?? '')
```

There are two call sites:
1. Around line 392 — when reading settings on startup
2. Around line 857 — when applying saved settings after window creation

Add a `DISCORD_SET_CLIENT_SECRET` IPC channel is **not** needed — the secret is loaded the same
way as `clientId`, through the existing settings system.

---

### Step 5 — Update DiscordSettings.tsx

**Remove from setup instructions:**
- Step 2 currently says to add `http://127.0.0.1` as a redirect. **Keep this step** — it is
  still required for the authorization code redirect.
- Update step 3 to say: _"Copy the **Client ID** from General Information and the **Client Secret**
  from the OAuth2 tab."_
- Update step 4 to say: _"A browser popup will ask you to authorise the app — this only happens
  once. The token is saved to disk and reused on subsequent starts."_

**Update the token-persistence note** (currently line 201–204):
Change from _"The token is held in memory — you will be prompted again each time the app starts."_
to _"The token is saved locally and reused. You will only be prompted in the browser once,
unless you revoke access in Discord's Authorised Apps settings."_

**Add Client Secret field** — directly below the Client ID input, same style:

```tsx
<div className="mt-3">
  <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
    Client Secret
  </label>
  <input
    type="password"                   // masked — never show plaintext
    value={draftClientSecret}
    onChange={(e) => setDraftClientSecret(e.target.value)}
    placeholder="Your app's OAuth2 client secret"
    className="text-sm mono px-3 py-2 rounded"
    style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
             color: 'var(--color-text-primary)', outline: 'none', width: 320 }}
    spellCheck={false}
  />
  <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
    Found in the <strong>OAuth2</strong> tab of your Discord application. Stored locally
    in app settings — never sent anywhere except discord.com during the one-time token exchange.
  </p>
</div>
```

**Dirty detection / save handler** — extend the existing pattern to cover both fields:
```typescript
useEffect(() => {
  setDirty(draftClientId !== savedClientId || draftClientSecret !== savedClientSecret)
}, [draftClientId, savedClientId, draftClientSecret, savedClientSecret, setDirty])
```

In `registerSave`:
```typescript
await window.api.setSettings({
  ...current,
  discordClientId: trimmedId,
  discordClientSecret: draftClientSecretRef.current.trim(),
})
```

---

### Step 6 — Update main/index.ts service registration

In the `registerNativeService` call for Discord (around line 757), pass the client secret on
startup the same way as client ID:

```typescript
discordService = new DiscordService()
// ...
if (typeof saved.discordClientId === 'string' && saved.discordClientId) {
  discordService.setClientId(saved.discordClientId)
}
if (typeof saved.discordClientSecret === 'string' && saved.discordClientSecret) {
  discordService.setClientSecret(saved.discordClientSecret)
}
```

Also add `setClientSecret` to the settings-change handler that updates the service when settings
are saved from the renderer (same block as `setClientId`).

---

### Step 7 — Update CLAUDE.md

In the **Discord RPC Voice Integration** section:

1. Remove the `discord-rpc` package reference from the package table.
2. Update the connection flow to describe the direct IPC transport:
   - Step 1: `connect()` → open named pipe `\\.\pipe\discord-ipc-{0-9}`, send HANDSHAKE
   - Step 2: Receive READY event
   - Step 3: Load cached token or run AUTHORIZE → exchange code → AUTHENTICATE
3. Update **Authentication & token persistence** to reflect that tokens are now persisted to
   `userData/discord-token.json` and reused across restarts.
4. Update **Architectural lessons** — replace lesson 4 (type assertion for `request()`) with:
   - _"Direct pipe transport: the Discord RPC wire protocol is a simple 8-byte header + JSON
     frame. Implementing it directly eliminates the need for a package wrapper and avoids
     relying on undocumented internal commands."_
5. Update `SET_LOCAL_VOLUME` / `SET_LOCAL_MUTE` references to `SET_USER_VOICE_SETTINGS`.
6. Add `VOICE_STATE_CREATE` and `VOICE_STATE_DELETE` to the events list.

---

## Code to Remove

The following code exists solely to work around the `discord-rpc` package and must be deleted:

| Location | What to delete |
|---|---|
| `discordService.ts` lines 8–12 | `declare module 'discord-rpc'` block |
| `discordService.ts` `import { Client } from 'discord-rpc'` | Package import |
| `discordService.ts` `import { createConnection } from 'net'` | Only used by `probeDiscordPipes`; re-add if transport uses it |
| `discordService.ts` `probeDiscordPipes()` method | Debug probe, no longer needed |
| `discordService.ts` `clientSeq` field and all `[DEBUG]` log messages | Diagnostic scaffolding |
| `discordService.ts` `lastAvailable` field | Used only by `push()` to detect changes; can simplify |

---

## Code to Keep / Reuse

| Location | What to keep |
|---|---|
| `discordService.ts` public method signatures | Identical API surface → `main/index.ts` unchanged |
| `discordService.ts` state shape and `push()` logic | Unchanged |
| `discordService.ts` reconnect timer pattern | Same `scheduleReconnect` / `clearReconnectTimer` |
| `discordService.ts` `handleChannelJoin` participant mapping | Same `DiscordParticipant` construction from `voice_states` |
| `discordService.ts` `SPEAKING_START/STOP` handlers | Same logic |
| `discordService.ts` write commands (mute/deaf/volumes) | Same command names and args |
| All renderer files | Unchanged — store, UI, IPC bridge untouched |
| All `IPC_CHANNELS` constants | Unchanged |
| `DiscordState` / `DiscordParticipant` types | Unchanged |

---

## Testing Checklist

- [ ] App starts without `discord-rpc` in `node_modules`
- [ ] `npm run typecheck` passes with no TS errors
- [ ] With Discord not running: status shows "Not connected", auto-reconnect retries
- [ ] With Discord running but no Client ID / Secret: warning logged, status shows config error
- [ ] First connect: browser OAuth popup appears, auth completes, status turns green
- [ ] Second app start: no OAuth popup (cached token reused), status goes green immediately
- [ ] Token revoked in Discord settings: next connect clears cache, shows auth error
- [ ] Joining a voice channel: participants list populates
- [ ] Participant leaves channel: they are removed from the list (`VOICE_STATE_DELETE` fix)
- [ ] Mute / deafen toggles work
- [ ] Per-participant volume slider works (`SET_USER_VOICE_SETTINGS`)
- [ ] Per-participant local mute works (`SET_USER_VOICE_SETTINGS`)
- [ ] Input / output volume sliders work
- [ ] Reconnect button clears token and forces fresh OAuth
- [ ] Discord closes and restarts: service auto-reconnects after 10 s

---

## Estimated Effort

| Task | LOC delta | Notes |
|---|---|---|
| `discordService.ts` rewrite | ~350 (replacing ~500) | Transport + auth + service class |
| `types.ts` | +2 | One field + one default |
| `DiscordSettings.tsx` | +30 | One new input + updated copy |
| `main/index.ts` | +3 | One `setClientSecret` call |
| `package.json` | -3 | Remove two deps + asarUnpack entry |
| `CLAUDE.md` | ~20 lines updated | Documentation only |

Total: roughly **half a day** of focused implementation. No architectural changes; only the
transport layer and settings UI change. All renderer code and IPC wiring is untouched.
