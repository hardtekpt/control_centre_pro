# Home Assistant Home Page Card — Implementation Reference

## Feature Summary

Add a customizable Home Assistant card to the Control Centre Pro home page. Users configure which HA entities appear in the card (lights, climate, sensors, scenes, service calls) via the HA plugin ConfigurePage. The card renders inline on the home page as a single card with per-entity interaction rows.

---

## Codebase Context You Need

### Existing HA Infrastructure
- **IPC channels** (`src/shared/types.ts` lines 119–123):
  - `HA_GET_STATE: 'ha:getState'` — renderer → main, returns `HaState`
  - `HA_STATE_CHANGE: 'ha:stateChange'` — main → renderer push
  - `HA_CALL_SERVICE: 'ha:callService'` — renderer → main, payload `HaServiceCall`
  - `HA_TEST_CONNECTION: 'ha:testConnection'` — renderer → main
- **Types** (`src/shared/types.ts` lines 806–830): `HaEntity`, `HaState`, `HaServiceCall`
- **HA Store** (`src/renderer/src/stores/haStore.ts`): `useHaStore` with `haState: HaState | null` and `setHaState`
- **Settings config** (`src/renderer/src/components/plugins/HomeAssistantConfigSection.tsx`): existing save pattern using `useSettingsForm()`, draft/saved state pairs, refs for closures
- **AppSettings** (`src/shared/types.ts` lines 310–387): where to add `haHomeCardEnabled` and `haHomeCardEntities`
- **serviceStore.settings** (`src/renderer/src/stores/serviceStore.ts`): mirrors all AppSettings in renderer — Home.tsx reads from this (e.g., `useServiceStore(s => s.settings.discordShowHomeCard)`)

### Key Patterns to Follow
- **Card component**: `src/renderer/src/components/home/CompactSonarCard.tsx` or `CompactHeadsetCard.tsx` — card shell, header, row layout
- **Slider**: `src/renderer/src/components/SliderInput.tsx` — pass `value` (0–1), `onChange`, optional `onDragStart`/`onDragEnd`
- **Settings form**: `src/renderer/src/contexts/settingsFormContext.tsx` — `useSettingsForm()` hook, draft/saved state + ref pattern for async save handlers
- **Optimistic UI**: `DisplayCard.tsx` — write-lock timestamp pattern to avoid echoed hardware events flipping sliders back
- **Reorderable list**: `src/renderer/src/components/plugins/PresetChipsList.tsx` — up/down arrow buttons, same pattern needed for entity list
- **Home page sections**: `src/renderer/src/pages/Home.tsx` — `HomeSection` wrapper, `showAudio`/`showDisplay` pattern

---

## Files to Create

### 1. `src/renderer/src/components/home/HaHomeCard.tsx`
The home page card. Reads `homeCardEntities` from `useServiceStore(s => s.settings.haHomeCardEntities)` and live state from `useHaStore(s => s.haState)`.

```tsx
// Card shell — follow CompactSonarCard pattern exactly
// Header: glyph "H", title "Home Assistant", status dot
// Body: map over configured entities → EntityRow
// EntityRow dispatches on cfg.type: light | climate | sensor | scene | service_call
```

**Light row controls** (all conditional on entity attributes):
- Toggle: `light.turn_on` / `light.turn_off`
- Brightness: `SliderInput` value = `attrs.brightness / 255`, onChange → `light.turn_on { entity_id, brightness: Math.round(v * 255) }`, use optimistic write-lock + debounce
- Color temp: show if `attrs.color_mode === 'color_temp'` or `attrs.color_temp_kelvin` exists. Slider range: `attrs.min_color_temp_kelvin` → `attrs.max_color_temp_kelvin`. Calls `light.turn_on { entity_id, color_temp_kelvin }`
- Color: show if `attrs.color_mode` in `['hs', 'rgb', 'xy']`. Native `<input type="color">` hidden under colored circle swatch button. Convert hex ↔ `rgb_color: [r,g,b]`. Calls `light.turn_on { entity_id, rgb_color }`
- Effects: show if `attrs.effect_list` is non-empty array. `<select>` with "None" + effect names. Calls `light.turn_on { entity_id, effect }` or clears effect for None

**Climate row**: current temp display + setpoint `SliderInput` (range `attrs.min_temp`–`attrs.max_temp`, step 0.5) → `climate.set_temperature { entity_id, temperature }` + HVAC mode `<select>` → `climate.set_hvac_mode { entity_id, hvac_mode }`

**Sensor row**: display-only. `entity.state` + `attrs.unit_of_measurement`

**Scene row**: [Activate] button → `scene.turn_on { entity_id }`

**Service call row**: [Call] button → `{ domain: cfg.serviceDomain, service: cfg.serviceName }`

### 2. `src/renderer/src/components/plugins/HaEntityPicker.tsx`
An entity selection panel rendered inline (not a portal) in the ConfigurePage.

```tsx
interface Props {
  entities: HaEntity[]
  configured: HaHomeCardEntity[]
  onAdd: (entity: HaHomeCardEntity) => void
  onClose: () => void
}
```

- Search input filtering on `entity_id` and `attributes.friendly_name`
- Group rows by domain prefix: lights, climate, sensor/binary_sensor, scene, others
- Each row: domain label + friendly_name + entity_id (mono, muted) + [Add] button (greyed if already configured)
- "Service Call" section at bottom: inputs for `domain`, `service`, `label` → [Add] button
- Infer `HaHomeCardEntityType` from entity_id prefix:
  ```typescript
  const domain = entity_id.split('.')[0]
  // 'light' → 'light', 'climate' → 'climate', 'scene' → 'scene', else → 'sensor'
  ```

---

## Files to Modify

### 3. `src/shared/types.ts`

After `HaServiceCall` (line ~830), add:
```typescript
export type HaHomeCardEntityType = 'light' | 'climate' | 'sensor' | 'scene' | 'service_call'

export interface HaHomeCardEntity {
  entityId: string           // HA entity_id
  displayName?: string       // user-defined label override
  type: HaHomeCardEntityType
  serviceDomain?: string     // service_call only
  serviceName?: string       // service_call only
}
```

In `AppSettings` after `haToken`:
```typescript
haHomeCardEnabled: boolean
haHomeCardEntities: HaHomeCardEntity[]
```

In `DEFAULT_SETTINGS` after `haToken`:
```typescript
haHomeCardEnabled: false,
haHomeCardEntities: [],
```

### 4. `src/renderer/src/components/plugins/HomeAssistantConfigSection.tsx`

Extend existing component (do NOT break existing URL/token logic):

**Add state:**
```typescript
const [savedHomeCardEnabled, setSavedHomeCardEnabled] = useState(false)
const [draftHomeCardEnabled, setDraftHomeCardEnabled] = useState(false)
const [savedHomeCardEntities, setSavedHomeCardEntities] = useState<HaHomeCardEntity[]>([])
const [draftHomeCardEntities, setDraftHomeCardEntities] = useState<HaHomeCardEntity[]>([])
const [showPicker, setShowPicker] = useState(false)
// refs for async save handler closure:
const draftHomeCardEnabledRef = useRef(false)
const draftHomeCardEntitiesRef = useRef<HaHomeCardEntity[]>([])
```

**Extend settings load** (inside the existing `window.api.getSettings().then` callback):
```typescript
setSavedHomeCardEnabled(s.haHomeCardEnabled ?? false)
setDraftHomeCardEnabled(s.haHomeCardEnabled ?? false)
setSavedHomeCardEntities(s.haHomeCardEntities ?? [])
setDraftHomeCardEntities(s.haHomeCardEntities ?? [])
```

**Extend dirty tracking** (add to existing `setDirty` call):
```typescript
draftHomeCardEnabled !== savedHomeCardEnabled ||
JSON.stringify(draftHomeCardEntities) !== JSON.stringify(savedHomeCardEntities)
```

**Extend save handler** (add to existing `setSettings` call):
```typescript
haHomeCardEnabled: draftHomeCardEnabledRef.current,
haHomeCardEntities: draftHomeCardEntitiesRef.current,
```

**Add "Home Card" `cfg-section` after the "Status" section:**
```tsx
<div className="cfg-section">
  <div className="cfg-section-h">
    <h3>Home Card</h3>
    <span className="desc">Entities shown on the home page dashboard</span>
  </div>

  {/* Enable toggle */}
  <div className="ff">
    <div className="ff-label">
      <div className="ff-label-title">Show on home page</div>
    </div>
    <input type="checkbox" checked={draftHomeCardEnabled}
      onChange={e => { setDraftHomeCardEnabled(e.target.checked); setDirty(true) }} />
  </div>

  {/* Entity list (when enabled) */}
  {draftHomeCardEnabled && (
    <>
      {draftHomeCardEntities.map((cfg, i) => (
        <div key={cfg.entityId + i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Up/down arrows */}
          <button onClick={() => moveEntity(i, 'up')} disabled={i === 0}>↑</button>
          <button onClick={() => moveEntity(i, 'down')} disabled={i === draftHomeCardEntities.length - 1}>↓</button>
          {/* Type badge */}
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 64 }}>
            {cfg.type}
          </span>
          {/* Name */}
          <span style={{ flex: 1, fontSize: 13 }}>
            {cfg.displayName ?? haState?.entities.find(e => e.entity_id === cfg.entityId)?.attributes?.friendly_name ?? cfg.entityId}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {cfg.entityId}
          </span>
          {/* Remove */}
          <button onClick={() => removeEntity(i)}>🗑</button>
        </div>
      ))}

      {/* Add button */}
      <button
        className="btn-ghost"
        onClick={() => setShowPicker(true)}
        disabled={haState?.status !== 'connected'}
        title={haState?.status !== 'connected' ? 'Connect to Home Assistant to browse entities' : undefined}
      >
        + Add entity
      </button>

      {/* Picker */}
      {showPicker && (
        <HaEntityPicker
          entities={haState?.entities ?? []}
          configured={draftHomeCardEntities}
          onAdd={(entity) => {
            setDraftHomeCardEntities(prev => [...prev, entity])
            setDirty(true)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )}
</div>
```

**Entity list helpers** (inside component):
```typescript
const moveEntity = (i: number, dir: 'up' | 'down') => {
  const j = dir === 'up' ? i - 1 : i + 1
  setDraftHomeCardEntities(prev => {
    const next = [...prev]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  setDirty(true)
}
const removeEntity = (i: number) => {
  setDraftHomeCardEntities(prev => prev.filter((_, idx) => idx !== i))
  setDirty(true)
}
```

### 5. `src/renderer/src/pages/Home.tsx`

**Add imports:**
```typescript
import { HaHomeCard } from '../components/home/HaHomeCard'
import { useHaStore } from '../stores/haStore'
```

**Add selectors:**
```typescript
const haHomeCardEnabled  = useServiceStore(s => s.settings.haHomeCardEnabled)
const haHomeCardEntities = useServiceStore(s => s.settings.haHomeCardEntities)
const showHa = haHomeCardEnabled && haHomeCardEntities.length > 0
```

**Add chip:**
```typescript
const HOME_CHIPS: FilterChipDef[] = [
  { id: 'all',        label: 'All' },
  { id: 'audio',      label: 'Audio' },
  { id: 'display',    label: 'Display' },
  { id: 'smart-home', label: 'Smart Home' },
]
```

**Add section** (after the Display section):
```tsx
{showHa && (activeChip === 'all' || activeChip === 'smart-home') && (
  <HomeSection title="Smart Home">
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '12px',
      alignItems: 'start',
    }}>
      <HaHomeCard />
    </div>
  </HomeSection>
)}
```

**Update device count** in `homeSubtitle`:
```typescript
const count = (arctisState ? 1 : 0) + (sonarAvailable ? 1 : 0) + (showDiscord ? 1 : 0) + ddcMonitors.length + (showHa ? 1 : 0)
```

---

## Important Implementation Notes

### No New IPC Channels Needed
All required IPC already exists:
- Entity state: `HA_STATE_CHANGE` push events → `haStore.haState.entities`
- Service calls: `HA_CALL_SERVICE` → `window.api.haCallService(HaServiceCall)`

### Optimistic Light Slider Pattern
Copy the write-lock + debounce pattern from `DisplayCard.tsx`:
```typescript
const writeLock = useRef(0)
const [localValue, setLocalValue] = useState<number | null>(null)

const displayValue = Date.now() - writeLock.current < 1000 ? localValue ?? entityValue : entityValue

const handleChange = (v: number) => {
  setLocalValue(v)
  writeLock.current = Date.now()
  // debounced service call
}
```

### Toggle Styling
Use the existing toggle/checkbox component style. Look at `ConfigurePage.tsx` for the Discord "Show home card" toggle pattern (around line 120) — it directly calls `setSettings` immediately without going through the save form. For the HA home card toggle, use the draft state pattern instead (so it saves with the global Save button).

### Effect Dropdown
Render as a styled `<select>` with `appearance: none` and theme colors:
```tsx
<select
  value={currentEffect ?? 'None'}
  onChange={e => handleEffectChange(e.target.value)}
  style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, padding: '2px 6px' }}
>
  <option value="None">None</option>
  {effectList.map(e => <option key={e} value={e}>{e}</option>)}
</select>
```

### Color Helper
```typescript
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}
```

HA sends `rgb_color: [r, g, b]` in entity attributes when `color_mode === 'rgb'`.

---

## Verification Steps

1. `npm run dev` — app starts without errors
2. Settings → Plugins → Home Assistant → enter URL + token → Save → "Test connection" → connected
3. "Home Card" section appears below Status — toggle "Show on home page" on
4. "Add entity" button is enabled — picker opens and shows searchable HA entities
5. Add a light, a sensor, and a scene → ↑↓ reorder works → Save
6. Navigate to Home — "Smart Home" section appears with the HA card
7. Light toggle works (HA state changes) → brightness slider updates optimistically
8. Color picker changes light color → color swatch updates to reflect new color
9. Scene Activate button triggers the scene in HA
10. `npm run typecheck` passes with no errors
11. Disable the home card toggle → Save → card disappears from home page

---

## Agent Prompt

```
You are implementing the Home Assistant Home Page Card feature for Control Centre Pro, a Windows Electron/React/TypeScript desktop app.

The feature adds:
1. A new "HaHomeCard" component on the home page showing user-configured HA entities
2. Entity configuration UI in the HA plugin's ConfigurePage (entity browser picker + reorderable list)

Read the full implementation reference at agents/HA_HOME_CARD.md before writing any code — it contains all required file paths, code patterns, and the exact data structures to use.

Key constraints:
- Follow the existing card component pattern exactly (see CompactSonarCard.tsx for reference)
- Use SliderInput from components/SliderInput.tsx for all sliders
- Use the draft/saved state + ref pattern from HomeAssistantConfigSection.tsx for settings
- Use the write-lock optimistic pattern from DisplayCard.tsx for light sliders
- No new IPC channels — HA_CALL_SERVICE and HA_STATE_CHANGE already exist
- Use serviceStore.settings.haHomeCardEnabled and haHomeCardEntities in Home.tsx (same as discordShowHomeCard pattern)
- MVP only: no drag-to-reorder (use ↑↓ buttons), no per-entity display name editing inline, no service call params

After implementing, run: npm run typecheck
Then verify the feature works end-to-end per the verification steps in the reference doc.
```
