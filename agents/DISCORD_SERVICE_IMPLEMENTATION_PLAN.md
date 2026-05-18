# Discord Voice Service — Implementation Plan

## Context

Add a Discord integration as a native service (following the SonarService pattern) that lets the
user control their mic mute/deafen, input/output volume, and per-participant volume/mute for
everyone in the same voice channel. Uses the `discord-rpc` npm package which connects to the
Discord desktop client via the local IPC socket (`\\.\pipe\discord-ipc-{0-9}`). Requires the user
to create a Discord application and enter its Client ID in a new Discord settings tab.

---

## Files to Modify / Create

| File | Action |
|---|---|
| `package.json` | Add `discord-rpc` dependency |
| `src/shared/types.ts` | Add `DiscordState`, `DiscordParticipant`, IPC channels, `SettingsTab`, `AppSettings.discordClientId` |
| `src/main/services/discordService.ts` | **New** — event-driven RPC service class |
| `src/main/index.ts` | Instantiate, wire, register, add IPC handlers, load persisted clientId |
| `src/preload/index.ts` | Expose Discord API methods via contextBridge |
| `src/renderer/src/types/electron.d.ts` | Add `window.api` Discord method declarations |
| `src/renderer/src/stores/discordStore.ts` | **New** — Zustand store for Discord state |
| `src/renderer/src/App.tsx` | Add IPC subscription `useEffect` |
| `src/renderer/src/pages/settings/DiscordSettings.tsx` | **New** — settings page |
| `src/renderer/src/components/settings/SettingsSidebar.tsx` | Add `discord` to `SETTINGS_NAV` |
| `src/renderer/src/components/settings/SettingsLayout.tsx` | Add to `SAVEABLE_TABS` and render |

---

## Step 1 — `package.json`

Add to `dependencies`:
```json
"discord-rpc": "^4.0.1"
```

Add to `devDependencies`:
```json
"@types/discord-rpc": "^4.0.8"
```

Add to `build.asarUnpack` (if array exists, append):
```json
"**/node_modules/discord-rpc/**"
```

Run `npm install` after this step.

---

## Step 2 — `src/shared/types.ts`

### 2a — IPC Channels (append to `IPC_CHANNELS`)
```typescript
// Discord RPC voice integration
DISCORD_GET_STATE: 'discord:getState',
DISCORD_STATE_CHANGE: 'discord:stateChange',
DISCORD_SET_SELF_MUTE: 'discord:setSelfMute',
DISCORD_SET_SELF_DEAF: 'discord:setSelfDeaf',
DISCORD_SET_INPUT_VOLUME: 'discord:setInputVolume',
DISCORD_SET_OUTPUT_VOLUME: 'discord:setOutputVolume',
DISCORD_SET_LOCAL_VOLUME: 'discord:setLocalVolume',
DISCORD_SET_LOCAL_MUTE: 'discord:setLocalMute',
DISCORD_RECONNECT: 'discord:reconnect',
```

### 2b — New interfaces (add after GG Sonar section)
```typescript
export interface DiscordParticipant {
  userId: string
  username: string
  nick: string
  muted: boolean        // their self-mute
  deafened: boolean
  localMuted: boolean   // we locally muted them
  localVolume: number   // 0-200 (100 = normal)
  speaking: boolean
  avatar: string | null
}

export interface DiscordState {
  available: boolean
  authenticated: boolean
  error: string | null
  voiceChannel: { id: string; name: string; guildName: string } | null
  participants: DiscordParticipant[]
  selfMuted: boolean
  selfDeafened: boolean
  inputVolume: number   // 0-100
  outputVolume: number  // 0-100
}
```

### 2c — `SettingsTab` union
```typescript
export type SettingsTab = 'general' | 'gg-sonar' | 'ddc' | 'notifications' | 'discord' | 'about'
```

### 2d — `AppSettings` interface — add field
```typescript
discordClientId: string
```

### 2e — `DEFAULT_SETTINGS` — add field
```typescript
discordClientId: '',
```

---

## Step 3 — `src/main/services/discordService.ts` (new file)

Class structure mirrors SonarService: injected `window`, `logFn`, `stateChangeFn`; `start()`/`stop()`; immutable `state` spread; `push()` for IPC emission.

Key design choices:
- **Event-driven, not polling** — subscribes to `VOICE_CHANNEL_SELECT`, `VOICE_STATE_UPDATE`, `SPEAKING_START/STOP`
- **Two-phase connect**: `client.connect()` opens IPC socket (fires `ready`); inside `ready`, `client.login()` does OAuth
- **Per-channel subscriptions**: Discord RPC requires `channel_id` when subscribing to `VOICE_STATE_UPDATE`, `SPEAKING_START/STOP` — re-subscribe on `VOICE_CHANNEL_SELECT`
- **Auto-reconnect**: 10s timer after disconnect; `stopped` flag prevents reconnect after explicit `stop()`
- **Optimistic writes**: patch `this.state` immediately in write methods then call `push()`

Public write API:
- `setSelfMute(muted)` → `SET_VOICE_SETTINGS { mute }`
- `setSelfDeaf(deafened)` → `SET_VOICE_SETTINGS { deaf }`
- `setInputVolume(0-100)` → `SET_VOICE_SETTINGS { input: { volume } }`
- `setOutputVolume(0-100)` → `SET_VOICE_SETTINGS { output: { volume } }`
- `setLocalVolume(userId, 0-200)` → `SET_LOCAL_VOLUME`
- `setLocalMute(userId, muted)` → `SET_LOCAL_MUTE`
- `reconnect()` → destroys client, calls `connect()`

On connect: reads initial voice settings with `GET_VOICE_SETTINGS`, checks `GET_SELECTED_VOICE_CHANNEL` for an existing channel, loads participants from `GET_CHANNEL` voice states, and gets guild name from `GET_GUILD`.

Avatar URL format: `https://cdn.discordapp.com/avatars/{userId}/{hash}.webp?size=64`

---

## Step 4 — `src/main/index.ts`

### 4a — Imports (top of file)
```typescript
import { DiscordService } from './services/discordService'
```

### 4b — Module-level variable (alongside `sonarService`)
```typescript
let discordService: DiscordService
```

### 4c — Instantiation and registration (inside `app.whenReady()`, after DDC block, before line 721)
```typescript
discordService = new DiscordService()
discordService.setLogEmitter((level, msg) => {
  serviceManager.emitNativeLog('discord', 'Discord Voice', level, msg)
})
discordService.setStateChangeNotifier(() => {
  serviceManager.broadcastServiceState()
})
serviceManager.registerNativeService({
  id: 'discord',
  name: 'Discord Voice',
  description: 'Discord RPC voice control — mute, deafen, and per-participant volume',
  onEnable: () => discordService.start(),
  onDisable: () => discordService.stop(),
  isRunning: () => discordService.isAvailable(),
})
```

### 4d — Load persisted `discordClientId` (inside the settings restore block at ~line 793)
```typescript
if (typeof saved.discordClientId === 'string' && saved.discordClientId) {
  discordService.setClientId(saved.discordClientId)
}
```

### 4e — `setWindow` call (after `sonarService.setWindow(mainWindow!)` at line 771)
```typescript
discordService.setWindow(mainWindow!)
```

### 4f — IPC handlers (inside `registerIpcHandlers()`)
```typescript
ipcMain.handle(IPC_CHANNELS.DISCORD_GET_STATE, () => discordService.getState())
ipcMain.handle(IPC_CHANNELS.DISCORD_SET_SELF_MUTE, (_, muted: boolean) => discordService.setSelfMute(muted))
ipcMain.handle(IPC_CHANNELS.DISCORD_SET_SELF_DEAF, (_, deafened: boolean) => discordService.setSelfDeaf(deafened))
ipcMain.handle(IPC_CHANNELS.DISCORD_SET_INPUT_VOLUME, (_, volume: number) => discordService.setInputVolume(volume))
ipcMain.handle(IPC_CHANNELS.DISCORD_SET_OUTPUT_VOLUME, (_, volume: number) => discordService.setOutputVolume(volume))
ipcMain.handle(IPC_CHANNELS.DISCORD_SET_LOCAL_VOLUME, (_, userId: string, volume: number) => discordService.setLocalVolume(userId, volume))
ipcMain.handle(IPC_CHANNELS.DISCORD_SET_LOCAL_MUTE, (_, userId: string, muted: boolean) => discordService.setLocalMute(userId, muted))
ipcMain.handle(IPC_CHANNELS.DISCORD_RECONNECT, () => discordService.reconnect())
```

### 4g — Update `SETTINGS_SET` handler to propagate `discordClientId`
```typescript
ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settings: AppSettings) => {
  writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8')
  if (typeof settings.minimizeToTray === 'boolean') {
    minimizeToTray = settings.minimizeToTray
  }
  if (typeof settings.discordClientId === 'string') {
    discordService.setClientId(settings.discordClientId)
  }
})
```

---

## Step 5 — `src/preload/index.ts`

Add import of `DiscordState` type, then add to the `api` object:
```typescript
discordGetState: (): Promise<DiscordState> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_GET_STATE),
discordSetSelfMute: (muted: boolean): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_SELF_MUTE, muted),
discordSetSelfDeaf: (deafened: boolean): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_SELF_DEAF, deafened),
discordSetInputVolume: (volume: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_INPUT_VOLUME, volume),
discordSetOutputVolume: (volume: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_OUTPUT_VOLUME, volume),
discordSetLocalVolume: (userId: string, volume: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_LOCAL_VOLUME, userId, volume),
discordSetLocalMute: (userId: string, muted: boolean): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_LOCAL_MUTE, userId, muted),
discordReconnect: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_RECONNECT),
onDiscordStateChange: (callback: (state: DiscordState) => void): (() => void) => {
  const handler = (_: Electron.IpcRendererEvent, state: DiscordState): void => callback(state)
  ipcRenderer.on(IPC_CHANNELS.DISCORD_STATE_CHANGE, handler)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.DISCORD_STATE_CHANGE, handler)
},
```

---

## Step 6 — `src/renderer/src/types/electron.d.ts`

Add `DiscordState` to imports, then add to `Window['api']`:
```typescript
discordGetState: () => Promise<DiscordState>
discordSetSelfMute: (muted: boolean) => Promise<void>
discordSetSelfDeaf: (deafened: boolean) => Promise<void>
discordSetInputVolume: (volume: number) => Promise<void>
discordSetOutputVolume: (volume: number) => Promise<void>
discordSetLocalVolume: (userId: string, volume: number) => Promise<void>
discordSetLocalMute: (userId: string, muted: boolean) => Promise<void>
discordReconnect: () => Promise<void>
onDiscordStateChange: (callback: (state: DiscordState) => void) => () => void
```

---

## Step 7 — `src/renderer/src/stores/discordStore.ts` (new file)

Zustand store with:
- `discordState: DiscordState | null`
- `setDiscordState(state)` — full replace on push events
- `patchParticipantVolume(userId, volume)` — optimistic local patch during slider drag
- `patchParticipantMute(userId, muted)` — optimistic local patch on mute click

---

## Step 8 — `src/renderer/src/App.tsx`

Add import of `useDiscordStore`, destructure `setDiscordState`, add:
```typescript
useEffect(() => {
  window.api.discordGetState().then(setDiscordState)
  const cleanup = window.api.onDiscordStateChange(setDiscordState)
  return cleanup
}, [setDiscordState])
```

---

## Step 9 — `src/renderer/src/pages/settings/DiscordSettings.tsx` (new file)

Follows `useSettingsForm` pattern (draft/saved state, `setDirty`, `registerSave`).

Sections:
1. **Status** — colored dot + status text (Not connected / Connected — auth failed / In voice: #channel (Server) / Connected — not in voice). Reconnect button.
2. **Discord Application** — Client ID text input with help text explaining how to create an app at discord.com/developers/applications. `openExternal` link (already exposed as `window.api.openExternal`). Save triggers reconnect with new client ID.
3. **My Voice** (visible only when `connected`) — Mute Mic / Deafen buttons (red when active), Mic Input Volume slider (0-100), Output Volume slider (0-100).
4. **Voice Channel** (visible only when `connected && voiceChannel`) — list of participants: avatar, nick (green when speaking), muted/deafened/local-mute badges, per-participant volume slider (0-200), local mute toggle.

On save: `setSettings({ ...current, discordClientId: trimmed })` then `discordReconnect()`.

---

## Step 10 — `src/renderer/src/components/settings/SettingsSidebar.tsx`

Add to `SETTINGS_NAV` before `about`:
```typescript
{ id: 'discord', label: 'Discord' },
```

---

## Step 11 — `src/renderer/src/components/settings/SettingsLayout.tsx`

Add `'discord'` to `SAVEABLE_TABS`. Import `DiscordSettings`. Add render:
```typescript
{currentSettingsTab === 'discord' && <DiscordSettings />}
```

---

## Verification

1. `npm run typecheck` — all 11 files type-check cleanly
2. `npm run dev` — About terminal shows `Discord: connecting to Discord client via RPC...`
3. With Discord closed: Settings > Discord shows "Not connected"
4. Open Discord desktop app — within 10 seconds status changes to "Connected"
5. First run: browser popup for OAuth consent appears; grant `rpc rpc.voice.read rpc.voice.write`
6. Join a voice channel — participants list appears; speaking indicator goes green
7. Mute Mic button — Discord's own UI shows mic muted; toggle back
8. Drag a participant volume slider — volume changes immediately in Discord
9. Local mute a participant — only you stop hearing them
10. Settings > General > Services — "Discord Voice" appears with running/stopped status
11. Disable Discord service — status goes to `disabled`, RPC disconnects; re-enable reconnects
12. Enter invalid Client ID, Save — auth error shown in status; fix Client ID, Save — reconnects
