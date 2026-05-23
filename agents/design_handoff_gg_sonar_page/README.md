# Handoff: GG Sonar Page

> A redesigned **Sonar** page for **Mission Control** (Control Centre Pro).
> Per-app audio mixing with vertical faders, drag-and-drop app routing,
> per-channel output device selection, manual EQ presets, and an
> auto-preset rule engine that switches the active preset based on the
> foreground app.

---

## About the Design Files

Files under `reference/` are **design references**, not production code.
They are React + inline JSX prototypes (`<script type="text/babel">`)
that exist to nail down the look, layout, and behaviour. **Do not copy
them verbatim.** Recreate the same visuals and interactions inside the
existing `control_centre_pro` codebase using its established conventions:

- **TypeScript strict** — no `any`, no implicit JSX
- **React 18 functional components**
- **Tailwind for layout/spacing; CSS custom properties for all colours**
  (never hardcode hex — match the existing `--color-*` token set)
- **Zustand** for state (mirrors the existing `appStore` / `serviceStore`)
- **`contextBridge` + `IPC_CHANNELS` constants** — never raw IPC strings
- For audio: defer to whatever audio engine adapter already exists in
  the main process (`audioService` / `sonarBridge`); the renderer only
  reflects state and dispatches commands

The prototype uses raw HTML5 drag-and-drop. Inside the app, prefer a
small abstraction so the same code can later be swapped for `@dnd-kit/`
core if richer behaviour is needed (e.g. drop-cancel, accessibility).

---

## Fidelity

**High-fidelity.** Exact tokens, sizes, shapes, dropdown chrome, fader
geometry, peak-meter zones, popover behaviour, and rule-list interactions
are all spelled out below. Visual truth lives in
`reference/GG Sonar.html` — open it and inspect when in doubt.

---

## Where it lives

| | |
|---|---|
| Sidebar entry | "Sonar" — same icon (`SnWave`) already used in `reference/gg-sonar-icons.jsx` |
| Route id | `sonar` (already exists; this redesign replaces the page body) |
| Page component | `src/renderer/src/pages/Sonar.tsx` (replace existing) |
| Settings tab? | No — top-level page |
| Sidebar count badge | total channel count (always 6: 5 channels + master) |

The sidebar entry stays where it is in the existing nav; the page body
is the part that changes.

---

## Page Layout

```
┌─ App Window (height ~980px) ──────────────────────────────────────────┐
│ [Sidebar 220px]│ ┌─ Header ───────────────────────────────────────┐  │
│                │ │ Sonar                  [search] [Preset details]│  │
│                │ │ 4/5 live · preset game · AUTO    [Save preset] │  │
│                │ ├─ Preset chips ─────────────────────────────────┤  │
│                │ │ [Music] [Game●] [Studio] [Cinema] [Speech] [Flat]│ │
│                │ ├─ Output strip ─────────────────────────────────┤  │
│                │ │ 🎧 Arctis Nova Pro     L━━━━  -7.2 dB · master │  │
│                │ │   usb · 48k · …        R━━━━                    │  │
│                │ ├─ Mixer rail (all 6 strips, full width) ────────┤  │
│                │ │                                                  │ │
│                │ │  [G]    [C]    [M]    [A]    [Mi]   ║   [Ma]   │ │
│                │ │  apps   apps   apps   apps   input  ║   sum    │ │
│                │ │  ▮▮▮    ▮▮     ▮▮▮   ▮▮     ARCTIS  ║   SUM    │ │
│                │ │  fader  fader  fader  fader  fader  ║   fader  │ │
│                │ │  meter  meter  meter  meter  meter  ║   meter  │ │
│                │ │  -8.8   -15.2  -18.4  -26.0  -12.0  ║   -7.2   │ │
│                │ │  M S    M S    M S    M S    M S    ║   M      │ │
│                │ │  →Arctis →Arctis →Arctis →Arctis →Stream ║ →Arctis│ │
│                │ ├─ Auto preset section ──────────────────────────┤  │
│                │ │ ⚡ Auto preset · 5 rules           AUTO ON [O] │  │
│                │ │ ┌ NOW ACTIVE ──┐ ┌ RULES (2-col grid) ─────┐  │  │
│                │ │ │ [CS] CS:GO   │ │ CS:GO → Game │ Apex →Game│  │ │
│                │ │ │ APPLIED Game │ │ Spotify→Music│ YT  →Cine │  │ │
│                │ │ │ via rule     │ │ Discord→Speech│ + Add rule│  │ │
│                │ │ └──────────────┘ └──────────────────────────┘  │  │
│                │ └─────────────────────────────────────────────────┘  │
│                │     ↑ Floating PresetDetailsPopover                  │
│                │       opens from the "Preset details" button         │
└──────────────────────────────────────────────────────────────────────┘
```

### Section breakdown

1. **Header** — page title (`Sonar`), one-line status (`N/M live ·
   preset X · AUTO`), search input, "Preset details" toggle, "Save
   preset" primary button.
2. **Preset chips** — row of 6 selectable EQ presets. The currently
   matched-by-rule preset shows a small green dot in its top-right.
   Clicking a chip applies it manually (and pauses auto).
3. **Output strip** — slim band showing the master output device,
   L/R peak meters, and the master headroom number. Acts as a "where
   sound goes" reminder.
4. **Mixer rail** — 5 channel strips (Game / Chat / Media / Aux / Mic)
   + Master separated by a 1px divider. Each strip is self-contained.
5. **Auto Preset section** — horizontal panel below the mixer with
   titlebar, AUTO toggle, "Now active" card and rules grid.
6. **Floating Preset Details popover** — opened on demand from the
   header button. Overlays the page; not modal.

Source for the whole composition: `gg-sonar-app.jsx#SonarPage` (line 273).

---

## Data Model

All catalogues live in `reference/gg-sonar-data.jsx`. Mirror the shapes
in `shared/types.ts` (TypeScript) and the initial state in
`appStore`/`sonarStore`.

### Channel

```ts
type ChannelId = 'game' | 'chat' | 'media' | 'aux' | 'mic' | 'master';

interface Channel {
  id:        ChannelId;
  label:     string;      // 'Game', 'Chat', …
  Icon:      ComponentType<{size?: number}>;
  takesApps: boolean;     // false for mic & master
}
```

Five output channels + master. `takesApps` controls whether the strip
shows an app-drop zone. `master` is rendered by `MasterStrip`, not
`ChannelStrip`. Source: `gg-sonar-data.jsx` lines 5–11.

### Preset

```ts
type PresetId = 'music' | 'game' | 'studio' | 'cinema' | 'speech' | 'flat';

interface Preset {
  id:    PresetId;
  label: string;
  Icon:  ComponentType<{size?: number}>;
  sub:   string;          // 'wide · positional', 'studio master', …
}
```

Six EQ presets. Source: `gg-sonar-data.jsx` lines 13–20.

### Per-preset EQ data

```ts
const PRESET_EQ: Record<PresetId, number[]>;       // 10 bands, 0..1 linear
const PRESET_BANDS = ['60','120','250','500','1k','2k','4k','8k','12k','16k'];
const PRESET_DESC: Record<PresetId, string>;       // description paragraph
const PRESET_PROPS: Record<PresetId, {
  spatial:   string;     // 'Stereo' | 'Surround' | 'Mono-fold'
  surround:  string;     // 'Off' | 'DTS Headphone:X 2.0'
  bassBoost: string;     // '+3 dB'
  dynamics:  string;     // 'Wide' | 'Compressed' | 'Linear'
  headroom:  string;     // '-6 dB peak'
  use:       string[];   // ['fps','positional cues','footsteps']
}>;
```

The EQ value scale is **0..1 linear**; convert to a dB readout in
±12 dB range via `bandDbFor(v) = (v - 0.5) * 24`. Sources:
`gg-sonar-data.jsx` lines 22–89, helper at lines 105–110 + 134.

### App

```ts
interface App {
  id:       string;       // 'cs2', 'discord', …
  name:     string;
  monogram: string;       // 2 chars, always uppercase
  accent:   string;       // muted brand-adjacent hex (no logos)
}
```

10 starter apps in the catalogue. The visual representation is always a
monogram tile (never a brand logo) — see "Brand safety" below. Source:
`gg-sonar-data.jsx` lines 92–104.

### Output device

```ts
interface OutputDevice {
  id:   string;
  name: string;            // 'Arctis Nova Pro'
  sub:  string;            // 'usb · 48k · headphones'
  Icon: ComponentType<{size?: number}>;
}
```

Four starter devices. In the real app this list is dynamic — the
audio engine populates it. Source: `gg-sonar-data.jsx` lines 107–113.

### Mixer state

```ts
interface MixerLevel {
  level: number;           // 0..100 (fader position)
  muted: boolean;
  peak:  number;           // 0..100, animated by audio engine
}

interface SonarState {
  // Per-channel level + mute + peak
  levels:        Record<ChannelId, MixerLevel>;
  // Each app -> the channel it is routed to
  assignments:   Record<string /*appId*/, ChannelId>;
  // Each channel -> the output device id
  outputs:       Record<ChannelId, string>;
  masterOutput:  string;
  // Preset selection
  manualPreset:  PresetId;
  // Auto preset rule engine
  autoPilot:     boolean;
  rules:         AutoRule[];
  activeAppId:   string;    // foreground app id (set by OS hook)
}

interface AutoRule {
  id:     string;
  appId:  string;
  preset: PresetId;
}
```

Effective preset:
```ts
const matchedRule = rules.find(r => r.appId === activeAppId);
const effectivePreset = autoPilot && matchedRule ? matchedRule.preset : manualPreset;
```

The header status badge reads `AUTO` when `autoPilot && matchedRule`,
omitted otherwise. The matched rule highlights green in the rules list.

---

## Design Tokens

All values come from the existing Mission Control token set (same as
Shortcuts and Plugins). The prototype redefines them inline in the
`<style>` block at `GG Sonar.html` lines 11–62 for portability; in the
real app, **use the existing `--color-*` variables** from the global
stylesheet.

### Color tokens (already exist in the codebase)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-bg`             | `#F5F5F5` | `#1C1C1C` | Page + window background, fader track interior |
| `--color-surface`        | `#EBEBEB` | `#252525` | Sidebar, header, strip body, output strip |
| `--color-surface-raised` | `#E3E3E3` | `#2C2C2C` | Master strip, popover, focused strip, raised cells |
| `--color-text-primary`   | `#141414` | `#EBEBEB` | Headings, fader thumb, primary button bg |
| `--color-text-secondary` | `#8C8C8C` | `#888888` | Sub-labels, sub-text |
| `--color-text-tertiary`  | `#B0B0B0` | `#5a5a5a` | Hints, tick marks, very low-contrast text |
| `--color-border`         | `#D8D8D8` | `#353535` | Default border, divider |
| `--color-border-strong`  | `#C8C8C8` | `#454545` | Hover border, focused state, popover edge |
| `--color-row-hover`      | `rgba(20,20,20,0.035)` | `rgba(255,255,255,0.035)` | Subtle list hover |
| `--color-warn`           | `#9a6a2c` | `#c4a36a` | Mute on, cut bands, delete hover |
| `--color-ok`             | `#4a6d4c` | `#8baa7b` | Matched rule, applied tag, pulse dot |

### Meter zone colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-meter-norm` | `#c0c0c0` | `#6e6e6e` | Bottom 12 segments (headroom) |
| `--color-meter-hot`  | `#6b6b6b` | `#cfcfcf` | Mid 4 segments (hot) |
| `--color-meter-clip` | `#b67042` | `#d49a64` | Top 2 segments (clip zone) |
| `--color-meter-dim`  | `rgba(20,20,20,0.06)` | `rgba(255,255,255,0.05)` | Inactive segment |

### Typography

- **UI face**: `Inter`, weights 400/500/600, fallback
  `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif`
- **Mono face**: `JetBrains Mono`, weights 400/500/600, fallback
  `"Cascadia Code", Consolas, ui-monospace, monospace`
- Apply mono via the `.mono` utility class (or Tailwind
  `font-mono`) — never set `font-family` per-element

Type ramp used on the page (rounded to nearest 0.5 px):

| Use | Size | Weight | Letter | Class |
|---|---|---|---|---|
| Page H1 | 20 | 600 | -0.01em | `.page-h h1` |
| Section H2 (`Sonar`) | 18 | 600 | -0.01em | `.sn-header h2` |
| Popover title | 13 | 600 | — | `.pop-title-name` |
| Strip name (uppercase) | 11.5 | 600 | 0.02em | `.strip-name` |
| Body | 12-13 | 400-500 | — | default |
| Sub-line | 10-12 | 400 | — | `.strip-sub`, `.sn-header .sub` |
| Section label (uppercase) | 10 | 500 | 0.1em | `.aps-label`, `.ds-label` |
| Mute/Solo letter | 10 | 600 | 0.08em | `.mute-btn`, `.solo-btn` |
| dB readout | 15 | 600 | -0.01em | `.db` |
| dB unit (after readout) | 9 | 400 | 0.06em uppercase | `.db-unit` |
| Tick numbers | 8.5 | 400 mono | — | `.tick-num` |
| Output device button | 10.5 | 400 | — | `.out-dd-name` |
| Band cell freq label | 9 mono | 400 | 0.04em | `.band-freq` |
| Band cell dB value | 11 mono | 600 | — | `.band-db` |
| Tags (`fps`, `footsteps`) | 10 mono | 400 | 0.02em | `.use-tag` |

### Spacing

| Use | px |
|---|---|
| Header padding | 18 / 24 / 12 |
| Mixer rail padding | 16 / 20 / 10 |
| Strip padding | 10 / 8 / 8 |
| Strip column gap | 8 |
| App-zone padding | 4 |
| App-zone min-height | 38 (compact: 32) |
| Popover padding | 14 |
| Auto section padding | 8 / 20 / 18 |
| Auto-section column gap (now-active / rules) | grid column 280 ↔ 1fr, no gap (1px divider) |
| Rules grid `gap` | 6 |
| Rules card min width | 220 |

### Radii

- Strip / aps card / popover: **12 / 14 px**
- Buttons (`sn-btn-*`, `mute-btn`, `dd-opt`): **6–8 px**
- App tile (monogram): **6 px** at `sm`, **9 px** at `md`
- Pills (`.use-tag`, `.aps-count`, `.route-pill`): **999 px** (full)
- Fader track: **10 px** (capsule)

### Shadows

- Popover: `0 14px 40px rgba(0,0,0,0.35)` (light) / `0.6` (dark)
- Output dropdown / now-picker menu: `0 -8px 24px rgba(0,0,0,0.18)`
  (the menu opens **upward** from the strip bottom — see
  `.out-dd-menu` rules, `GG Sonar.html` line ~813)
- Fader thumb: `0 1px 0 rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.18)`

### Motion

- Fader fill: `height .08s linear`
- Meter cells: `background .06s linear`
- Hover/focus transitions: `0.12s` everywhere (border-color,
  background)
- Popover entrance: `pop-in .15s ease-out` (translateY -4px +
  scale 0.98 → 1)
- Pulse dot (auto on indicator): `pulse 1.6s ease-in-out infinite`

### Brand safety

App representations are **2-letter monograms over a muted accent
square**. The prototype intentionally never renders brand logos for
Counter-Strike, Spotify, Discord, etc. The real app should follow the
same approach **unless the user has licensed brand artwork** —
otherwise the monogram fallback is the canonical visual.

---

## Component Reference

Each component below maps to a function in the prototype, with its
file:line so the developer can read the source directly. Components
are listed roughly outside-in.

### `SonarPage` (root)

**Source**: `gg-sonar-app.jsx:273-491`

Owns all state and wires every child. Renders header, preset chips,
output strip, mixer, auto-preset section, and the conditionally-mounted
floating popover.

```tsx
interface SonarPageProps {
  tweaks: { density: 'compact' | 'comfortable'; meter: 'segments' | 'off'; theme: 'dark' | 'light' };
}
```

State held here (see `Mixer state` above for shapes):

| Hook | Purpose |
|---|---|
| `levels`              | All channel + master levels/peaks/mute |
| `manualPreset`        | Selected preset id when not auto |
| `assignments`         | Apps → channels |
| `outputs`             | Channels → output device id |
| `masterOutput`        | Master output device id |
| `autoPilot`, `rules`, `activeAppId` | Auto-preset engine |
| `detailsOpen`         | Floating popover visibility |
| `draggingApp`         | Id of currently-dragged app (for drop highlight) |
| `query`               | Search bar (currently visual only) |

Derived: `appsByChannel` (memo over `assignments`), `matchedRule`,
`effectivePreset`, `liveChannels`.

A `useEffect` at lines 304–319 animates peaks every 100ms by drifting
each channel's `peak` toward `level * 0.85 + jitter`. In production
this loop is replaced by real meter data pushed from the audio engine
over IPC.

### Header

**Source**: `gg-sonar-app.jsx:354-396`

DOM shape:
```html
<div class="sn-header">
  <div class="titles">
    <h2>Sonar</h2>
    <div class="sub">4/5 live · preset game <span class="auto-tag">· AUTO</span></div>
  </div>
  <div class="actions">
    <label class="sn-search">…</label>
    <button class="sn-btn-ghost"><Sliders/> Preset details</button>
    <button class="sn-btn-primary"><Save/> Save preset</button>
  </div>
</div>
```

Styles: `GG Sonar.html:184-267`.

The "AUTO" tag appears **only when** `autoPilot && matchedRule`.

The "Preset details" button is a toggle. Its `ref` is forwarded to
`PresetDetailsPopover` so the dismiss-on-outside-click handler can
ignore clicks on the trigger itself.

### `PresetChips`

**Source**: `gg-sonar-controls.jsx:219-242`

Row of 6 chips. Active chip uses inverted colors
(`background: var(--color-text-primary)`). When a rule has picked the
preset automatically, a small green dot is rendered in the chip's
top-right via `::after` (see CSS at `GG Sonar.html:1410-1422`).

```tsx
interface PresetChipsProps {
  active: PresetId;
  onPick: (id: PresetId) => void;
  autoPilot: boolean;
  autoPreset: PresetId | undefined;
}
```

Clicking a chip calls `handlePickPreset` in `SonarPage` which **flips
`autoPilot` to false** — treating manual taps as an override.

### Output strip

**Source**: `gg-sonar-app.jsx:407-426`

Slim band below the chips. Shows the master output device, L/R bar
meters (driven by `levels.master.peak`), and the master headroom dB.
This is read-only in the design (the picker for master output is at
the bottom of `MasterStrip`, not here).

Styles: `GG Sonar.html:317-389`.

### `ChannelStrip`

**Source**: `gg-sonar-app.jsx:21-119`

The workhorse. One per output channel. Composition top-to-bottom:

| Region | Class | Source |
|---|---|---|
| Header (icon + name + apps-count sub) | `.strip-head` | `gg-sonar-app.jsx:42-50` |
| App drop zone (chips OR mic-input tag) | `.app-zone` | `gg-sonar-app.jsx:52-75` |
| Fader + meter | `.strip-body` | `gg-sonar-app.jsx:77-86` |
| dB readout | `.strip-readout` | `gg-sonar-app.jsx:88-92` |
| Mute / Solo | `.strip-actions` | `gg-sonar-app.jsx:94-101` |
| Output dropdown | `.out-dd` (rendered by `OutputDropdown`) | `gg-sonar-app.jsx:103-108` |

```tsx
interface ChannelStripProps {
  channel:        Channel;
  state:          MixerLevel;
  apps:           App[];                          // apps routed to this strip
  isDropTarget:   boolean;                        // highlight while another app is dragged
  dragging:       string | null;                  // current dragging app id
  output:         string;
  outputOptions:  OutputDevice[];
  onChangeOutput: (id: string) => void;
  level:          number;
  onLevel:        (v: number) => void;
  onMute:         () => void;
  onAppDragStart: (app: App) => void;
  onAppDragEnd:   () => void;
  onAppDrop:      (appId: string) => void;
  faderH:         number;
  showMeter:      boolean;
}
```

Drag-and-drop wiring is HTML5 native:
- `onDragOver` on the strip → `preventDefault()` to accept
- `onDrop` on the strip → reads the app id from
  `e.dataTransfer.getData('text/plain')` and calls `onAppDrop`
- `AppChip` sets the data on `onDragStart`

For strips with `takesApps === false` (Mic), `onDragOver` is a no-op
so the strip shows the "drop-blocked" cursor automatically. The CSS
class `.strip.drop-blocked` (applied when an app is being dragged and
the strip won't accept it) dims it to 70 % opacity.

Strip styles: `GG Sonar.html:418-485`. Compact-density overrides at
`1423-1440`.

### `MasterStrip`

**Source**: `gg-sonar-app.jsx:123-167`

Visually identical to `ChannelStrip` but:
- Always has the "sum of all channels" tag in the app-zone slot
- Larger min-width (110 px) and uses `--color-surface-raised`
- No Solo button
- Always has an output dropdown at the bottom

Styles: shared `.strip` + `.master-strip` overrides at
`GG Sonar.html:419-485`.

### `VerticalFader`

**Source**: `gg-sonar-controls.jsx:7-76`

Custom slider; no native `<input type=range>`. Pointer + keyboard +
ARIA.

```tsx
interface VerticalFaderProps {
  value:    number;             // 0..100
  onChange: (v: number) => void;
  muted:    boolean;
  height:   number;             // default 220
}
```

Inputs:
- **Pointer**: `onPointerDown` captures the track, listens to
  `pointermove` / `pointerup` on `window` so the gesture survives
  pointer-leave.
- **Keyboard** (when focused):
  - `ArrowUp` / `ArrowDown` → ±1
  - `PageUp` / `PageDown` → ±10
- **ARIA**: `role="slider"`, `aria-orientation="vertical"`,
  `aria-valuemin/max/now`.

Tick marks at **0, -6, -12, -20, -40, -∞ dB** (positioned 0, 15, 30,
50, 75, 100 % from top). Source: lines 41–48.

Visuals:
- Track: 18 px wide capsule, `var(--color-bg)`
- Fill: from bottom, `var(--color-border-strong)` becoming
  `var(--color-text-primary)` while dragging or focused
- Thumb: 28 × 14 px pill, primary text colour, sits centred over the
  fill top. Subtle shadow.

Styles: `GG Sonar.html:487-580`.

### `LevelMeter`

**Source**: `gg-sonar-controls.jsx:78-94`

18-segment vertical bar, perceptual `sqrt(peak/100) * 18` mapping so
the top segments only light under loud signal (matches VU feel).

```tsx
interface LevelMeterProps {
  peak:     number;           // 0..100
  muted:    boolean;
  segments: number;           // default 18
  height:   number;
}
```

Zones (from the **top** of the meter down):
| Segments | Class | Token |
|---|---|---|
| 0-1 (top 2) | `.m-clip` | `--color-meter-clip` |
| 2-5         | `.m-hot`  | `--color-meter-hot` |
| 6-17        | `.m-norm` | `--color-meter-norm` |

Inactive cells use `--color-meter-dim`. Styles: `GG Sonar.html:582-597`.

### `AppChip`

**Source**: `gg-sonar-controls.jsx:96-128`

```tsx
type AppChipSize = 'xs' | 'sm' | 'md';

interface AppChipProps {
  app:         App;
  size?:       AppChipSize;       // default 'sm'
  draggable?:  boolean;           // default true
  dragging?:   boolean;
  onDragStart?: (app: App) => void;
  onDragEnd?:   () => void;
  onClick?:    (app: App) => void;
  showLabel?:  boolean;           // false: tile only; true: tile + name
  isActive?:   boolean;
}
```

Sizes:
- `xs` — 18 × 18 px tile, used in the "Simulate foreground" picker
- `sm` — 24 × 24 px tile, used on channel strips and rule rows
- `md` — 36 × 36 px tile + readable name, used in "Now active" card

The accent colour comes from `app.accent` via the
`--app-accent` CSS custom property (`style={{ '--app-accent': accent }}`).
The tile uses an inset 1px-light / 1px-dark gradient to look slightly
3-D without a real shadow — see `.app-tile` at
`GG Sonar.html:721-731`.

### `OutputDropdown`

**Source**: `gg-sonar-controls.jsx:130-189`

Compact dropdown opened by clicking the strip's output button.

```tsx
interface OutputDropdownProps {
  value:    string;
  options:  OutputDevice[];
  onChange: (id: string) => void;
  compact?: boolean;
}
```

Behaviour:
- Opens **upward** (`bottom: calc(100% + 4px)`) so it lifts above the
  strip instead of pushing layout down. CSS at
  `GG Sonar.html:813-826`.
- Closes on **outside click** (document `mousedown` listener
  registered inside a `useEffect` while open).
- Closes on **Escape**.
- Each option row: `[icon] [name + sub] [check if selected]`.

The button itself shows `[→] [device icon] [name] [chevron]`. The arrow
glyph (`SnArrow`) signals "route to" and is muted; the chevron is the
disclosure indicator.

### `EQCurve`

**Source**: `gg-sonar-controls.jsx:191-217`

Inline SVG line chart. 10 points sampled from `PRESET_EQ[preset]`,
rendered with a soft area fill (`<linearGradient id="eqfill">`).

```tsx
interface EQCurveProps {
  preset: PresetId;
  W?:     number;       // default 260
  H?:     number;       // default 120
}
```

The popover uses `W=300 H=130`. Stroke colour follows
`currentColor` so the parent owns the curve hue. Grid lines at 25/50/75 %,
zero line at the 50 % center. Source-of-truth values in
`PRESET_EQ` (`gg-sonar-data.jsx:22-29`).

### `AutoPresetSwitcher`

**Source**: `gg-sonar-switcher.jsx:221-294`

Root of the auto-preset panel. Renders the titlebar (with `AUTO ON`
status + toggle) and the body grid (`280px | 1fr`).

```tsx
interface AutoPresetSwitcherProps {
  activeAppId:     string;
  onPickActiveApp: (id: string) => void;
  rules:           AutoRule[];
  onChangePreset:  (ruleId: string, preset: PresetId) => void;
  onRemoveRule:    (ruleId: string) => void;
  onAddRule:       (appId: string, preset: PresetId) => void;
  autoPilot:       boolean;
  onToggleAuto:    () => void;
  manualPreset:    PresetId;
}
```

The toggle switch is a custom button (no native checkbox) — pattern
documented at `GG Sonar.html:1098-1124`. The titlebar status pill
`AUTO ON` pulses a soft green ring (`@keyframes pulse`) when enabled.

Section styles: `GG Sonar.html:1041-1409`.

### `NowActiveCard`

**Source**: `gg-sonar-switcher.jsx:11-96`

Left column of the auto-preset body.

```tsx
interface NowActiveCardProps {
  activeApp:       App;
  matchedRule:     AutoRule | undefined;
  autoPilot:       boolean;
  manualPreset:    PresetId;
  onPickActiveApp: (id: string) => void;
  allApps:         App[];
}
```

Structure:
- Header `NOW ACTIVE`
- Card with `(app chip md)` + `(name + pid line)` + chevron — clicking
  opens a dropdown of all apps (the "Simulate foreground" picker)
- A footer pill showing the resolved preset with a tag:
  - `→ APPLIED` (green) — auto on AND rule matched
  - `→ MANUAL` (green) — auto off, using `manualPreset`
  - `→ FALLBACK` (green) — auto on but no rule matched

The picker is dismissed on outside click via a one-shot
`useEffect`-mounted mousedown listener.

### `RuleRow`

**Source**: `gg-sonar-switcher.jsx:98-150`

A single rule card in the rules grid.

```tsx
interface RuleRowProps {
  rule:           AutoRule;
  isActive:       boolean;             // currently matched
  onChangePreset: (preset: PresetId) => void;
  onRemove:       () => void;
}
```

Grid layout: `auto 1fr auto auto` — `[app chip] [app name truncated]
[preset pill] [trash]`. Clicking the preset pill opens a small
dropdown anchored below it to swap the binding.

`isActive` flips the row to a green border + green-tinted background
via `color-mix(in oklch, var(--color-ok) 12 %, var(--color-surface-raised))`.

### `AddRuleForm`

**Source**: `gg-sonar-switcher.jsx:152-219`

Inline form that lives inside the rules grid as the last cell.
Collapsed state is a dashed "+ Add rule" button; expanded shows two
`<select>` rows (app, preset) and Cancel / Save actions.

```tsx
interface AddRuleFormProps {
  availableApps: App[];           // already-bound apps filtered out
  onAdd:         (appId: string, preset: PresetId) => void;
}
```

Disables the button when `availableApps.length === 0` (with the label
text "All apps have rules").

### `PresetDetailsPopover`

**Source**: `gg-sonar-app.jsx:171-269`

Floating panel triggered by the header "Preset details" button.
Absolutely positioned inside `.app-content` at `top: 64px; right: 20px`
with `max-height: calc(100% - 80px)` so it never overflows the window.

```tsx
interface PresetDetailsPopoverProps {
  preset:    PresetId;
  onClose:   () => void;
  anchorRef: RefObject<HTMLElement>;     // the trigger button
}
```

Sections:

1. **EQ curve** — `<EQCurve W=300 H=130 />` inside an `.eq-frame`
2. **Band grid** — 5×2 grid of `.band-cell`. Each shows `freq` +
   `bandDbFor(value)`. The cell border colour shifts green/orange
   depending on the dB sign (`pos` / `neg` / `zero` classes).
3. **Description** paragraph from `PRESET_DESC[preset]`
4. **Profile** — 5-row property table built from `PRESET_PROPS[preset]`
   (Spatial / Surround / Bass boost / Dynamics / Headroom)
5. **Use for** — chip tags from `PRESET_PROPS[preset].use`
6. **Read-only notice** at the bottom

Dismissal:
- **Click outside** the popover (the listener whitelists the
  `anchorRef` so clicks on the trigger don't double-fire)
- **Escape**
- Clicking the trigger again (toggle)

Animation: `pop-in .15s ease-out`.

Styles: `GG Sonar.html:839-1039`.

---

## Interactions & Behaviour

### Channel fader

- **Drag**: pointer-down on track → move adjusts level; release ends.
- **Keyboard** (when fader has focus, e.g. tab to it):
  - `↑/↓` ±1, `PgUp/PgDn` ±10
- **Visual**: fill colour darkens to `--color-text-primary` while
  dragging or focused.

### Mute / Solo

- **Mute** toggles `levels[channelId].muted`. When on, the button is
  filled with `--color-warn` and the strip dims its name + dB.
- **Solo** is presentational only in the prototype; in production it
  should mute every other channel temporarily.

### App routing (drag & drop)

- Apps are draggable HTML5 elements (set `effectAllowed = 'move'` on
  `dragstart`).
- All output channel strips are drop targets; mic / master are not.
- While a drag is active, drop-eligible strips don't get a special
  treatment in the prototype (use `.strip.drop-active` when `over`).
  For polish in the real app, consider:
  - Highlight every eligible drop target on `dragstart` (not just the
    one currently being hovered)
  - Show a clean placeholder where the dropped chip will land
- On drop, the assignment changes; the source strip removes the chip,
  the target strip appends it. No reorder within a strip in v1.

Keyboard alternative (recommended for a11y, not in prototype):
provide a "Move to…" item in a chip context menu listing every
output channel.

### Output device dropdown

- Click button → opens upward.
- Click outside or press Escape → closes.
- Selecting an option fires `onChange(id)` and closes.
- The master strip uses the same component.

### Preset chips

- Clicking a chip:
  1. Sets `manualPreset = id`
  2. Flips `autoPilot = false` (manual override)
- The chip whose preset is the **rule match** for the current
  foreground app shows a small green dot in its top-right when
  `autoPilot` is on, regardless of which is "active".

### Auto preset rules

- **Add**: pick app + preset → `onAddRule(appId, preset)`.
  Apps already bound are filtered out of the picker.
- **Change preset**: click the preset pill on a rule → dropdown →
  pick a new preset → `onChangePreset(ruleId, preset)`.
- **Delete**: trash icon → `onRemoveRule(ruleId)`. No confirm in v1.
- **Toggle auto**: switch in the section titlebar → `autoPilot = !autoPilot`.
  When off, the "Rules" header shows `paused`. Rules are kept but
  no longer applied.
- **Simulate foreground app** (prototype-only): clicking the now-active
  card opens a picker of all 10 apps to fake a foreground change.
  In production, this is driven by an OS hook (focus change → IPC →
  `setActiveAppId`); the picker shouldn't exist in the shipped UI.

### Preset details popover

- Trigger via header button (toggle behaviour).
- Always reflects `effectivePreset` (live updates if the active app
  changes while open).
- Dismiss: outside click, Escape, or trigger again.
- Should re-focus the trigger on close for keyboard users (not done
  in the prototype — easy to add via `useEffect` cleanup).

---

## Responsive notes

The window in the prototype is fixed-height (980 px). Mixer rail uses
`overflow-x: auto` so very narrow widths get a horizontal scroll
rather than a broken layout. The auto-preset section's rules grid is
`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` so it
naturally reflows from 1 → 2 → 3 columns as width grows.

For very narrow widths (sub-720 px content), consider:
- Stack the now-active card above the rules grid (`grid-template-columns: 1fr` below a breakpoint)
- Shorten output dropdown name (already truncates to 1 line)

These responsive rules are **not** in the prototype — add per the host
app's existing breakpoints.

---

## State management

```ts
// stores/sonarStore.ts (Zustand example)

interface SonarStore extends SonarState {
  // mixer
  setLevel:        (id: ChannelId, v: number) => void;
  toggleMute:      (id: ChannelId) => void;
  setOutput:       (id: ChannelId | 'master', deviceId: string) => void;

  // app routing
  assignApp:       (appId: string, channel: ChannelId) => void;

  // preset
  setManualPreset: (id: PresetId) => void;          // also flips autoPilot off

  // auto
  toggleAuto:      () => void;
  addRule:         (appId: string, preset: PresetId) => void;
  removeRule:      (ruleId: string) => void;
  changeRulePreset:(ruleId: string, preset: PresetId) => void;

  // foreground app — driven externally, never user-set in production UI
  setActiveAppId:  (appId: string) => void;
}
```

All mutations should round-trip through the audio engine so changes
survive a restart and propagate to other clients on the same machine
(Sonar honors multiple sessions).

### IPC channels

Add to `shared/ipc.ts`:

```ts
export const IPC_CHANNELS = {
  // …existing…
  SONAR_SET_LEVEL:      'sonar:set-level',
  SONAR_TOGGLE_MUTE:    'sonar:toggle-mute',
  SONAR_ASSIGN_APP:     'sonar:assign-app',
  SONAR_SET_OUTPUT:     'sonar:set-output',
  SONAR_SET_PRESET:     'sonar:set-preset',
  SONAR_TOGGLE_AUTO:    'sonar:toggle-auto',
  SONAR_ADD_RULE:       'sonar:add-rule',
  SONAR_REMOVE_RULE:    'sonar:remove-rule',
  SONAR_UPDATE_RULE:    'sonar:update-rule',

  // Pushed by main → renderer
  SONAR_LEVELS_PUSH:    'sonar:levels',           // peak/level snapshot every ~80ms
  SONAR_ACTIVE_APP:     'sonar:active-app',       // foreground app id
} as const;
```

Renderer reads from the Zustand store; main pushes peak snapshots
+ active-app changes; main writes mutations to the audio engine.

---

## Files

### Prototype source (under `reference/`)

| File | Purpose |
|---|---|
| `GG Sonar.html`            | Page chrome + all CSS (token + component styles). The visual truth. |
| `gg-sonar-app.jsx`         | `SonarPage`, `ChannelStrip`, `MasterStrip`, `PresetDetailsPopover`, `AppWindow`, `App` root |
| `gg-sonar-controls.jsx`    | `VerticalFader`, `LevelMeter`, `AppChip`, `OutputDropdown`, `EQCurve`, `PresetChips` |
| `gg-sonar-switcher.jsx`    | `AutoPresetSwitcher`, `NowActiveCard`, `RuleRow`, `AddRuleForm` |
| `gg-sonar-data.jsx`        | Channel/preset/app/output catalogues, EQ values, initial state, `dbFor`, `bandDbFor` |
| `gg-sonar-icons.jsx`       | All inline-SVG icons (same `Ico` chassis as Shortcuts and Plugins) |
| `tweaks-panel.jsx`         | Demo Tweaks panel (theme/density/meter switches). Don't ship. |

### Suggested production layout

```
src/renderer/src/
├── pages/
│   └── Sonar.tsx                    # SonarPage equivalent
├── features/sonar/
│   ├── components/
│   │   ├── ChannelStrip.tsx
│   │   ├── MasterStrip.tsx
│   │   ├── VerticalFader.tsx
│   │   ├── LevelMeter.tsx
│   │   ├── AppChip.tsx
│   │   ├── OutputDropdown.tsx
│   │   ├── PresetChips.tsx
│   │   ├── EQCurve.tsx
│   │   ├── PresetDetailsPopover.tsx
│   │   └── AutoPreset/
│   │       ├── AutoPresetSection.tsx
│   │       ├── NowActiveCard.tsx
│   │       ├── RuleRow.tsx
│   │       └── AddRuleForm.tsx
│   ├── data/
│   │   └── catalogues.ts            # channels, presets, outputs (static)
│   └── stores/
│       └── sonarStore.ts
└── shared/
    └── types.ts                     # ChannelId, PresetId, AutoRule, …
```

---

## Checklist for the implementing developer

- [ ] Land the data shapes in `shared/types.ts`
- [ ] Stand up `sonarStore` with all mutators + IPC bridge
- [ ] Build `VerticalFader` + `LevelMeter` first (visual primitives)
- [ ] Build `AppChip` and the drag-and-drop wiring (lift the
      HTML5-native pattern, or swap for `@dnd-kit/core`)
- [ ] Build `ChannelStrip` and `MasterStrip` using those primitives
- [ ] Wire the output dropdown (`OutputDropdown`)
- [ ] Build the header + preset chips + output strip
- [ ] Build the auto-preset section (titlebar, now-active, rules grid)
- [ ] Build the floating `PresetDetailsPopover`
- [ ] Hook up peak-meter pushes from the audio engine (~80–100 ms)
- [ ] Hook up the foreground-app watcher → `setActiveAppId`
- [ ] A11y pass: tabbable faders, accessible mute/solo, focus return
      after popover close, screen-reader labels on output dropdown
- [ ] Verify both themes (light + dark) against the prototype
