# UI Performance Optimisation Plan
> Control Centre Pro — generated 2026-05-22

## Goal
Eliminate scroll jank, frame drops, and perceived sluggishness caused by excessive React re-renders and non-composited CSS transitions. No behaviour changes; purely internal optimisation.

---

## Root Causes (Summary)

| # | Problem | Primary files | Why it hurts |
|---|---------|---------------|--------------|
| 1 | Components subscribe to entire Zustand store objects | `Home.tsx`, `GGSonar.tsx`, `ChannelMixer.tsx`, `CompactSonarCard.tsx` | Every ~1 s hardware poll blows up the whole component tree even when nothing visible changed |
| 2 | Channel strip list items not memoized | `ChannelMixer.tsx` | 6 full subtree re-renders per poll even when none of their data changed |
| 3 | `DisplayCard` and `CompactHeadsetCard` not memoized | `Home.tsx` | Same issue for display cards |
| 4 | `favoritePresets.filter()` and `sortedMonitors` computed inline every render | `CompactSonarCard.tsx`, `Home.tsx` | Redundant work on every store update |
| 5 | Notification fill bar animates `width` (layout-triggering) | `notifications.css:128` | Forces browser reflow on every volume OSD notification |
| 6 | `ChannelMixer` passes freshly-created callback functions as props on every render | `ChannelMixer.tsx` | Busts `React.memo` on `ChannelStrip` because handler identity changes |

---

## Phase 1 — Granular Zustand Selectors
**Impact: Highest. Eliminates ~70 % of unnecessary re-renders.**

Zustand re-renders a subscriber only when the **selected value** changes (using shallow-equal comparison by default with the selector form). Switching from whole-object subscriptions to field-level selectors means a `sonarState` poll that only changes a volume value will not touch components that only care about presets, routing, or device lists.

### 1a — `Home.tsx`

**Before:**
```ts
const { arctisState, ddcMonitors, settings } = useServiceStore()
const { sonarState } = useSonarStore()
```

**After:**
```ts
import { useShallow } from 'zustand/react/shallow'

const arctisState  = useServiceStore(s => s.arctisState)
const ddcMonitors  = useServiceStore(s => s.ddcMonitors)
const syncBrightness = useServiceStore(s => s.settings.ddcSyncBrightness)
const sonarAvailable = useSonarStore(s => s.sonarState?.available ?? false)
```

Notes:
- `CompactSonarCard` has no props so it pulls its own state — keep it that way; just remove the `sonarState` subscription from `Home`.
- `CompactHeadsetCard` already receives `state` as a prop from `Home` — keep that pattern; the fix is just making `Home` subscribe only to `arctisState`.
- Remove the `settings` whole-object subscription; `Home` only needs `ddcSyncBrightness`, passed down to `DisplayCard`.
- Wrap `sortedMonitors` in `useMemo`:
  ```ts
  const sortedMonitors = useMemo(
    () => [...ddcMonitors].sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1)),
    [ddcMonitors]
  )
  ```

### 1b — `GGSonar.tsx`

**Before:**
```ts
const { sonarState, setSonarState } = useSonarStore()
```

**Before (usage):**
The page passes `sonarState` into `<ChannelMixer sonarState={sonarState} />`. It also uses `sonarState.available`, `sonarState.mode`, `sonarState.chatMix`.

**After:**
```ts
const sonarState    = useSonarStore(s => s.sonarState)   // still needs full object for ChannelMixer prop
const setSonarState = useSonarStore(s => s.setSonarState) // action — stable reference, no re-render risk
```

The key fix here is splitting the "does sonar exist" check from the full state:
```ts
const sonarAvailable = useSonarStore(s => s.sonarState?.available ?? false)
```
This way anything conditionally rendered on availability (like the unavailable banner) does not cause `ChannelMixer` to re-render.

### 1c — `ChannelMixer.tsx`

**Before:**
```ts
const { activePresetIds, patchClassicVolume, patchRedirection, patchRouting, setActivePreset, visibleChannels } = useSonarStore()
```

**After (with `useShallow` for the action group):**
```ts
import { useShallow } from 'zustand/react/shallow'

const activePresetIds = useSonarStore(s => s.activePresetIds)
const visibleChannels = useSonarStore(s => s.visibleChannels)
const actions = useSonarStore(useShallow(s => ({
  patchClassicVolume: s.patchClassicVolume,
  patchRedirection:   s.patchRedirection,
  patchRouting:       s.patchRouting,
  setActivePreset:    s.setActivePreset,
})))
```

Actions (functions) in Zustand stores are stable references — they never change identity across re-renders. So actually the cleanest approach is to select them individually:
```ts
const patchClassicVolume = useSonarStore(s => s.patchClassicVolume)
const patchRedirection   = useSonarStore(s => s.patchRedirection)
const patchRouting       = useSonarStore(s => s.patchRouting)
const setActivePreset    = useSonarStore(s => s.setActivePreset)
```
This way these selectors always return the same reference and never trigger a re-render.

### 1d — `CompactSonarCard.tsx`

**Before:**
```ts
const { sonarState, activePresetIds, patchClassicVolume, setActivePreset } = useSonarStore()
```

**After:**
```ts
const sonarState         = useSonarStore(s => s.sonarState)
const activePresetIds    = useSonarStore(s => s.activePresetIds)
const patchClassicVolume = useSonarStore(s => s.patchClassicVolume)
const setActivePreset    = useSonarStore(s => s.setActivePreset)
```

The `sonarState` subscription here is unavoidable — the card renders volumes and preset lists. The wins come from Phase 2 memoization keeping child components stable despite that.

---

## Phase 2 — Memoize List Items and Cards
**Impact: High. Prevents subtree re-renders when a parent's store subscription fires but props didn't change.**

### 2a — Wrap `ChannelStrip` calls in `ChannelMixer` with `useCallback` handlers

The existing `ChannelStrip` is already wrapped in `memo()` at the bottom of `ChannelStrip.tsx` — but `memo` is bypassed whenever props change identity. In `ChannelMixer.tsx`, the handlers `handleVolume`, `handleMute`, `handlePresetSelect`, `handleDeviceSelect`, `handleProcessDrop` are recreated fresh on every render.

**Fix:** Wrap every handler with `useCallback`:

```ts
const handleVolume = useCallback((channel: SonarChannel, value: number) => {
  patchClassicVolume(channel, { volume: value })
  window.api.sonarSetVolume(channel, value).catch(console.error)
}, [patchClassicVolume])

const handleMute = useCallback((channel: SonarChannel) => {
  const { volume: _v, muted } = getVolume(channel)  // getVolume reads sonarState
  patchClassicVolume(channel, { muted: !muted })
  window.api.sonarSetMute(channel, !muted).catch(console.error)
}, [patchClassicVolume, sonarState])   // sonarState is a dep because getVolume reads it

const handlePresetSelect = useCallback((channel: SonarChannel, presetId: string) => {
  setActivePreset(channel, presetId)
  window.api.sonarSelectPreset(presetId).catch(console.error)
  const preset = sonarState.configs.find((c) => c.id === presetId)
  notifySonarPresetChange(preset?.name ?? 'Preset')
}, [setActivePreset, sonarState])

const handleDeviceSelect = useCallback((channel: SonarChannel, deviceId: string) => {
  if (channel === 'master') return
  const device = sonarState.audioDevices.find((d) => d.id === deviceId)
  if (device) patchRedirection(channel as SonarDeviceChannel, device)
  window.api.sonarSetRedirection(channel as SonarDeviceChannel, deviceId).catch(console.error)
}, [patchRedirection, sonarState])

const handleProcessDrop = useCallback((targetChannel: SonarChannel, processId: number) => {
  patchRouting(processId, targetChannel)
  window.api.sonarRouteProcess(processId, targetChannel).catch(console.error)
}, [patchRouting])
```

**Note on `getVolume`:** Move `getVolume` and `getStreamerMix` outside the component or convert them to `useMemo` derivations rather than inline functions called inside the render map, so they don't need to be deps of every callback:

```ts
const volumes = useMemo(() => {
  const classic = sonarState.classic
  const map: Record<SonarChannel, { volume: number; muted: boolean }> = {} as any
  for (const def of CHANNEL_DEFS) {
    if (def.channel === 'master') {
      map['master'] = classic?.masters.classic ?? { volume: 1, muted: false }
    } else {
      map[def.channel] = classic?.devices[def.channel as SonarDeviceChannel]?.classic ?? { volume: 1, muted: false }
    }
  }
  return map
}, [sonarState.classic])

const streamerMixes = useMemo(() => {
  const streamer = sonarState.streamer
  const map: Record<SonarChannel, any> = {} as any
  for (const def of CHANNEL_DEFS) {
    if (def.channel === 'master') {
      map['master'] = streamer?.masters.stream
    } else {
      map[def.channel] = streamer?.devices[def.channel as SonarDeviceChannel]?.stream
    }
  }
  return map
}, [sonarState.streamer])
```

Then in the render map:
```tsx
{CHANNEL_DEFS.filter(({ channel }) => visibleChannels.has(channel)).map(({ channel, label }) => (
  <ChannelStrip
    key={channel}
    channel={channel}
    label={label}
    volume={volumes[channel].volume}
    muted={volumes[channel].muted}
    streamerMix={streamerMixes[channel]}
    // ... other stable props
    onVolume={handleVolume}
    onMute={handleMute}
    onPresetSelect={handlePresetSelect}
    onDeviceSelect={handleDeviceSelect}
    onProcessDrop={(processId) => handleProcessDrop(channel, processId)}
  />
))}
```

**Problem with `onProcessDrop`:** The inline arrow `(processId) => handleProcessDrop(channel, processId)` creates a new function per channel per render. Fix with a stable curried handler or pass `channel` as a prop and move the composition into `ChannelStrip` itself (it already receives `channel` as a prop). Update `ChannelStrip`'s `onProcessDrop` signature to `(processId: number) => void` and have `ChannelMixer` pass `useCallback`-wrapped per-channel handlers created in the map step, but stored in a ref-keyed record to be stable:

Simplest correct approach — pass `handleProcessDrop` with full signature `(targetChannel, processId)` unchanged and keep the inline arrow. The inline arrow only busts memo if `ChannelStrip` actually uses `React.memo` with prop comparison — since it does, this is a real issue. Best fix: change `ChannelStrip`'s `onProcessDrop` prop type to `(processId: number) => void`, and in `ChannelMixer` create stable per-channel callbacks using a `useRef` map:

```ts
const dropHandlersRef = useRef<Record<string, (pid: number) => void>>({})
// Rebuild only when patchRouting identity changes (which is never, since it's a Zustand action)
useEffect(() => {
  for (const { channel } of CHANNEL_DEFS) {
    dropHandlersRef.current[channel] = (pid: number) => {
      patchRouting(pid, channel)
      window.api.sonarRouteProcess(pid, channel).catch(console.error)
    }
  }
}, [patchRouting])
```

Then pass `dropHandlersRef.current[channel]` in the map.

### 2b — Memoize `DisplayCard`

`DisplayCard` is currently a plain function component. Wrap it:

```ts
// At the bottom of DisplayCard.tsx
export const DisplayCard = memo(DisplayCardComponent)
```

`DisplayCard` receives `monitor`, `syncBrightness`, `allMonitors` as props. It will only re-render when one of those actually changes — not on every `ddcMonitors` array reference change from the store.

**Important**: For `allMonitors` (the full array passed for sync), if the array reference changes on every poll even when content is the same, `memo` won't help. Consider passing only the monitor IDs needed for sync, or use a stable `useRef` on the array reference in the parent.

### 2c — Memoize `CompactHeadsetCard`

```ts
// At the bottom of CompactHeadsetCard.tsx
export const CompactHeadsetCard = memo(CompactHeadsetCardComponent)
```

`CompactHeadsetCard` receives `state: ArctisState` as a prop. It will only re-render when the arctis state actually changes (hardware events), not on sonar polls.

---

## Phase 3 — Fix Non-Composited CSS Transitions
**Impact: Medium. Eliminates layout reflow on OSD volume notifications.**

### 3a — `notifications.css:128` — Notification fill bar width → scaleX

**File:** `src/renderer/src/components/notifications/notifications.css`

**Before (line ~128):**
```css
.notif-rect.slider .fill {
  transition: width 0.15s ease;
}
```
`width` is a layout property. When it animates, the browser must reflow the element and its siblings on every frame.

**After:**
```css
.notif-rect.slider .track {
  position: relative;
  overflow: hidden;   /* clip the fill */
}

.notif-rect.slider .fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transition: transform 0.15s ease;
  /* width stays 100% always; scale controls visible length */
}
```

And in the component that renders the fill, change the inline style from:
```tsx
style={{ width: `${value * 100}%` }}
```
to:
```tsx
style={{ transform: `scaleX(${value})` }}
```

Locate the notification fill renderer in `src/renderer/src/components/notifications/` — likely `NotificationOSD.tsx` or `NotifItem.tsx`. Find where `width` is set on the slider fill element and replace with `transform: scaleX(value)`.

---

## Phase 4 — Memoize In-Render Computations
**Impact: Low-medium. Eliminates redundant array operations per render cycle.**

### 4a — `CompactSonarCard.tsx` — `favoritePresets` and `activePreset` in `InlinePresetSelector`

**Before (line ~78-79):**
```ts
const favoritePresets = presets.filter((p) => p.isFavorite)
const activePreset = presets.find((p) => p.id === activePresetId)
```

**After:**
```ts
const favoritePresets = useMemo(() => presets.filter((p) => p.isFavorite), [presets])
const activePreset    = useMemo(() => presets.find((p) => p.id === activePresetId), [presets, activePresetId])
```

### 4b — `Home.tsx` — `connectedCount` and `homeSubtitle`

**Before:**
```ts
const connectedCount = (arctisState ? 1 : 0) + (sonarState?.available ? 1 : 0) + ddcMonitors.length
const homeSubtitle = connectedCount === 0 ? 'No devices detected' : `${connectedCount} device${...}`
```

After Phase 1, `Home.tsx` won't hold `sonarState` anymore (only `sonarAvailable`). Wrap in `useMemo`:
```ts
const homeSubtitle = useMemo(() => {
  const count = (arctisState ? 1 : 0) + (sonarAvailable ? 1 : 0) + ddcMonitors.length
  return count === 0 ? 'No devices detected' : `${count} device${count !== 1 ? 's' : ''} connected`
}, [arctisState, sonarAvailable, ddcMonitors.length])
```

---

## Implementation Order

Execute phases in this order — each phase builds on the previous:

1. **Phase 3** first (CSS only, zero risk, instantly verifiable)
2. **Phase 1a** — `Home.tsx` granular selectors + `sortedMonitors` memo
3. **Phase 1c** — `ChannelMixer.tsx` granular selectors
4. **Phase 2a** — `ChannelMixer.tsx` `useCallback` handlers + `volumes`/`streamerMixes` memos
5. **Phase 1b** — `GGSonar.tsx` granular selectors
6. **Phase 1d** — `CompactSonarCard.tsx` granular selectors
7. **Phase 2b** — `DisplayCard` memo
8. **Phase 2c** — `CompactHeadsetCard` memo
9. **Phase 4a** — `InlinePresetSelector` `useMemo` calls
10. **Phase 4b** — `Home.tsx` `homeSubtitle` memo

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/pages/Home.tsx` | Granular selectors (1a), sortedMonitors useMemo, homeSubtitle useMemo (4b) |
| `src/renderer/src/pages/GGSonar.tsx` | Granular selectors (1b) |
| `src/renderer/src/components/gg-sonar/ChannelMixer.tsx` | Granular selectors (1c), useCallback handlers, volumes/streamerMixes useMemo, dropHandlersRef (2a) |
| `src/renderer/src/components/home/CompactSonarCard.tsx` | Granular selectors (1d) |
| `src/renderer/src/components/home/DisplayCard.tsx` | Wrap with React.memo (2b) |
| `src/renderer/src/components/home/CompactHeadsetCard.tsx` | Wrap with React.memo (2c) |
| `src/renderer/src/components/notifications/notifications.css` | width → scaleX transition (3a) |
| `src/renderer/src/components/notifications/` (the OSD component) | Update fill style from width% to scaleX (3a) |
| `src/renderer/src/components/home/CompactSonarCard.tsx` (InlinePresetSelector) | useMemo for favoritePresets/activePreset (4a) |

---

## What NOT to Change

- Do not add scroll virtualisation — lists are small (6 channels, 1-3 monitors, <20 presets). Virtualisation adds complexity without measurable benefit at current data sizes.
- Do not change store structure — the `sonarState` monolith is fine; the fix is smarter subscriptions, not a store redesign.
- Do not add `React.memo` to `ChannelStrip` — it already has it (`memo(ChannelStripComponent)` at the bottom of the file). The bug is that handlers bust it.
- Do not change `SliderInput` or `VerticalFader` — their `getBoundingClientRect` calls are in event handlers (correct placement) and they already suppress poll updates via `beginDrag`/`endDrag`.
