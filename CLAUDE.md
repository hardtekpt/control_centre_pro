# Control Centre Pro — Claude Code Reference

## Overview

**Control Centre Pro** is a Windows desktop app for managing hardware devices and services via a clean sidebar-based UI. Monitor headsets (Arctis Nova Pro), control display settings (DDC/CI), manage audio (GG Sonar), and configure keyboard shortcuts with real-time OSD notifications.

**Architecture**: Extensible shell pattern. Main process spawns Python subprocesses (services) that emit newline-delimited JSON events, and also runs native Node.js services (DDC, Sonar, Discord). Renderer (React) consumes these via Zustand stores. All state persists to `app.getPath('userData')`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Shell** | Electron 31+, electron-vite, electron-builder |
| **UI** | React 18 + TypeScript, Tailwind CSS, Zustand |
| **Services** | Python subprocesses (JSON stdout), Node.js (DDC, Sonar, Discord), worker threads (blocking native calls) |
| **Styling** | Tailwind (layout/spacing) + CSS custom properties (colors) |

---

## Architecture Rules (Never Break)

1. **No `nodeIntegration: true`** — security risk; any XSS = full system compromise
2. **Never use `ipcRenderer` directly in React** — go through `window.api.*` (preload bridge)
3. **No string literals for IPC channels** — use `IPC_CHANNELS` constants in `src/shared/types.ts`
4. **No renderer file I/O** — always request via IPC from main process
5. **Use `ipcMain.handle()` not `ipcMain.on()`** — allows renderer to `await` results
6. **Worker threads for blocking native calls** — DDC reads (~300ms each), PowerShell queries run in `worker_threads.Worker`, never on main thread

---

## Design System

**Philosophy**: Pure neutral grays (no warm/cool undertones), minimal, matches Claude Code aesthetic.

### Color Tokens (CSS custom properties)

```css
/* Light mode */
--color-bg:             #F5F5F5    /* Canvas */
--color-surface:        #EBEBEB    /* Sidebar, panels */
--color-surface-raised: #E3E3E3    /* Inputs, dropdowns */
--color-text-primary:   #141414    /* Near-black */
--color-text-secondary: #8C8C8C    /* Muted gray */
--color-accent:         #525252    /* ONLY action color */
--color-border:         #D8D8D8
--color-code-bg:        #E5E5E5    /* Terminal areas */

/* Dark mode (toggle via data-theme="dark" on <html>) */
--color-bg:             #1C1C1C
--color-surface:        #252525
--color-surface-raised: #2C2C2C
--color-text-primary:   #EBEBEB
--color-text-secondary: #888888
--color-accent:         #B0B0B0
--color-border:         #383838
--color-code-bg:        #252525
```

**Rules**: Reference via `var(--color-*)` in styles. Never hardcode hex. Gray is the only accent. No gradients, no heavy shadows. Fonts: `Segoe UI` for chrome, `JetBrains Mono`/`Cascadia Code` for code (`.mono` utility class).

---

## Core Patterns

### Sidebar Behaviour
- **Width**: 240px default | 180–320px range | resizable handle on right edge
- **Collapsed**: sidebar unmounts entirely (no icon strip)
- **Peek panel**: `FloatingSidebar` (React portal) on collapsed button hover, anchored via `getBoundingClientRect()`
- **State**: lives in Zustand (`appStore.ts`); add localStorage persistence later
- **Important**: `FloatingSidebar.tsx` and `Sidebar.tsx` must stay in sync (see feedback memory)

### Floating UI Pattern
- Use `ReactDOM.createPortal(element, document.body)` for overlays escaping `overflow: hidden`
- Anchor via `useRef` + `getBoundingClientRect()`
- Shared timers (e.g. peek panel hide) as module-level vars, never in Zustand state
- Content-sized panels: use `minHeight`, never `bottom` (stretches incorrectly)

### Service System (Python Subprocesses)
- **Protocol**: Services emit newline-delimited JSON objects with `type` field
- **Message types**: `log`, `connected`, `disconnected`, `event`, `fatal`
- **Persistence**: `app.getPath('userData')/services.json` (python path, enable/disable flags)
- **Renderer state**: Zustand store (`serviceStore.ts`) holds services[], logs (up to 500), device state
- **IPC subscriptions**: wired in `App.tsx` via `useEffect` so they're always active

### Worker Threads (Blocking Calls)
- **Pattern**: async wrapper in main process + worker file (separate build entry in `electron.vite.config.ts`)
- **Message passing**: post `{ id, type, ...args }`, store `{ resolve, reject }` in `Map<id, callbacks>`, resolve when matching reply arrives
- **Used for**: DDC reads, PowerShell queries (primary display detection), HDMI enumeration
- **Build config**: add worker as rollup `input` entry so it compiles to separate `.js` file

### Settings Persistence
- **System**: all user-configurable settings in global `AppSettings` interface (`src/shared/types.ts`)
- **Pattern**: use `useSettingsForm()` context to register a save handler; global Save button triggers all
- **Never** add local Save/Apply buttons to settings pages
- **File**: `app.getPath('userData')/settings.json` (loaded/saved via `SETTINGS_GET`/`SETTINGS_SET` IPC)

### Notifications (Two Surfaces)
- **System surface**: spawned `BrowserWindow` (340×108px, frameless, non-focusable) for messages
- **OSD surface**: persistent window with React `NotificationOverlay`, stacks hardware events
- **Deduplication**: same `key` replaces existing notification (no stacking)
- **Pattern**: `notifyFromEvent.ts` maps hardware events → `window.api.notifPush(spec)` → main process → OSD window

### Slider Input Pattern
- **Component**: `SliderInput` in `src/renderer/src/components/SliderInput.tsx` — the canonical slider style
- **Features**: Custom track/thumb rendering (no native input styling), drag/keyboard/wheel support, optional muted state indicator
- **Visual design**: 6px tall track with 1px border, 10×18px thumb with subtle shadow, rounded-full styling
- **Usage**: Import `SliderInput`, pass `value` (0-1), `onChange` callback, optional `muted`/`showMuted` props, optional `onDragStart`/`onDragEnd` for state coordination
- **Wrapper pattern**: For fixed min/max ranges (e.g., 0-100 or 0-10), wrap `SliderInput` in a component that normalizes values (e.g., `Slider` in `CompactHeadsetCard.tsx`)
- **Applied to**: Volume sliders (Arctis, Sonar), brightness slider (Display), ChatMix custom bar (keep as-is for Arctis)
- **Drag coordination**: Sonar card calls `useSonarStore.getState().beginDrag()` / `endDrag()` via callbacks to prevent animations during drag

---

## Key Architectural Lessons

1. **Optimistic UI beats waiting for hardware** — update local state immediately, ignore stale echoed events via write-lock timestamps
2. **Command coalescing** — rapid slider drags queued + `setImmediate` so hardware only writes once per gesture
3. **Event-driven > polling** — Discord RPC and Sonar work best with subscriptions, not polls
4. **Don't trust monitor capabilities** — use fixed common input code list; always include current input
5. **Separate IPC protocol from business logic** — JSON schema for subprocesses makes them swappable
6. **Immutable state updates** — use spread operator; enables debuggability and prevents subtle mutations
7. **Direct wire-protocol transport beats package wrappers** — the Discord RPC IPC is a simple 8-byte header + JSON frame; implementing it directly removes stale dependencies and avoids undocumented internal commands

---

## Common Tasks

### Adding a New Page
1. Add `NavItemDef` to `MAIN_NAV` in `Sidebar.tsx`
2. Add `id` to `AppView` union in `shared/types.ts`
3. Create component in `src/renderer/src/pages/`
4. Add case in `MainContent.tsx`
5. **Keep `Sidebar.tsx` and `FloatingSidebar.tsx` in sync** (duplicate nav items)

### Adding a New Settings Tab
1. Add `id` to `SettingsTab` union in `shared/types.ts`
2. Add entry to `SETTINGS_NAV` in `SettingsSidebar.tsx`
3. Create page in `src/renderer/src/pages/settings/`
4. Add case in `SettingsLayout.tsx`
5. Use `useSettingsForm()` context for save handler (not a local Save button)

### Adding a New IPC Channel
1. Add name to `IPC_CHANNELS` in `shared/types.ts`
2. Add `ipcMain.handle(IPC_CHANNELS.YOUR_CHANNEL, handler)` in `main/index.ts`
3. Expose method in `preload/index.ts` via `contextBridge`
4. Declare on `Window['api']` interface in `electron.d.ts`

### Adding a New Python Service
1. Create `resources/services/<id>_service.py` following JSON protocol (type: log|connected|disconnected|event|fatal)
2. Add entry to `SERVICE_DEFS` in `serviceManager.ts`
3. Add IPC channels to `IPC_CHANNELS`
4. Handle messages in `ServiceManager.handleMessage()`
5. Subscribe to push events in `App.tsx`

### Discord RPC Service (reference implementation)
- **Transport**: `DiscordRpcTransport` in `discordService.ts` — hand-rolled named-pipe client, no npm package
- **Wire protocol**: opcode 0 = HANDSHAKE, opcode 1 = FRAME; 8-byte LE header + JSON body
- **READY frame**: Discord sends READY as `{ cmd: "DISPATCH", evt: "READY" }` — check inside the DISPATCH branch
- **SUBSCRIBE**: `evt` must be top-level on the frame, not inside `args`
- **OAuth**: AUTHORIZE → POST `/oauth2/token` with `Content-Type: application/x-www-form-urlencoded` (not set automatically by `net.request`) → AUTHENTICATE; token cached to `userData/discord-token.json`
- **Settings**: `discordClientId` + `discordClientSecret` in `AppSettings`; secret only sent to `discord.com` during token exchange
- See `agents/DISCORD_SERVICE.md` for full protocol reference and bug history

### Adding a New Slider
1. Import `SliderInput` from `components/SliderInput.tsx`
2. If the slider has a fixed min/max range (e.g., 0-100), create a wrapper component that normalizes the value to 0-1:
   ```tsx
   function VolumeSlider({ value, onChange }) {
     return (
       <div className="flex items-center gap-2 py-1">
         <SliderInput value={value / 100} onChange={(v) => onChange(v * 100)} />
         <span className="text-xs shrink-0">{value}%</span>
       </div>
     )
   }
   ```
3. For optional drag state coordination (e.g., Sonar needs `beginDrag`), pass `onDragStart`/`onDragEnd` callbacks
4. If the slider needs a muted state indicator (fill color changes), pass `muted` and `showMuted={true}`

---

## Git Workflow

- **`master`** — stable production releases
- **`development`** — integration branch (default)
- **`feat/<name>`** — feature branches from development, merged back via `--no-ff`
- **`fix/<name>`, `docs/<name>`** — bugfix and documentation branches

**Commit format**: `type: description` where type is `feat`, `fix`, `chore`, `docs`, `refactor`

**Auto-commit rule**: after completing code changes, commit immediately (stage only modified files, skip `.claude/`, `*.tsbuildinfo`).

**Complex features**: create branch → commit incrementally → merge back → update CLAUDE.md if new patterns added.

---

## Quick Commands

```powershell
npm install              # Install dependencies
npm run dev              # Electron + Vite HMR (renderer hot-reloads)
npm run build            # Build for production
npm run package          # Build + Windows installer
npm run typecheck        # TypeScript validation

# Arctis HID service setup
python -m pip install git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development
```

---

## Known Gaps / Next Steps

- [ ] Sidebar width/collapsed state not persisted (add localStorage/electron-store)
- [ ] Duplicate nav definitions in `Sidebar.tsx` and `FloatingSidebar.tsx` (extract shared module)
- [ ] No test suite (add Vitest for renderer, mocks for main process)
- [ ] Arctis write commands — full EQ/sidetone UI TBD
- [ ] Auto-updater not configured (needs release server URL)
- [ ] Service log not clearable (add Clear button)
- [ ] Home page no empty state when devices disconnected
- [ ] Discord: add mute/deafen shortcuts integration
- [ ] Discord: show voice status on Home page / sidebar

---

**For detailed service documentation** (Arctis HID, DDC/CI, GG Sonar, Discord RPC, shortcuts, preset auto-switcher), see `agents/` folder or search the codebase directly.
