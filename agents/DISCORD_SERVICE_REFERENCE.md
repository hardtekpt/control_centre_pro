# Discord Service Implementation Reference

**Status**: ✅ IMPLEMENTED  
**Date**: 2026-05-18  
**Branch**: development

## Quick Reference

The Discord voice control service has been fully integrated into Control Centre Pro. This document provides a quick reference for future agents working with this feature.

### What Was Implemented

A native Discord RPC service that connects to the Discord desktop client and provides:
- User mic mute/unmute and deafen/undeafen control
- Input/output volume control (0-100)
- Per-participant volume control (0-200)
- Per-participant local mute
- Live speaking indicators
- Connection status monitoring with auto-reconnect

### Key Files

**Service Implementation**:
- `src/main/services/discordService.ts` — Main service class (event-driven, auto-reconnects)

**State Management**:
- `src/renderer/src/stores/discordStore.ts` — Zustand store
- `src/shared/types.ts` — `DiscordState` and `DiscordParticipant` types

**UI/Settings**:
- `src/renderer/src/pages/settings/DiscordSettings.tsx` — Settings page with Client ID input, status, controls

**Integration**:
- `src/main/index.ts` — Service instantiation, IPC handlers, lifecycle
- `src/preload/index.ts` — API bridge to renderer
- `src/renderer/src/types/electron.d.ts` — TypeScript declarations
- `src/renderer/src/App.tsx` — IPC subscriptions

**Navigation**:
- `src/renderer/src/components/settings/SettingsSidebar.tsx` — Added Discord tab
- `src/renderer/src/components/settings/SettingsLayout.tsx` — Added Discord tab rendering

### IPC Channels

All channels are defined in `src/shared/types.ts` and follow this pattern:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `DISCORD_GET_STATE` | invoke | Get current state |
| `DISCORD_STATE_CHANGE` | push | State updates from RPC |
| `DISCORD_SET_SELF_MUTE` | invoke | Mute/unmute self |
| `DISCORD_SET_SELF_DEAF` | invoke | Deafen/undeafen self |
| `DISCORD_SET_INPUT_VOLUME` | invoke | Set mic volume (0-100) |
| `DISCORD_SET_OUTPUT_VOLUME` | invoke | Set output volume (0-100) |
| `DISCORD_SET_LOCAL_VOLUME` | invoke | Set participant volume (0-200) |
| `DISCORD_SET_LOCAL_MUTE` | invoke | Locally mute participant |
| `DISCORD_RECONNECT` | invoke | Force reconnect |

### Design Patterns Used

1. **Native Service Registration** — Registers with `serviceManager` alongside Sonar/DDC
2. **Event-Driven** — Subscribes to Discord RPC events (not polling)
3. **Immutable State** — All state updates use spread operator
4. **Optimistic Writes** — Local state updated immediately, then synced
5. **Auto-Reconnect** — 10-second timer when connection drops
6. **Module Declaration** — Type assertion for `Client.request()` method

### Dependencies

- `discord-rpc` — ^4.0.1 (npm dependency)
- `@types/discord-rpc` — ^4.0.8 (devDependency)

Both added to `package.json` and configured in `build.asarUnpack`.

### Architecture Rules Followed

✅ `nodeIntegration: false` — No security violations  
✅ All IPC via contextBridge — No direct `ipcRenderer` in renderer  
✅ Typed IPC channels — All channel names from `IPC_CHANNELS` constant  
✅ No file I/O in renderer — All handled by main process  
✅ `ipcMain.handle` pattern — Supports `await` from renderer  
✅ Logging integration — Service logs appear in About terminal  

### Testing Checklist

- [ ] Type checking passes (`npm run typecheck`)
- [ ] App launches (`npm run dev`)
- [ ] Discord service appears in Settings > General > Services
- [ ] Settings > Discord shows connection status
- [ ] Entering Client ID and saving works
- [ ] Service connects to Discord when available
- [ ] Mute/Deafen/Volume controls work in Settings > Discord
- [ ] Participant list updates when users join/leave channel
- [ ] Speaking indicator highlights participants
- [ ] Reconnect button manually reconnects

### User Setup Flow

1. User navigates to Settings > Discord
2. Creates Discord app at discord.com/developers/applications
3. Copies Client ID from app page
4. Pastes into Discord settings Client ID field
5. Clicks Save → triggers reconnect
6. First time: OAuth popup in browser (grant scopes)
7. Status changes to "In voice: #channel (Server)"
8. User can now control their voice and participant volumes

### Future Enhancements

- [ ] Persist Discord connection settings (already stores Client ID)
- [ ] Add Discord commands/actions to shortcuts system
- [ ] Display Discord status in sidebar or home page
- [ ] Context menu for quick mute/deafen from tray
- [ ] Notification on voice channel join/leave
- [ ] Integration with Sonar preset switcher (auto-apply presets per Discord channel)

---

**Full Implementation Plan**: See `DISCORD_SERVICE_IMPLEMENTATION_PLAN.md` in this folder.
