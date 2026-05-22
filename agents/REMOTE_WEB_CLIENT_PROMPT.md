# Agent Prompt: Build Remote Web Client

> Paste the contents of this file as the opening message in a new Claude Code session
> in the `c:\Users\ffvd\Documents\control_centre_pro` working directory.

---

You are implementing a new feature for **Control Centre Pro**, a Windows Electron desktop app that manages hardware devices (headsets, monitors, audio mixing) as a background service. The full implementation plan is in `agents/REMOTE_WEB_CLIENT.md` — read it before writing any code. Also read `CLAUDE.md` for project-wide architecture rules you must follow.

## Your Task

Build the Remote Web Client feature exactly as specified in `agents/REMOTE_WEB_CLIENT.md`. Work through the four phases in order. Do not skip phases or reorder them — each phase is independently shippable and must compile and run before you move to the next.

## Before You Start

Read these files in full:
1. `agents/REMOTE_WEB_CLIENT.md` — the complete implementation plan
2. `CLAUDE.md` — architecture rules, design system, commit format
3. `src/shared/types.ts` — all IPC channels, AppSettings, ArctisState, SonarState
4. `src/main/index.ts` — how services are wired and IPC handlers are registered
5. `src/main/services/sonarService.ts` — Sonar service API
6. `src/main/services/serviceManager.ts` — Arctis HID service and event routing
7. `src/preload/index.ts` — the existing window.api bridge (model the new IPC additions on this)
8. `src/renderer/src/stores/sonarStore.ts` — Zustand store you'll mirror for the web client
9. `src/renderer/src/stores/serviceStore.ts` — Zustand store you'll mirror for the web client

## Non-Negotiable Architecture Rules

These come from CLAUDE.md and must not be violated:

- **No `nodeIntegration: true`** — do not change BrowserWindow security settings
- **No `ipcRenderer` directly in React** — all IPC goes through `window.api.*` (preload bridge)
- **No string literals for IPC channels** — use the `IPC_CHANNELS` constants in `src/shared/types.ts`
- **Use `ipcMain.handle()` not `ipcMain.on()`** for new IPC handlers
- **No hardcoded hex colors** — use `var(--color-*)` CSS custom properties from the design system
- **Settings pages use `useSettingsForm()` context** — do not add local Save/Apply buttons
- **The `HttpApiServer` runs in the main process only** — never import it from renderer code

## Phase Checklist

Work through each phase completely before starting the next. After each phase, run `npm run typecheck` to verify no TypeScript errors, then commit with format `feat: remote web client phase N — <description>`.

### Phase 1 — Foundation
Goal: HTTP server starts, `http://<LAN-IP>:8080` serves a blank React page, WebSocket connects.

- [ ] Add `remoteEnabled: boolean` and `remotePort: number` to `AppSettings` in `src/shared/types.ts`
- [ ] Add `'remote-access'` to `SettingsTab` union in `src/shared/types.ts`
- [ ] Add `REMOTE_GET_INFO: 'remote:getInfo'` to `IPC_CHANNELS` in `src/shared/types.ts`
- [ ] Create `src/main/httpApiServer.ts` with `HttpApiServer` class (REST + WS, static file serving, `broadcast()` with 16 KB backpressure guard — see plan for exact implementation)
- [ ] Modify `src/main/index.ts` to start/stop `HttpApiServer` based on settings (see plan)
- [ ] Add `ipcMain.handle(IPC_CHANNELS.REMOTE_GET_INFO, ...)` handler in `src/main/index.ts`
- [ ] Expose `remoteGetInfo()` in `src/preload/index.ts` and declare on `Window['api']` in `electron.d.ts`
- [ ] Create `vite.config.web.ts` pointing at `src/webClient/` → `out/webClient/`
- [ ] Create `src/webClient/index.html`, `src/webClient/src/main.tsx`, `src/webClient/src/App.tsx` (mobile shell with bottom-tab nav: Home / Arctis / Sonar; connection status dot top-right)
- [ ] Create `src/webClient/src/api/http.ts` (fetch helpers)
- [ ] Create `src/webClient/src/api/websocket.ts` (`useWebSocket` hook, singleton WS, reconnect logic, 2s polling fallback on disconnect)
- [ ] Add `"build:web": "vite build --config vite.config.web.ts"` to `package.json`
- [ ] Run `npm run typecheck` — zero errors
- [ ] Commit: `feat: remote web client phase 1 — HTTP/WS server and web scaffold`

### Phase 2 — Home + Arctis Pages
Goal: Home and Arctis pages show real device data and accept control commands from the phone.

- [ ] Create `src/webClient/src/stores/serviceStore.ts` (mirrors renderer store, replaces IPC with fetch + WS listeners — see plan for exact replacements)
- [ ] Create `src/webClient/src/pages/Home.tsx` (reuse or copy home card components; status cards for connected devices)
- [ ] Create `src/webClient/src/pages/Arctis.tsx` (full parity — HeadsetCard, AudioOptionsPanel, WirelessAudioPanel, BaseStationPanel, EqPanel)
- [ ] EQ Panel: add `overflow-x: auto` horizontal scroll container for mobile (see plan for CSS)
- [ ] SliderInput: add `@media (pointer: coarse)` larger touch targets (see plan for CSS)
- [ ] Hook WS broadcast in `src/main/index.ts` for Arctis events: wherever `mainWindow.webContents.send('arctis:...')` is called, also call `httpApiServer?.broadcast('arctis:...', payload)`
- [ ] Run `npm run typecheck` — zero errors
- [ ] Commit: `feat: remote web client phase 2 — Home and Arctis pages`

### Phase 3 — Sonar Page
Goal: Sonar channel mixer and preset switcher work from the phone with optimistic UI.

- [ ] Create `src/webClient/src/stores/sonarStore.ts` (mirrors renderer store, replaces IPC with fetch + WS — retain all optimistic patching logic unchanged; see plan for exact replacements)
- [ ] Create `src/webClient/src/pages/Sonar.tsx` (channel mixer + preset switcher)
- [ ] Sonar mixer: add mobile responsive CSS — vertical stacking, horizontal sliders (see plan)
- [ ] Hook WS broadcast in `src/main/index.ts` for `sonar:stateChange` events
- [ ] Run `npm run typecheck` — zero errors
- [ ] Commit: `feat: remote web client phase 3 — Sonar page`

### Phase 4 — QR Code Settings Tab
Goal: User can enable the server and scan a QR code from the desktop app settings.

- [ ] Run `npm install qrcode.react`
- [ ] Create `src/renderer/src/pages/settings/RemoteAccessSettings.tsx` (enable toggle, port input, QR code display — see plan for component sketch; use `useSettingsForm()` context, not a local Save button)
- [ ] Add `{ id: 'remote-access', label: 'Remote Access' }` to `SETTINGS_NAV` in `SettingsSidebar.tsx`
- [ ] Add `case 'remote-access': return <RemoteAccessSettings />` in `SettingsLayout.tsx`
- [ ] Run `npm run typecheck` — zero errors
- [ ] Commit: `feat: remote web client phase 4 — QR code settings tab`

### Final Step
- [ ] Update `CLAUDE.md` with the "Remote Web Client" pattern section (see plan for exact content)
- [ ] Update `agents/REMOTE_WEB_CLIENT.md` status from `📋 Planned` to `✅ Working`
- [ ] Commit: `docs: update CLAUDE.md and agent doc for remote web client`

## Key Implementation Notes

**`broadcast()` backpressure guard** — this is critical for app performance. Use exactly this pattern, no shortcuts:
```typescript
broadcast(type: string, payload: unknown): void {
  const json = JSON.stringify({ type, payload })
  for (const client of this.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 16384) {
      client.send(json)
    }
  }
}
```

**Component reuse strategy** — try to import renderer components directly first. If a component has deep `window.api` calls or Electron-only imports that prevent it compiling in the web client context, copy it to `src/webClient/src/components/` and strip the IPC references (components should only call store functions, never IPC directly).

**Static file serving** — the HTTP server serves `out/webClient/` as static files. The web client must be built (`npm run build:web`) before the server can serve it. In development you can point the server at `src/webClient/` with Vite's dev server instead, but production flow is: build web client → start Electron app → enable remote in settings.

**Default settings** — when loading settings, if `remoteEnabled` or `remotePort` are missing (existing installs), default them to `false` and `8080` respectively. Do not break existing settings files.

**LAN IP** — use `os.networkInterfaces()` to find the first non-internal IPv4 address. Fall back to `127.0.0.1` if none found. This address is what goes in the QR code.

**TypeScript strict** — this project uses strict TypeScript. No `any` types, no `@ts-ignore`. If you need to type something loosely, use `unknown` and narrow it.

## Design System Reminder

- Colors: always `var(--color-*)`, never hex
- Fonts: `Segoe UI` for UI text, `.mono` class for code/numbers
- No gradients, no heavy shadows
- The web client inherits the same CSS custom properties — copy the `:root` block from the renderer's global CSS into the web client's CSS entry point
