# Remote Web Client (Smartphone)

**Status**: ✅ Working  
**Branch**: `development` (merged — all 4 phases shipped)

---

## What It Does

A local-network web app served by the Electron main process. The user scans a QR code in the Settings page and gets a mobile browser interface to control the app from their phone. Covers the Home, Arctis Nova Pro, and GG Sonar pages with full parity to the desktop UI, adapted for touch via responsive CSS.

**Key constraints confirmed with user:**
- Served as static files by an embedded HTTP server (not external hosting)
- Local network only, no authentication
- Full desktop feature parity (including 10-band EQ)
- Reuse existing React components + add responsive CSS breakpoints
- EQ panel uses horizontal scroll on mobile
- Built via separate `npm run build:web` command (not integrated into `npm run build`)

---

## Architecture

```
Electron Main Process
├── Existing services (Sonar, Arctis, DDC, Discord) — UNCHANGED
├── NEW: HttpApiServer  src/main/httpApiServer.ts
│   ├── HTTP REST  →  invoke-style calls (GET/POST per feature)
│   └── WebSocket  →  push events broadcast to all clients
└── index.ts  (+3 lines to start/stop server based on settings)

Web Client  src/webClient/
├── Built by vite.config.web.ts  →  out/webClient/
├── Shares src/shared/types.ts directly
├── Stores mirror renderer stores (IPC calls → fetch/WebSocket)
└── Pages reuse renderer components with added responsive CSS
```

---

## File Map

### New files to create

| File | Purpose |
|---|---|
| `src/main/httpApiServer.ts` | HTTP + WebSocket server, REST routes, static file serving |
| `vite.config.web.ts` | Separate Vite build config for the web client |
| `src/webClient/index.html` | Web client entry HTML |
| `src/webClient/src/main.tsx` | React root |
| `src/webClient/src/App.tsx` | Mobile router (bottom-tab nav: Home / Arctis / Sonar) |
| `src/webClient/src/api/http.ts` | `get(path)` / `post(path, body)` fetch helpers pointing at `window.REMOTE_ORIGIN` |
| `src/webClient/src/api/websocket.ts` | `useWebSocket()` hook — connects to `ws://<host>/ws`, dispatches events to stores |
| `src/webClient/src/stores/serviceStore.ts` | Mirrors `renderer/src/stores/serviceStore.ts`; replaces IPC with fetch + WS |
| `src/webClient/src/stores/sonarStore.ts` | Mirrors `renderer/src/stores/sonarStore.ts`; replaces IPC with fetch + WS |
| `src/webClient/src/pages/Home.tsx` | Reuses home card components; status-only layout |
| `src/webClient/src/pages/Arctis.tsx` | Full Arctis controls; EQ as horizontal-scroll panel |
| `src/webClient/src/pages/Sonar.tsx` | Channel mixer + preset switcher |
| `src/renderer/src/pages/settings/RemoteAccessSettings.tsx` | QR code, enable toggle, port field |

### Existing files to modify

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `remoteEnabled: boolean` and `remotePort: number` to `AppSettings` |
| `src/main/index.ts` | Import `HttpApiServer`; start on app ready; restart on settings change |
| `src/renderer/src/pages/settings/SettingsLayout.tsx` | Add `remote-access` case |
| `src/renderer/src/components/layout/SettingsSidebar.tsx` | Add "Remote Access" nav item to `SETTINGS_NAV` |
| `src/shared/types.ts` | Add `'remote-access'` to `SettingsTab` union |
| `package.json` | Add `"build:web": "vite build --config vite.config.web.ts"` script |
| `electron.vite.config.ts` | No changes needed (web client has its own config) |

---

## Phase 1 — Foundation

**Goal**: HTTP server running, web client scaffold loads in a browser, WebSocket connects.

### 1. `src/shared/types.ts`

Add to `AppSettings`:
```typescript
remoteEnabled: boolean   // default: false
remotePort: number       // default: 8080
```

### 2. `src/main/httpApiServer.ts`

```typescript
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { readFileSync } from 'fs'
import { join } from 'path'
import { networkInterfaces } from 'os'

// Injected via constructor from index.ts:
//   sonarService, serviceManager, ddcService, discordService, settingsGetter

export class HttpApiServer {
  private server
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()
  private port: number

  constructor(deps: ServerDeps) { ... }

  start(port: number): void
  stop(): void
  broadcast(type: string, payload: unknown): void  // called by main/index.ts event handlers
  getLanUrl(): string   // returns http://192.168.x.x:PORT
}
```

**`broadcast()` must guard against slow or disconnected clients** — a stalled phone must never create backpressure that blocks the main process:

```typescript
broadcast(type: string, payload: unknown): void {
  const json = JSON.stringify({ type, payload })
  for (const client of this.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 16384) {
      client.send(json)
      // Drop silently if buffer is backing up — client will re-sync on next REST poll
    }
  }
}
```

The `16384` (16 KB) threshold means a slow or temporarily frozen phone client gets messages dropped rather than queuing unbounded memory in the main process. The web client recovers automatically: on reconnect it fetches fresh state via the initial `init` snapshot.
```

**REST routes** (all JSON, no auth):

| Method | Path | Handler |
|---|---|---|
| `GET` | `/api/info` | `{ url, port }` — LAN URL for QR |
| `GET` | `/api/arctis/state` | `serviceManager.getArctisState()` |
| `POST` | `/api/arctis/cmd` | `{ cmd, value }` → `serviceManager.sendArctisCmd()` |
| `GET` | `/api/sonar/state` | `sonarService.getState()` |
| `POST` | `/api/sonar/volume` | `{ channel, volume, mode }` → `sonarService.setVolume()` |
| `POST` | `/api/sonar/mute` | `{ channel, muted }` → `sonarService.setMute()` |
| `POST` | `/api/sonar/preset` | `{ presetId, mode }` → `sonarService.selectPreset()` |
| `POST` | `/api/sonar/mode` | `{ mode }` → `sonarService.setMode()` |
| `GET` | `/` and `/*` | Serve `out/webClient/index.html` (SPA fallback) |
| `GET` | `/assets/*` | Serve `out/webClient/assets/*` |

**WebSocket** (`ws://host:PORT/ws`):

On connect: immediately send current state snapshot:
```json
{ "type": "init", "payload": { "arctis": ArctisState|null, "sonar": SonarState|null } }
```

Ongoing push events (broadcast to all clients):
```json
{ "type": "arctis:event",      "payload": ArctisEvent }
{ "type": "arctis:connected",  "payload": null }
{ "type": "arctis:disconnected","payload": null }
{ "type": "sonar:stateChange", "payload": SonarState }
```

**Hook into main/index.ts**: wherever IPC push handlers currently call `mainWindow.webContents.send(...)`, also call `httpApiServer?.broadcast(type, payload)`.

**LAN IP detection**:
```typescript
function getLanIp(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}
```

### 3. `src/main/index.ts` changes

```typescript
import { HttpApiServer } from './httpApiServer'
let httpApiServer: HttpApiServer | null = null

// In app.whenReady(), after services init:
if (settings.remoteEnabled) {
  httpApiServer = new HttpApiServer({ sonarService, serviceManager, ... })
  httpApiServer.start(settings.remotePort ?? 8080)
}

// In SETTINGS_SET handler, add:
if (newSettings.remoteEnabled !== oldSettings.remoteEnabled || newSettings.remotePort !== oldSettings.remotePort) {
  httpApiServer?.stop()
  httpApiServer = null
  if (newSettings.remoteEnabled) {
    httpApiServer = new HttpApiServer(...)
    httpApiServer.start(newSettings.remotePort ?? 8080)
  }
}
```

Add an IPC channel for QR info (called by settings page):
```typescript
// In IPC_CHANNELS:
REMOTE_GET_INFO: 'remote:getInfo'

// Handler:
ipcMain.handle(IPC_CHANNELS.REMOTE_GET_INFO, () => ({
  enabled: settings.remoteEnabled,
  url: httpApiServer?.getLanUrl() ?? null,
}))
```

Expose in preload and `electron.d.ts`:
```typescript
remoteGetInfo: () => Promise<{ enabled: boolean; url: string | null }>
```

### 4. `vite.config.web.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/webClient'),
  build: {
    outDir: resolve(__dirname, 'out/webClient'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
```

### 5. `package.json`

```json
"build:web": "vite build --config vite.config.web.ts"
```

---

## Phase 2 — Home + Arctis Pages

### Web client stores

**`src/webClient/src/stores/serviceStore.ts`**

Copy from `src/renderer/src/stores/serviceStore.ts`. Replace:
- `window.api.arctisGetState()` → `get('/api/arctis/state')`
- `window.api.onArctisEvent(cb)` → WS listener for `arctis:event`
- `window.api.onArctisConnected(cb)` / `onArctisDisconnected(cb)` → WS listeners

Remove: `ddcMonitors`, `settings`, `services` (not needed for web client scope).

**`src/webClient/src/api/websocket.ts`**

```typescript
// Singleton WS connection. Dispatches events to registered handlers.
export function useWebSocket(handlers: Record<string, (payload: unknown) => void>): void
// Called once in App.tsx; handlers reference store.setState calls
```

### Arctis page

Import directly from renderer (paths need to resolve correctly via Vite alias or symlink):
```
src/renderer/src/components/arctis/HeadsetCard.tsx
src/renderer/src/components/arctis/AudioOptionsPanel.tsx
src/renderer/src/components/arctis/WirelessAudioPanel.tsx
src/renderer/src/components/arctis/BaseStationPanel.tsx
src/renderer/src/components/arctis/EqPanel.tsx
```

If imports are too tangled (Electron-only imports deep in the tree), copy the components into `src/webClient/src/components/arctis/` and strip any `window.api` references (components should only call store functions, which are the only layer that touches IPC/fetch).

**EQ Panel — mobile responsive CSS:**
```css
@media (max-width: 768px) {
  .eq-panel-faders {
    overflow-x: auto;
    display: flex;
    flex-direction: row;
    gap: 12px;
    padding-bottom: 8px;
  }
  .eq-fader-column {
    min-width: 40px;
    flex-shrink: 0;
  }
}
```

**SliderInput touch targets** — add to `SliderInput.tsx` or web-client override:
```css
@media (pointer: coarse) {
  .slider-thumb {
    width: 20px;
    height: 28px;
  }
}
```

---

## Phase 3 — Sonar Page

**`src/webClient/src/stores/sonarStore.ts`**

Copy from `src/renderer/src/stores/sonarStore.ts`. Replace:
- `window.api.sonarGetState()` → `get('/api/sonar/state')`
- `window.api.sonarSetVolume(...)` → `post('/api/sonar/volume', ...)`
- `window.api.sonarSetMute(...)` → `post('/api/sonar/mute', ...)`
- `window.api.sonarSelectPreset(...)` → `post('/api/sonar/preset', ...)`
- `window.api.onSonarStateChange(cb)` → WS listener for `sonar:stateChange`

Retain all optimistic patching logic (it's pure TypeScript, no Electron deps).

**Sonar channel mixer — mobile layout:**
```css
@media (max-width: 768px) {
  .sonar-channel-mixer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .channel-strip {
    flex-direction: row;
    align-items: center;
    height: 56px;
  }
  /* Slider becomes horizontal */
  .channel-strip .slider-track {
    flex: 1;
  }
}
```

---

## Phase 4 — QR Code Settings Tab

### `src/renderer/src/pages/settings/RemoteAccessSettings.tsx`

```tsx
import QRCode from 'qrcode.react'  // npm install qrcode.react

export function RemoteAccessSettings() {
  const [info, setInfo] = useState<{ enabled: boolean; url: string | null }>()
  const settings = useServiceStore(s => s.settings)

  useEffect(() => {
    window.api.remoteGetInfo().then(setInfo)
  }, [settings.remoteEnabled, settings.remotePort])

  return (
    <div>
      {/* Toggle: remoteEnabled */}
      {/* Number input: remotePort (default 8080) */}
      {info?.url && (
        <>
          <QRCode value={info.url} size={180} />
          <p>{info.url}</p>
        </>
      )}
    </div>
  )
}
```

Wire into settings nav:
1. Add `'remote-access'` to `SettingsTab` union in `src/shared/types.ts`
2. Add `{ id: 'remote-access', label: 'Remote Access' }` to `SETTINGS_NAV` in `SettingsSidebar.tsx`
3. Add `case 'remote-access': return <RemoteAccessSettings />` in `SettingsLayout.tsx`

---

## Mobile App Shell (`src/webClient/src/App.tsx`)

Bottom tab navigation with three tabs:

```
┌──────────────────────────┐
│   [page content]         │
│                          │
│                          │
├──────────────────────────┤
│  🏠 Home  🎧 Arctis  🔊 Sonar │
└──────────────────────────┘
```

- No sidebar, no titlebar
- Connection indicator (dot) in top-right corner
  - Green: WS connected
  - Yellow: reconnecting
  - Red: disconnected
- On disconnect: polling fallback (fetch state every 2s)

---

## Dependencies to Add

```bash
npm install qrcode.react        # QR code rendering (renderer, settings page)
```

`ws` is already in `package.json` — no new server-side deps needed.

---

## CLAUDE.md Update

After implementation, add to CLAUDE.md under **Core Patterns**:

### Remote Web Client
- **Server**: `HttpApiServer` in `src/main/httpApiServer.ts` — HTTP + WS bridge, started when `settings.remoteEnabled`
- **Web client build**: `npm run build:web` → `out/webClient/` (served as static files)
- **State sync**: WS push for real-time events; REST GET for initial state on connect
- **Component sharing**: web client imports from `src/renderer/src/components/` or copies with IPC stripped
- **Settings**: `remoteEnabled` + `remotePort` in `AppSettings`; QR in "Remote Access" settings tab

---

## Phased Build Order

1. **Phase 1** — HTTP server + scaffold: server starts, `http://LAN:8080` loads a blank React page, WS connects
2. **Phase 2** — Home + Arctis: real data, full controls, EQ with horizontal scroll
3. **Phase 3** — Sonar: channel mixer + preset switcher with optimistic updates
4. **Phase 4** — QR settings tab: enable toggle + QR code visible in app

Each phase is independently shippable. Recommend committing after each.

---

## Open Questions (resolved)

| Question | Answer |
|---|---|
| Hosting | Embedded in Electron app |
| Auth | Local network, no auth |
| Arctis scope | Full parity with desktop |
| Component strategy | Reuse + responsive CSS |
| Build command | Separate `npm run build:web` |
| EQ mobile layout | Horizontal scroll |
