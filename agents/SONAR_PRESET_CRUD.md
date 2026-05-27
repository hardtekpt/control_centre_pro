# GG Sonar — Preset CRUD Feature

## Overview

Implement full preset management for GG Sonar in Control Centre Pro: create, edit, duplicate, delete, reset, and toggle favourite presets — all from a single compact floating panel that opens when the user clicks a channel strip label in the mixer.

---

## Context

### App architecture

- **Electron 31** main process + React 18 renderer, communicating via IPC through a preload bridge (`window.api.*`)
- All IPC channel names are constants in `src/shared/types.ts` (`IPC_CHANNELS`) — never use string literals
- Service methods live in `src/main/services/sonarService.ts`; handlers are wired in `src/main/index.ts` via `ipcMain.handle()`; exposed to the renderer via `src/preload/index.ts`; typed on `Window['api']` in `src/electron.d.ts`
- State management: Zustand store at `src/renderer/src/stores/sonarStore.ts`
- Design system: pure neutral grays, CSS custom properties (`var(--color-bg)`, `var(--color-surface)`, `var(--color-surface-raised)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-accent)`, `var(--color-border)`). Never hardcode hex. Use `SliderInput` from `src/renderer/src/components/SliderInput.tsx` for all sliders (pass `value` 0–1, `onChange`).

### GG Sonar HTTP API

The GG Sonar local REST API is discovered at runtime via `GET https://127.0.0.1:6327/subApps` which returns the dynamic `baseUrl`. All further calls are plain HTTP to that base URL.

**Relevant endpoints for preset CRUD:**

```
GET  /configs                         → SonarConfig[]   (full list)
PUT  /configs                         → SonarConfig     (upsert — create if new id, update if existing)
DELETE /configs/{id}                  → 204 No Content  (delete user preset)
PUT  /configs/{id}/select             → void            (activate preset for its channel)
PUT  /configs/{id}/isFavorite/{bool}  → void            (toggle favourite)
```

**`PUT /configs` upsert rules:**
- Body: full `SonarConfig` JSON object
- If `id` is a UUID the server has never seen: **creates** a new config
- If `id` matches an existing config: **updates** it
- Client provides `id`, `createdAt`, `updatedAt` (ISO 8601 with trailing `Z`)
- For new configs: `createdAt = updatedAt = new Date().toISOString()`
- For updates: only `updatedAt` changes

**`DELETE /configs/{id}`** returns 204 No Content — no response body.

The service already has `httpPutJson(url, body)` and `httpPut(url)` helpers. Add `httpDelete(url)` following the same pattern.

### Config schemas

Two schemas depending on `virtualAudioDevice`:

**schemaVersion 5** — output channels (`game`, `media`, `aux`, `chatRender`):
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
    "filter2":  { "enabled": true, "qFactor": 0.7071, "frequency": 100,   "gain": 0, "type": "peakingEQ" },
    "filter3":  { "enabled": true, "qFactor": 0.7071, "frequency": 200,   "gain": 0, "type": "peakingEQ" },
    "filter4":  { "enabled": true, "qFactor": 0.7071, "frequency": 400,   "gain": 0, "type": "peakingEQ" },
    "filter5":  { "enabled": true, "qFactor": 0.7071, "frequency": 800,   "gain": 0, "type": "peakingEQ" },
    "filter6":  { "enabled": true, "qFactor": 0.7071, "frequency": 1600,  "gain": 0, "type": "peakingEQ" },
    "filter7":  { "enabled": true, "qFactor": 0.7071, "frequency": 3200,  "gain": 0, "type": "peakingEQ" },
    "filter8":  { "enabled": true, "qFactor": 0.7071, "frequency": 6400,  "gain": 0, "type": "peakingEQ" },
    "filter9":  { "enabled": true, "qFactor": 0.7071, "frequency": 12800, "gain": 0, "type": "peakingEQ" },
    "filter10": { "enabled": true, "qFactor": 0.7071, "frequency": 16000, "gain": 0, "type": "peakingEQ" }
  },
  "virtualSurroundState": false,
  "virtualSurroundChannels": {
    "frontLeft":  { "position":  30,  "gain": 0 },
    "frontRight": { "position": -30,  "gain": 0 },
    "center":     { "position":   0,  "gain": 0 },
    "subWoofer":  { "position":   0,  "gain": 0 },
    "rearLeft":   { "position":  150, "gain": 0 },
    "rearRight":  { "position": -150, "gain": 0 },
    "sideLeft":   { "position":  90,  "gain": 0 },
    "sideRight":  { "position": -90,  "gain": 0 }
  },
  "reverbGainDB":     -6,
  "formFactor":       "headphones",
  "globalEnableState": true
}
```

**schemaVersion 6** — mic channel (`chatCapture`):
```json
{
  "noiseReductionState":          { "enabled": true,  "value": 1 },
  "volumeStabilizerState":        { "enabled": false, "value": 0 },
  "noiseGateState":               { "enabled": true,  "value": -38.8 },
  "automaticNoiseGateState":      { "enabled": true,  "value": 0 },
  "impactNoiseReductionState":    { "enabled": false, "value": 0 },
  "noiseCancelingState":          { "enabled": false, "value": 1 },
  "acousticEchoCancelingState":   false,
  "parametricEQ": {
    "enabled": true,
    "filter1":  { "enabled": true, "qFactor": 0.7071, "frequency": 80,   "gain": 0, "type": "lowShelving"  },
    "filter2":  { "enabled": true, "qFactor": 0.7071, "frequency": 200,  "gain": 0, "type": "peakingEQ"   },
    "filter3":  { "enabled": true, "qFactor": 0.7071, "frequency": 400,  "gain": 0, "type": "peakingEQ"   },
    "filter4":  { "enabled": true, "qFactor": 0.7071, "frequency": 800,  "gain": 0, "type": "peakingEQ"   },
    "filter5":  { "enabled": true, "qFactor": 0.7071, "frequency": 1600, "gain": 0, "type": "peakingEQ"   },
    "filter6":  { "enabled": true, "qFactor": 0.7071, "frequency": 3200, "gain": 0, "type": "peakingEQ"   },
    "filter7":  { "enabled": true, "qFactor": 0.7071, "frequency": 6400, "gain": 0, "type": "peakingEQ"   },
    "filter8":  { "enabled": true, "qFactor": 0.7071, "frequency": 8000, "gain": 0, "type": "peakingEQ"   },
    "filter9":  { "enabled": true, "qFactor": 0.7071, "frequency":12000, "gain": 0, "type": "peakingEQ"   },
    "filter10": { "enabled": true, "qFactor": 0.7071, "frequency":16000, "gain": 0, "type": "highShelving" }
  },
  "globalEnableState": true
}
```

**Parameter ranges (from observed SteelSeries presets):**

| Parameter | Min | Max |
|---|---|---|
| bassBoostState.value | 0 | 12 |
| trebleBoostState.value | 0 | 12 |
| voiceClarityState.value | 0 | 12 |
| generalGain | −12 | +12 |
| smartVolume.volumeLevel | 0 | 100 |
| reverbGainDB | −40 | 0 |
| parametricEQ filter gain | −12 | +12 |
| parametricEQ filter qFactor | 0.1 | 10 |
| parametricEQ filter frequency | 20 | 20000 |
| noiseReductionState.value | 0 | 3 |
| noiseGateState.value (dB) | −60 | 0 |
| volumeStabilizerState.value | 0 | 3 |
| impactNoiseReductionState.value | 0 | 3 |
| noiseCancelingState.value | 0 | 3 |
| virtualSurroundChannels position | −180 | +180 |
| virtualSurroundChannels gain | −12 | +12 |

---

## Key files to read before implementing

| File | What to look for |
|---|---|
| `src/shared/types.ts` | `SonarConfigData`, `SonarConfig`, `SonarMode`, `IPC_CHANNELS` — all need changes |
| `src/main/services/sonarService.ts` | existing `httpPutJson`, `httpPut`, `scheduleRefresh`, `selectPreset` — model new methods on these |
| `src/main/index.ts` | find the sonar `ipcMain.handle` block and add new ones in the same pattern |
| `src/preload/index.ts` | find the `sonar*` entries in the contextBridge — add new ones in the same pattern |
| `src/electron.d.ts` | find `Window['api']` sonar entries — add signatures |
| `src/renderer/src/stores/sonarStore.ts` | existing `setSonarState`, `patchClassicVolume` patterns — model optimistic config methods on these |
| `src/renderer/src/features/sonar/components/ChannelStrip.tsx` | current header structure (`.sn-strip-head`) and props shape |
| `src/renderer/src/features/sonar/components/ChannelMixer.tsx` | how `ChannelStrip` is rendered; add `editingChannel` state here |
| `src/renderer/src/components/gg-sonar/PresetEditor.tsx` | current read-only panel — full rewrite target |
| `src/renderer/src/components/SliderInput.tsx` | canonical slider — use this for all sliders in the edit form |
| `src/renderer/src/features/sonar/components/PresetSelector.tsx` | portal dropdown pattern — reuse this approach for the in-panel preset dropdown |
| `src/renderer/src/features/sonar/sonar.css` | existing CSS class names (`.sn-strip-head`, `.sn-strip-name`, etc.) |

---

## Phase 1 — Backend

### 1.1 Fix TypeScript types (`src/shared/types.ts`)

**Add new interfaces** before `SonarConfigData`:

```ts
export interface SonarEQFilter {
  enabled: boolean
  qFactor: number
  frequency: number
  gain: number
  type: 'peakingEQ' | 'lowShelving' | 'highShelving'
}

export interface SonarParametricEQ {
  enabled: boolean
  filter1: SonarEQFilter;  filter2: SonarEQFilter;  filter3: SonarEQFilter
  filter4: SonarEQFilter;  filter5: SonarEQFilter;  filter6: SonarEQFilter
  filter7: SonarEQFilter;  filter8: SonarEQFilter;  filter9: SonarEQFilter
  filter10: SonarEQFilter
}

export interface SonarVirtualSurroundChannels {
  frontLeft:  { position: number; gain: number }
  frontRight: { position: number; gain: number }
  center:     { position: number; gain: number }
  subWoofer:  { position: number; gain: number }
  rearLeft:   { position: number; gain: number }
  rearRight:  { position: number; gain: number }
  sideLeft:   { position: number; gain: number }
  sideRight:  { position: number; gain: number }
}
```

**Replace `SonarConfigData`** (currently at ~line 616):

```ts
export interface SonarConfigData {
  // Output channels (game, media, aux, chatRender) — schemaVersion 5
  bassBoostState?:    { enabled: boolean; value: number }
  trebleBoostState?:  { enabled: boolean; value: number }
  voiceClarityState?: { enabled: boolean; value: number }
  smartVolume?:       { enabled: boolean; volumeLevel: number; loudness: string }
  generalGain?:       number
  parametricEQ?:      SonarParametricEQ
  virtualSurroundState?:    boolean
  virtualSurroundChannels?: SonarVirtualSurroundChannels
  reverbGainDB?:  number
  formFactor?:    string
  // Mic channel (chatCapture) — schemaVersion 6
  noiseReductionState?:        { enabled: boolean; value: number }
  volumeStabilizerState?:      { enabled: boolean; value: number }
  noiseGateState?:             { enabled: boolean; value: number }
  automaticNoiseGateState?:    { enabled: boolean; value: number }
  impactNoiseReductionState?:  { enabled: boolean; value: number }
  noiseCancelingState?:        { enabled: boolean; value: number }
  acousticEchoCancelingState?: boolean
  // Common
  globalEnableState?: boolean
}
```

**Extend `SonarConfig`** (currently at ~line 638) — add three fields:

```ts
  defaultData?:    SonarConfigData   // built-in presets carry original data for reset
  schemaVersion?:  number
  releaseVersion?: string | null
```

**Fix `SonarMode`** — change `'classic' | 'streamer'` to `'classic' | 'stream'`

**Add IPC channels** — inside the `IPC_CHANNELS` object under the existing sonar block:

```ts
SONAR_UPSERT_CONFIG:    'sonar:upsertConfig',     // renderer → main: SonarConfig → SonarConfig
SONAR_DELETE_CONFIG:    'sonar:deleteConfig',     // renderer → main: id → void
SONAR_DUPLICATE_CONFIG: 'sonar:duplicateConfig',  // renderer → main: sourceId → SonarConfig
SONAR_RESET_CONFIG:     'sonar:resetConfig',      // renderer → main: id → SonarConfig
SONAR_TOGGLE_FAVORITE:  'sonar:toggleFavorite',   // renderer → main: (id, bool) → void
```

---

### 1.2 Add service methods (`src/main/services/sonarService.ts`)

Add a private `httpDelete` helper after `httpPutJson`:

```ts
private httpDelete(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: parsed.pathname + parsed.search,
      method: 'DELETE',
      headers: { 'Content-Length': '0' },
    }
    const req = http.request(options, (res) => {
      res.resume()
      res.on('end', () => resolve())
    })
    req.on('error', reject)
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}
```

Add five public methods (import `crypto.randomUUID` at the top — use `import { randomUUID } from 'crypto'`):

```ts
async upsertConfig(config: SonarConfig): Promise<SonarConfig> {
  if (!this.baseUrl) throw new Error('Sonar not available')
  const raw = await this.httpPutJson(`${this.baseUrl}/configs`, JSON.stringify(config))
  this.scheduleRefresh()
  return JSON.parse(raw) as SonarConfig
}

async deleteConfig(id: string): Promise<void> {
  if (!this.baseUrl) throw new Error('Sonar not available')
  await this.httpDelete(`${this.baseUrl}/configs/${id}`)
  this.scheduleRefresh()
}

async duplicateConfig(sourceId: string): Promise<SonarConfig> {
  if (!this.baseUrl) throw new Error('Sonar not available')
  const source = this.state.configs.find((c) => c.id === sourceId)
  if (!source) throw new Error(`Config ${sourceId} not found`)
  const now = new Date().toISOString()
  const copy: SonarConfig = {
    ...source,
    id: randomUUID(),
    name: `${source.name} Copy`,
    isPreset: false,
    createdAt: now,
    updatedAt: now,
  }
  return this.upsertConfig(copy)
}

async resetConfig(id: string): Promise<SonarConfig> {
  if (!this.baseUrl) throw new Error('Sonar not available')
  const config = this.state.configs.find((c) => c.id === id)
  if (!config) throw new Error(`Config ${id} not found`)
  if (!config.defaultData) throw new Error('No defaultData to reset to')
  const reset: SonarConfig = {
    ...config,
    data: config.defaultData,
    updatedAt: new Date().toISOString(),
  }
  return this.upsertConfig(reset)
}

async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  if (!this.baseUrl) throw new Error('Sonar not available')
  await this.httpPut(`${this.baseUrl}/configs/${id}/isFavorite/${isFavorite}`)
  this.scheduleRefresh()
}
```

---

### 1.3 Wire IPC handlers (`src/main/index.ts`)

Find the sonar `ipcMain.handle` block. Add after the existing entries:

```ts
ipcMain.handle(IPC_CHANNELS.SONAR_UPSERT_CONFIG,    (_, config) => sonarService.upsertConfig(config))
ipcMain.handle(IPC_CHANNELS.SONAR_DELETE_CONFIG,    (_, id) => sonarService.deleteConfig(id))
ipcMain.handle(IPC_CHANNELS.SONAR_DUPLICATE_CONFIG, (_, sourceId) => sonarService.duplicateConfig(sourceId))
ipcMain.handle(IPC_CHANNELS.SONAR_RESET_CONFIG,     (_, id) => sonarService.resetConfig(id))
ipcMain.handle(IPC_CHANNELS.SONAR_TOGGLE_FAVORITE,  (_, id, isFavorite) => sonarService.toggleFavorite(id, isFavorite))
```

---

### 1.4 Expose via preload bridge (`src/preload/index.ts`)

Add to the sonar section in the `contextBridge.exposeInMainWorld` call:

```ts
sonarUpsertConfig:    (config: SonarConfig): Promise<SonarConfig> =>
  ipcRenderer.invoke(IPC_CHANNELS.SONAR_UPSERT_CONFIG, config),
sonarDeleteConfig:    (id: string): Promise<void> =>
  ipcRenderer.invoke(IPC_CHANNELS.SONAR_DELETE_CONFIG, id),
sonarDuplicateConfig: (sourceId: string): Promise<SonarConfig> =>
  ipcRenderer.invoke(IPC_CHANNELS.SONAR_DUPLICATE_CONFIG, sourceId),
sonarResetConfig:     (id: string): Promise<SonarConfig> =>
  ipcRenderer.invoke(IPC_CHANNELS.SONAR_RESET_CONFIG, id),
sonarToggleFavorite:  (id: string, isFavorite: boolean): Promise<void> =>
  ipcRenderer.invoke(IPC_CHANNELS.SONAR_TOGGLE_FAVORITE, id, isFavorite),
```

---

### 1.5 Declare on `Window['api']` (`src/electron.d.ts`)

Add matching signatures to the `api` interface alongside the existing sonar entries:

```ts
sonarUpsertConfig:    (config: SonarConfig) => Promise<SonarConfig>
sonarDeleteConfig:    (id: string) => Promise<void>
sonarDuplicateConfig: (sourceId: string) => Promise<SonarConfig>
sonarResetConfig:     (id: string) => Promise<SonarConfig>
sonarToggleFavorite:  (id: string, isFavorite: boolean) => Promise<void>
```

---

### 1.6 Add optimistic store methods (`src/renderer/src/stores/sonarStore.ts`)

Add to `SonarStoreState` interface:

```ts
upsertConfigOptimistic: (config: SonarConfig) => void
deleteConfigOptimistic: (id: string) => void
```

Add implementations inside the `create` call, modelled on `patchClassicVolume`:

```ts
upsertConfigOptimistic: (config) =>
  set((s) => {
    if (!s.sonarState) return s
    const idx = s.sonarState.configs.findIndex((c) => c.id === config.id)
    const configs = idx >= 0
      ? s.sonarState.configs.map((c, i) => i === idx ? config : c)
      : [...s.sonarState.configs, config]
    return { sonarState: { ...s.sonarState, configs } }
  }),

deleteConfigOptimistic: (id) =>
  set((s) => {
    if (!s.sonarState) return s
    return { sonarState: { ...s.sonarState, configs: s.sonarState.configs.filter((c) => c.id !== id) } }
  }),
```

---

## Phase 2 — UI

### 2.1 Make channel header clickable (`src/renderer/src/features/sonar/components/ChannelStrip.tsx`)

Add to `ChannelStripProps`:
```ts
onOpenEditor: () => void
```

Make the `.sn-strip-head` div trigger it. Replace the existing static header div with a button or add `onClick` and `cursor: pointer` — keep the visual identical. Minimal change:

```tsx
<div
  className="sn-strip-head"
  style={{ cursor: 'pointer' }}
  onClick={onOpenEditor}
  title="Manage presets"
>
  ...existing content unchanged...
</div>
```

---

### 2.2 Own editor state in `ChannelMixer` (`src/renderer/src/features/sonar/components/ChannelMixer.tsx`)

Add state and pull store methods:
```ts
const [editingChannel, setEditingChannel] = useState<SonarDeviceChannel | null>(null)
const upsertConfigOptimistic = useSonarStore((s) => s.upsertConfigOptimistic)
const deleteConfigOptimistic = useSonarStore((s) => s.deleteConfigOptimistic)
```

Pass `onOpenEditor` to each `ChannelStrip`:
```tsx
onOpenEditor={() => setEditingChannel(channel as SonarDeviceChannel)}
```

Render the `PresetEditor` panel as a React portal at the end of the `ChannelMixer` return, when `editingChannel` is set:

```tsx
{editingChannel && ReactDOM.createPortal(
  <PresetEditor
    channel={editingChannel}
    configs={sonarState.configs}
    activePresetId={activePresetIds[editingChannel]}
    onClose={() => setEditingChannel(null)}
    onPresetSelect={(configId) => handlePresetSelect(editingChannel, configId)}
    onUpsert={async (config) => {
      upsertConfigOptimistic(config)
      await window.api.sonarUpsertConfig(config)
    }}
    onDelete={async (id) => {
      deleteConfigOptimistic(id)
      await window.api.sonarDeleteConfig(id)
    }}
    onDuplicate={(sourceId) => window.api.sonarDuplicateConfig(sourceId).then(upsertConfigOptimistic)}
    onReset={(id) => window.api.sonarResetConfig(id).then(upsertConfigOptimistic)}
    onToggleFavorite={(id, fav) => window.api.sonarToggleFavorite(id, fav)}
  />,
  document.body,
)}
```

---

### 2.3 Rewrite `PresetEditor.tsx` (`src/renderer/src/components/gg-sonar/PresetEditor.tsx`)

Full rewrite. The panel is a fixed right-edge panel, 360px wide, z-index 50.

**Props:**
```ts
interface PresetEditorProps {
  channel: SonarDeviceChannel
  configs: SonarConfig[]
  activePresetId: string | undefined
  onClose: () => void
  onPresetSelect: (configId: string) => void
  onUpsert: (config: SonarConfig) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (sourceId: string) => Promise<void>
  onReset: (id: string) => Promise<void>
  onToggleFavorite: (id: string, fav: boolean) => Promise<void>
}
```

**Local state:**
- `mode: 'view' | 'edit'` — default `'view'`
- `draft: SonarConfig | null` — the config being edited (clone of active config or blank for new)
- `dropdownOpen: boolean`

**Panel layout (top to bottom, all flex-col, height 100%):**

1. **Header** (`flex-shrink-0`, border-bottom):
   - Left: channel label (e.g., `"Game"`) — `text-sm font-semibold`
   - Right: ★ favourite button (acts on active preset — filled star if `activeConfig.isFavorite`) + ✕ close button
   - Both buttons: 22×22px, `var(--color-surface-raised)` background, `var(--color-border)` border

2. **Preset dropdown row** (`flex-shrink-0`, border-bottom):
   - Full-width button showing active preset name + chevron; opens a portal dropdown listing all configs for this channel
   - Dropdown rows: preset name (bold if active, ✓ check, ★ if favourite) + on-hover action buttons `[Dup]` `[Reset]` `[Del]`
   - Reset and Del hidden for `isPreset === true` (built-in presets)
   - Clicking a name: calls `onPresetSelect(id)` + closes dropdown
   - Footer of dropdown: `+ New Preset` button
   - Portal positioning: use the same `getBoundingClientRect()` pattern as the existing `PresetSelector.tsx`

3. **Mode bar** (`flex-shrink-0`, visible in view mode only):
   - Shows active preset name as subtitle
   - `[Edit]` button right-aligned — enters edit mode and populates `draft` from active config
   - If `isPreset === true` on active config: show a small notice `"Built-in — editing creates a copy"`

4. **Scrollable body** (`flex-1 overflow-y-auto`):
   - View mode: render read-only sections (keep the existing `Section`/`DataRow`/`EnabledBadge` primitives but show actual `value` fields)
   - Edit mode: render `OutputEditForm` or `VoiceEditForm` depending on channel

5. **Footer** (`flex-shrink-0`, border-top, visible in edit mode only):
   - `[Save]` + `[Cancel]` buttons; Save calls `onUpsert(draft)` then resets to view mode

---

### 2.4 `OutputEditForm` — schemaVersion 5 (output channels)

Used for `game`, `media`, `aux`, `chatRender`. Props: `draft: SonarConfigData`, `onChange: (patch: Partial<SonarConfigData>) => void`.

Sections are always rendered (not collapsible). Use the existing `Section`/`DataRow` wrapper primitives for consistent chrome.

**Processing section:**
- Toggle row: `Global Enable` — `draft.globalEnableState`

**Volume Boost section** (no section-level toggle — individual):
- Toggle + conditional slider row for Bass Boost (`bassBoostState.enabled` / `value`, range 0–12)
- Toggle + conditional slider row for Treble Boost
- Toggle + conditional slider row for Voice Clarity
- Number row: General Gain (`generalGain`, range −12–+12 dB) — always shown

Toggle + slider inline pattern:
```
Bass Boost    [toggle]    ────●─── 6
```
The slider is only shown when the toggle is on. Use `SliderInput` with `value={data.value / 12}` and `onChange={(v) => onChange({ bassBoostState: { ...data.bassBoostState, value: Math.round(v * 12) } })}`

**Smart Volume section** — section toggle is `smartVolume.enabled`:
- When enabled: Loudness `<select>` (soft / balanced / loud) + Volume Level slider (0–100)

**Spatial Audio section** — section toggle is `virtualSurroundState` (boolean):
- Always show: Form Factor `<select>` (headphones / speakers); Reverb Gain slider (−40–0 dB, normalize: `(value + 40) / 40`)
- When `virtualSurroundState` is true: show 8-channel table (`frontLeft`, `frontRight`, `center`, `subWoofer`, `rearLeft`, `rearRight`, `sideLeft`, `sideRight`) with position (−180–+180) and gain (−12–+12) inputs per channel — use `<input type="number">` styled with `var(--color-surface-raised)` background

**Parametric EQ section** — section toggle is `parametricEQ.enabled`:
- 10-row table (always rendered even when EQ off):
  - Per row: enabled checkbox, type `<select>` (peakingEQ / lowShelving / highShelving), frequency `<input type="number">` (20–20000 Hz), gain slider (−12–+12 dB), Q `<input type="number">` (0.1–10, step 0.01)

---

### 2.5 `VoiceEditForm` — schemaVersion 6 (chatCapture)

Props same as `OutputEditForm`.

**Processing section:** `globalEnableState` toggle.

**Noise Processing section** (no section toggle):
- `noiseReductionState`: toggle + slider (0–3, normalize: `value / 3`)
- `noiseGateState`: toggle + slider (−60–0 dB, normalize: `(value + 60) / 60`)
- `volumeStabilizerState`: toggle + slider (0–3)
- `impactNoiseReductionState`: toggle + slider (0–3)
- `noiseCancelingState`: toggle + slider (0–3)
- `automaticNoiseGateState`: toggle only (no slider)
- `acousticEchoCancelingState`: toggle only (boolean field)

**Parametric EQ section:** same 10-row table as `OutputEditForm`.

---

### 2.6 New Preset flow

When `+ New Preset` is clicked in the dropdown:
1. Close dropdown, switch to edit mode
2. Build a blank `draft` from the `DEFAULT_OUTPUT_CONFIG` or `DEFAULT_MIC_CONFIG` constants (flat data with all toggles off, EQ flat — define as module-level constants in `PresetEditor.tsx`)
3. Generate a new UUID: `import { randomUUID } from 'crypto'` is not available in renderer — instead use `crypto.randomUUID()` (Web Crypto API, available in Electron renderer)
4. `draft.name` defaults to `"New Preset"` — the name field is an `<input>` at the top of the edit form
5. On Save: `onUpsert(draft)` where `draft.isPreset = false`, `draft.createdAt = draft.updatedAt = new Date().toISOString()`

When Edit is clicked for a built-in preset (`isPreset === true`):
- Clone the config with a new UUID and name `"{name} Copy"` — Save creates a new preset, not an update
- Show the notice `"Built-in preset — saving will create your own copy"`

---

## Toggle control pattern (reusable inside PresetEditor)

Use a consistent small toggle throughout the edit form. Implement as an inline component in `PresetEditor.tsx`:

```tsx
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0,
        background: value ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 12 : 2,
        width: 10, height: 10, borderRadius: '50%',
        background: value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
        transition: 'left 0.15s',
      }} />
    </button>
  )
}
```

---

## File change summary

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `SonarEQFilter`, `SonarParametricEQ`, `SonarVirtualSurroundChannels`; replace `SonarConfigData`; extend `SonarConfig`; fix `SonarMode`; add 5 IPC channels |
| `src/main/services/sonarService.ts` | Add `upsertConfig`, `deleteConfig`, `duplicateConfig`, `resetConfig`, `toggleFavorite`, `httpDelete` |
| `src/main/index.ts` | Add 5 `ipcMain.handle` registrations |
| `src/preload/index.ts` | Add 5 `contextBridge` methods |
| `src/electron.d.ts` | Add 5 method signatures on `Window['api']` |
| `src/renderer/src/stores/sonarStore.ts` | Add `upsertConfigOptimistic`, `deleteConfigOptimistic` |
| `src/renderer/src/features/sonar/components/ChannelStrip.tsx` | Add `onOpenEditor` prop, make header clickable |
| `src/renderer/src/features/sonar/components/ChannelMixer.tsx` | Own `editingChannel` state, render `PresetEditor` portal |
| `src/renderer/src/components/gg-sonar/PresetEditor.tsx` | Full rewrite: preset dropdown, favourite button, `OutputEditForm`, `VoiceEditForm`, Toggle component |

Do **not** change `GGSonar.tsx` — the panel is fully owned by `ChannelMixer`.

---

## Agent prompt

See below.
