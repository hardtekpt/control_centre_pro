# Handoff: Shortcuts Page

> A new **Shortcuts** page for **Mission Control** (Control Centre Pro).
> Reachable from the main sidebar. Lets the user view, create, edit, and
> delete keyboard shortcuts for actions across Arctis, Sonar, Displays,
> and the app itself. Actions carry an optional **parameter** (preset
> name, brightness step, display index, …) — the IPC layer routes by
> `(actionId, value)`.

---

## About the Design Files

Files under `reference/` are **design references**, not production code:
React + inline JSX prototypes (`<script type="text/babel">`) used to
explore visuals and behaviour. **Do not copy them verbatim.** Recreate
the same look and behaviour inside the existing `control_centre_pro`
codebase using its established conventions:

- **TypeScript strict** — no `any`, no implicit JSX
- **React 18 functional components**
- **Tailwind for layout/spacing; CSS custom properties for all colours**
  (never hardcode hex)
- **Zustand** for state (mirrors the existing `appStore` / `serviceStore`)
- **`contextBridge` + `IPC_CHANNELS` constants** — never raw IPC strings
- **`globalShortcut`** (Electron) for global bindings; document-level
  keydown for `When focused` bindings

---

## Fidelity

**High-fidelity.** Exact tokens, sizes, type ramps, dropdown chrome,
keybind capture rules, and conflict behaviour are specified below. The
reference prototype in `reference/Shortcuts.html` is the visual truth —
open it and inspect when in doubt.

---

## Where it lives

| | |
|---|---|
| Sidebar entry | "Shortcuts" — between Services and Settings; uses `IconKeyboard` |
| Route id | `shortcuts` (add to `AppView` union in `shared/types.ts`) |
| Page component | `src/renderer/src/pages/Shortcuts.tsx` |
| Settings tab? | No — it's a top-level page, not a Settings sub-tab |
| Sidebar count badge | shows total configured shortcut count |

The sidebar item follows the existing `NavItemDef` shape and the page
component is registered in `MainContent.tsx` exactly the way Audio /
Devices already are.

---

## Page Layout

```
┌─ App Window ─────────────────────────────────────────────────────────┐
│ [Sidebar]  Shortcuts                       [🔍 search] [+ New shortcut] │
│            20 configured · 18 enabled                                  │
│           ─────────────────────────────────────────────────────────── │
│            [All 20] [🎧 Arctis 6] [📡 Sonar 6] [🖥 Displays 5] [⚙ App 3]│
│           ─────────────────────────────────────────────────────────── │
│            ┌─ NewShortcutPanel (inline, toggles open) ─────────────┐ │
│            │ Category   Action          Value                       │ │
│            │ Shortcut   Scope           Cancel  [Save shortcut]     │ │
│            └────────────────────────────────────────────────────────┘ │
│                                                                       │
│            🎧 ARCTIS  6  ────────────────────────────────────────── │
│            [ico] Toggle mic mute            [Ctrl+Shift+M] [○] [×]  │
│            [ico] Set ANC mode (Transparency)[Ctrl+Alt+T]   [○] [×]  │
│            [ico] Volume up (+5%)            [Ctrl+]]       [○] [×]  │
│            …                                                          │
│            📡 SONAR  6  ────────────────────────────────────────── │
│            …                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

**Header** — page title + meta line (`N configured · M enabled`),
right side has the search input (`⌘K` focus) and a primary
"+ New shortcut" button.

**Filter chips** — All + one chip per category, each with a monospace
count.

**Scrollable list** — sticky category headers, ~14 rows visible at
default window size. The new-shortcut panel toggles open at the top of
the scrollable area (inline; not a modal).

---

## Data Model

### Categories

```ts
interface Category {
  id: 'arctis' | 'sonar' | 'displays' | 'app';
  label: string;
  icon: ComponentType<{ size?: number }>;
  blurb: string;     // shown as sub-text in the Category dropdown
}
```

Defined in `lib/shortcuts/catalog.ts`. See **Categories + Actions** for the full list.

### Actions

Each action represents a single behaviour the keybind dispatches to. An
action may have **at most one parameter** (`enum` or `number`).
Consolidating per-behaviour actions cuts the catalog from ~40 to ~25
and replaces near-duplicates like `sonar.preset.music` /
`sonar.preset.game` with one `sonar.preset-set` action + an enum
parameter.

```ts
type ParamSchema =
  | {
      kind: 'enum';
      label: string;                        // e.g. "Preset", "Display"
      options: Array<{ id: string; label: string }>;
    }
  | {
      kind: 'number';
      label: string;                        // e.g. "Step", "Volume"
      min: number;
      max: number;
      step: number;
      default: number;
      unit?: string;                        // e.g. "%"
      signed?: '+' | '−';                   // prefix for delta actions
    };

interface Action {
  id: string;                               // dotted; e.g. 'sonar.preset-set'
  cat: Category['id'];
  label: string;                            // ≤ ~28 chars
  icon: ComponentType<{ size?: number }>;
  param?: ParamSchema;
}
```

### Shortcuts

```ts
type Scope = 'global' | 'focused';

interface Shortcut {
  id: string;                  // opaque; generate on create
  actionId: Action['id'];
  value?: string | number;     // only present if the action has a param
  keys: string[];              // ordered tokens, e.g. ['Ctrl', 'Shift', 'M']
  scope: Scope;
  enabled: boolean;
}
```

`keys` is an array of normalised display tokens, not a raw accelerator
string. Convert to Electron's `accelerator` format at the IPC boundary —
see **Accelerator Conversion**.

### Key combo helpers

Pure functions in `lib/shortcuts/keys.ts`:

```ts
// Build a combo from a KeyboardEvent. Returns null if event is purely
// modifier (no base key yet).
function combinationFromEvent(e: KeyboardEvent): string[] | null;

// Format / compare:
function formatCombo(keys: string[]): string;          // "Ctrl + Shift + M"
function combosEqual(a: string[], b: string[]): boolean;
```

Normalisation rules (these are non-negotiable — they make user-facing
labels predictable and round-trip-safe):

| KeyboardEvent.key | Display token |
|---|---|
| `Control`, `Alt`, `Shift`, `Meta` | (skipped; treated as modifier flag) |
| `' '` (space) | `Space` |
| `ArrowUp` / `Down` / `Left` / `Right` | `↑` / `↓` / `←` / `→` |
| `Escape` | `Esc` |
| `Enter`, `Tab`, `Backspace` | as-is |
| `Delete` | `Del` |
| `F1`..`F12` | as-is |
| single printable char | `.toUpperCase()` |
| any other | `e.key` unchanged |

Modifier order is always `Ctrl, Alt, Shift, Meta` regardless of press
order. Bare letters with no modifier are **rejected** by the capture
logic unless the base is a function key — this prevents people from
binding `A` and breaking text input.

### Format value for display

```ts
function formatActionValue(action: Action, value: unknown): string | null {
  if (!action.param || value == null) return null;
  if (action.param.kind === 'enum') {
    return action.param.options.find((o) => o.id === value)?.label ?? String(value);
  }
  if (action.param.kind === 'number') {
    return `${action.param.signed ?? ''}${value}${action.param.unit ?? ''}`;
  }
  return String(value);
}

function defaultValueFor(action: Action): string | number | undefined {
  if (!action.param) return undefined;
  if (action.param.kind === 'enum') return action.param.options[0]?.id;
  return action.param.default;
}
```

---

## Categories + Actions

The full action catalog as specified in `reference/shortcuts-data.jsx`.
Replicate this exactly in `lib/shortcuts/catalog.ts` — these IDs are the
contract between the renderer and the main-process dispatchers, so don't
rename without updating the corresponding IPC handler.

### Arctis
| Action id | Label | Param |
|---|---|---|
| `arctis.mute` | Toggle mic mute | — |
| `arctis.anc-cycle` | Cycle ANC mode | — |
| `arctis.anc-set` | Set ANC mode | enum: `off` / `trans` / `anc` |
| `arctis.vol-up` | Volume up | number: 1–25, step 1, default 5, `%`, `+` |
| `arctis.vol-down` | Volume down | number: 1–25, step 1, default 5, `%`, `−` |
| `arctis.vol-set` | Set volume | number: 0–100, step 5, default 60, `%` |
| `arctis.output-mute` | Toggle output mute | — |
| `arctis.sidetone` | Set sidetone | number: 0–100, step 10, default 30, `%` |
| `arctis.power` | Power off headset | — |

### Sonar
| Action id | Label | Param |
|---|---|---|
| `sonar.preset-set` | Set audio preset | enum: `music` / `game` / `studio` / `cinema` / `speech` / `flat` |
| `sonar.preset-cycle` | Cycle next preset | — |
| `sonar.channel-up` | Channel volume up | enum: `game` / `chat` / `media` / `aux` / `mic` |
| `sonar.channel-down` | Channel volume down | (same enum as above) |
| `sonar.master-up` | Master volume up | number: 1–25, step 1, default 5, `%`, `+` |
| `sonar.master-down` | Master volume down | number: 1–25, step 1, default 5, `%`, `−` |

### Displays
| Action id | Label | Param |
|---|---|---|
| `disp.brightness-up` | Brightness up | number: 5–25, step 5, default 10, `%`, `+` |
| `disp.brightness-down` | Brightness down | number: 5–25, step 5, default 10, `%`, `−` |
| `disp.brightness-set` | Set brightness | number: 0–100, step 10, default 80, `%` |
| `disp.activate` | Activate display | enum: `1` / `2` / `3` |
| `disp.cycle` | Cycle active display | — |
| `disp.night-shift` | Toggle night shift | — |
| `disp.refresh` | Refresh detection | — |

### App
| Action id | Label | Param |
|---|---|---|
| `app.toggle` | Show / hide window | — |
| `app.lock` | Lock workstation | — |
| `app.quit` | Quit Mission Control | — |
| `app.reload-service` | Reload service | enum: `all` / `arctis-hid` / `sonar` |
| `app.go-to-page` | Open page | enum: `home` / `audio` / `displays` / `services` / `shortcuts` / `settings` |

---

## Design Tokens

Reuse the existing Mission Control palette from `globals.css`. Add these
three for the dropdown + warning:

```css
/* Light theme — add to :root */
--color-text-tertiary: #B0B0B0;
--color-kbd-bg:        #E3E3E3;
--color-row-hover:     rgba(20,20,20,0.035);
--color-warn:          #9a6a2c;

/* Dark theme — add to [data-theme="dark"] */
--color-text-tertiary: #5a5a5a;
--color-kbd-bg:        #2c2c2c;
--color-row-hover:     rgba(255,255,255,0.035);
--color-warn:          #c4a36a;
```

`--color-warn` is the single non-neutral colour in the design — used
only for conflict warnings. Do not introduce any other coloured accents.

---

## File Plan

```
src/renderer/src/
├── pages/
│   └── Shortcuts.tsx                       # page-level component
├── components/
│   └── shortcuts/
│       ├── ShortcutList.tsx                # grouped list + filter chips
│       ├── ShortcutRow.tsx                 # single row w/ inline capture
│       ├── NewShortcutPanel.tsx            # inline create form
│       ├── KbdPills.tsx                    # render keys as <kbd> pills
│       ├── Dropdown.tsx                    # custom dropdown component
│       ├── ValueField.tsx                  # picks Dropdown / NumberField
│       ├── NumberField.tsx                 # −/+ stepper
│       ├── icons.tsx                       # icon set
│       └── shortcuts.css                   # @import in globals.css
├── stores/
│   └── shortcutStore.ts                    # Zustand: list + CRUD
└── lib/
    └── shortcuts/
        ├── catalog.ts                      # CATEGORIES + ACTIONS + SCOPES
        ├── keys.ts                         # combinationFromEvent etc.
        └── accelerator.ts                  # ↔ Electron accelerator strings
```

Main-process additions:

```
src/main/
├── shortcuts/
│   ├── shortcutRegistry.ts                 # registers globalShortcut bindings
│   └── dispatcher.ts                       # maps (actionId, value) → handler
src/shared/types.ts                         # IPC channels + Shortcut type
```

---

## Component Specs

### 1 · ShortcutsPage

The page-level wrapper. Mounts inside `MainContent`'s
`<case 'shortcuts'>` branch.

Subscribes to `shortcutStore` for the list and CRUD methods, and to the
existing global key listeners (so `⌘K` focuses search and `n` opens the
new-shortcut panel — but only when no input is focused).

Renders:
1. `<ShortcutListHeader />` — title + search + "+ New shortcut"
2. `<FilterChips />` — All + per-category
3. `<NewShortcutPanel />` (conditionally)
4. `<CategoryGroup />` × N — sticky header + `<ShortcutRow />` × N

### 2 · ShortcutRow

Single row, ~40 px tall. CSS grid:
```
grid-template-columns: 28px 1fr auto 36px 28px;
gap: 12px;
padding: 8px 12px;
border-radius: 8px;
```

- **Icon** — 28 × 28, `border-radius: 7px`, `background: var(--color-surface)`, `color: var(--color-text-primary)`. Inside: action icon at 16 px.
- **Body** — `row-title` (Inter 13 · **500** · primary) followed by an inline value pill (see below) if `value` is set. Below: `row-meta` (JetBrains Mono 11 · secondary): `Category · Scope[· Conflict warning if any]`.
- **Keys** — keybind pills (see KbdPills). Wrapped in a clickable area (4 × 6 px padding, 6 px radius); hover background `var(--color-surface)`. Click → row enters capture mode.
- **Toggle** — 32 × 18 px switch; track `var(--color-border)` → `var(--color-text-primary)` when on. Thumb `var(--color-bg)` in light, `#d0d0d0` in dark.
- **Delete** — 28 × 28 ghost button with `IconX`; only visible-styled on row hover, but always clickable for accessibility.

Disabled rows (`enabled: false`): title dims to secondary, kbd pills go 45 % opacity, icon goes 50 %.

**Capture mode behaviour** (`capturing` prop):
- Keys area swaps to a small pulsing dot + "Press keys…" caption
- Listens to `keydown` on `window` with `capture: true`
- Each event preventDefault + stopPropagation
- `Escape` → cancel (back to non-capture, no change)
- Non-modifier-key combo with at least one modifier (or a bare function key) → commit
- Bare letter/number presses are ignored until a modifier is held

### 3 · KbdPills

```tsx
function KbdPills({ keys }: { keys: string[] }): JSX.Element {
  if (keys.length === 0) return <span className="kbd unset">unset</span>;
  return (
    <>
      {keys.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kbd-plus">+</span>}
          <span className="kbd">{k}</span>
        </Fragment>
      ))}
    </>
  );
}
```

Pill style:
```css
.kbd {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 500;
  background: var(--color-kbd-bg);
  border: 1px solid var(--color-border);
  border-bottom-width: 1.5px;          /* tactile shadow line */
  border-radius: 5px;
  padding: 2px 6px;
  color: var(--color-text-primary);
  line-height: 1;
  height: 19px;
  min-width: 19px;
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.kbd.unset { color: var(--color-text-secondary); border-style: dashed; background: transparent; }
.kbd-plus { color: var(--color-text-tertiary); font-size: 11px; margin: 0 1px; font-family: 'JetBrains Mono', monospace; }
```

### 4 · Value pill (in row title)

Small monospace badge shown next to the action label when the shortcut
has a value:

```css
.row-value-pill {
  display: inline-flex; align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 1px 6px;
  margin-left: 8px;
  line-height: 1.4;
  letter-spacing: 0.02em;
}
[data-theme="dark"] .row-value-pill { background: var(--color-bg); }
```

The label inside is `formatActionValue(action, value)` — e.g.
`Transparency`, `+5%`, `Music`, `Display 1`.

### 5 · NewShortcutPanel

Inline form that opens at the top of the scrollable list. Slides down
with the keyframe below; no modal, no overlay.

```css
.new-panel {
  margin: 14px 16px 6px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px;
  display: grid;
  grid-template-columns: 1fr 1.25fr 1.25fr;
  grid-template-areas:
    "category  action    value"
    "shortcut  scope     actions"
    "warn      warn      warn";
  gap: 12px 14px;
  align-items: end;
  animation: panelIn .18s cubic-bezier(.2,.7,.3,1);
}
@keyframes panelIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Field labels** are 10 px / `letter-spacing: 0.08em` / uppercase /
secondary, sitting above each control.

**Behaviour**:
1. **Category** dropdown enabled by default.
2. **Action** dropdown disabled until a Category is picked; options
   filtered to that category.
3. **Value** field renders `ValueField` keyed off the selected action's
   `param`. When no action is picked → "Choose an action first" empty
   state. When action has no param → "— not required —" empty state.
4. Picking an action **auto-seeds** the value via `defaultValueFor()`.
5. **Shortcut** is a keybind capture area (same chrome as ShortcutRow
   capture mode). Auto-opens when clicked. Esc cancels.
6. **Scope** dropdown with two options (Global / When focused).
7. **Save shortcut** disabled until all of: `actionId` is set;
   `keys.length > 0`; `value !== undefined` (if the action has a param);
   no conflict with any existing shortcut.
8. **Cancel** closes the panel without saving.

**Conflict detection**:
- Run on every keybind change
- Compares the captured combo to every existing shortcut via `combosEqual`
- If a match exists, show a warning message in the `warn` grid area
  (full width). Format: "`Ctrl + Shift + M` is already bound to **Toggle
  mic mute**. Pick a different combo." Include the existing shortcut's
  value if present: "… bound to **Set audio preset · Music**."
- Disable Save until conflict is resolved
- Same logic applies when inline-editing an existing row's keybind —
  if the new combo conflicts, just don't commit it (show the conflict
  inline in the row's meta line)

### 6 · Dropdown

Custom dropdown component used for Category, Action, Value (enum),
Scope. Trigger button matches the field control style; floating menu
auto-sizes to content.

**Props**:
```ts
interface DropdownOption {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number }>;
  sub?: string;                             // small mono caption shown right
}
interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  prefixIcon?: ComponentType<{ size?: number }>;
}
```

**Trigger**:
```css
.dropdown-trigger {
  width: 100%;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font: inherit; font-size: 13px;
  padding: 7px 10px;
  border-radius: 8px;
  display: flex; align-items: center; gap: 8px;
  min-height: 34px;
  cursor: pointer;
  text-align: left;
  transition: border-color .12s, background .12s;
}
.dropdown-trigger:hover { border-color: var(--color-border-strong); }
.dropdown-trigger:disabled { opacity: 0.45; cursor: not-allowed; }
.dropdown-trigger.open {
  border-color: var(--color-text-primary);
  background: var(--color-bg);
}
.dropdown-trigger > svg:last-child {     /* chevron */
  color: var(--color-text-secondary);
  transition: transform .15s;
}
.dropdown-trigger.open > svg:last-child { transform: rotate(180deg); }
```

**Menu**:
```css
.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  width: max-content;
  max-width: 360px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  box-shadow:
    0 10px 28px rgba(0,0,0,0.35),
    0 1px 0 rgba(255,255,255,0.03) inset;
  z-index: 20;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  animation: ddIn .14s cubic-bezier(.2,.7,.3,1);
}
@keyframes ddIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Light-theme shadow is softer:
```css
[data-theme="light"] .dropdown-menu {
  box-shadow: 0 10px 28px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.6) inset;
}
```

**Items**: 7 × 8 px padding, 6 px radius, 13 px Inter, primary text. Icon
+ label + optional mono `sub` caption + checkmark for selected.
`background: var(--color-surface)` on hover and on the currently
highlighted (keyboard-nav) item.

**Keyboard behaviour**:
- `ArrowDown` / `ArrowUp` move highlight
- `Enter` selects highlight, closes menu
- `Escape` closes menu
- Click outside closes menu
- On open, highlight defaults to the currently selected option

### 7 · ValueField

Routes to one of three controls based on `action.param`:

```tsx
function ValueField({ action, value, onChange }: ValueFieldProps): JSX.Element {
  if (!action) return <EmptyHint>Choose an action first</EmptyHint>;
  if (!action.param) return <EmptyHint>— not required —</EmptyHint>;
  if (action.param.kind === 'enum') {
    return <Dropdown value={value} options={action.param.options} onChange={onChange}
                     placeholder={`Select ${action.param.label.toLowerCase()}…`} />;
  }
  return <NumberField param={action.param} value={value} onChange={onChange} />;
}
```

`EmptyHint`:
```css
.no-value {
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
  min-height: 34px;
  display: flex; align-items: center; gap: 6px;
  font-style: italic;
}
```

### 8 · NumberField

```css
.number-field {
  display: flex; align-items: center; justify-content: space-between;
  gap: 4px; padding: 2px 4px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-height: 34px;
}
.number-field .step {
  appearance: none; border: 0; background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  width: 26px; height: 26px;
  border-radius: 6px;
  display: grid; place-items: center;
}
.number-field .step:hover:not(:disabled) {
  background: var(--color-surface);
  color: var(--color-text-primary);
}
.number-field .step:disabled { opacity: 0.3; cursor: not-allowed; }
.number-field .value {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 500;
  color: var(--color-text-primary);
  text-align: center;
}
```

The displayed value is `${param.signed ?? ''}${value}${param.unit ?? ''}`.
−/+ buttons disabled at `min` / `max`. Snap by `param.step`.

---

## State Management

```ts
// stores/shortcutStore.ts
import { create } from 'zustand';
import { combosEqual } from '../lib/shortcuts/keys';

export interface Shortcut {
  id: string;
  actionId: string;
  value?: string | number;
  keys: string[];
  scope: 'global' | 'focused';
  enabled: boolean;
}

interface ShortcutStoreState {
  items: Shortcut[];
  load: (items: Shortcut[]) => void;
  create: (input: Omit<Shortcut, 'id' | 'enabled'>) => string;
  update: (id: string, patch: Partial<Shortcut>) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  /** Find the first OTHER enabled shortcut bound to the same combo. */
  findConflict: (combo: string[], ignoreId?: string) => Shortcut | undefined;
}

export const useShortcutStore = create<ShortcutStoreState>((set, get) => ({
  items: [],
  load: (items) => set({ items }),
  create: (input) => {
    const id = 'sc-' + Math.random().toString(36).slice(2, 10);
    const s: Shortcut = { id, enabled: true, ...input };
    set({ items: [...get().items, s] });
    void window.api.shortcutsSave(get().items);
    return id;
  },
  update: (id, patch) => {
    set({ items: get().items.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    void window.api.shortcutsSave(get().items);
  },
  toggle: (id) => {
    const s = get().items.find((x) => x.id === id);
    if (s) get().update(id, { enabled: !s.enabled });
  },
  remove: (id) => {
    set({ items: get().items.filter((s) => s.id !== id) });
    void window.api.shortcutsSave(get().items);
  },
  findConflict: (combo, ignoreId) =>
    get().items.find((s) => s.id !== ignoreId && s.enabled && combosEqual(s.keys, combo)),
}));
```

Every mutation pushes the full list to the main process via
`window.api.shortcutsSave`. Debounce in the renderer or coalesce in the
main process — your call; the design doesn't depend on this.

---

## IPC + Main-process Wiring

### Channels (add to `IPC_CHANNELS` in `shared/types.ts`)

| Channel | Direction | Payload |
|---|---|---|
| `SHORTCUTS_GET` | renderer → main | none → `Shortcut[]` |
| `SHORTCUTS_SAVE` | renderer → main | `Shortcut[]` → `void` |
| `SHORTCUTS_DISPATCH` | main → renderer | `{ actionId, value }` (for `focused` scope dispatches and for renderer-side state updates) |

### Persistence

Save to `app.getPath('userData') + '/shortcuts.json'`:

```json
[
  { "id": "sc-...", "actionId": "arctis.mute", "keys": ["Ctrl","Shift","M"], "scope": "global", "enabled": true },
  { "id": "sc-...", "actionId": "sonar.preset-set", "value": "music", "keys": ["Ctrl","Alt","1"], "scope": "focused", "enabled": true }
]
```

Same pattern as `services.json` already on disk. Read on app boot; load
into `shortcutStore` via `window.api.shortcutsGet()`.

### Registering global bindings

`src/main/shortcuts/shortcutRegistry.ts` owns Electron's
`globalShortcut`. On boot and on every save:

1. `globalShortcut.unregisterAll()` (cheap — Electron handles dedupe)
2. For each enabled shortcut with `scope === 'global'`, register the
   accelerator and bind to a dispatcher:
   ```ts
   globalShortcut.register(toAccelerator(s.keys), () => {
     dispatch(s.actionId, s.value);
   });
   ```
3. If `globalShortcut.register` returns `false` (OS conflict), log a
   warning and continue. The shortcut row will still show — surfacing
   OS-level conflicts is a v2 task.

For `scope === 'focused'`, the main process **does not** register a
global handler. Instead the renderer listens via `window.addEventListener('keydown', …)` and calls `window.api.shortcutsDispatch(actionId, value)` when a match is detected. (The renderer's listener naturally only fires when Mission Control is focused.)

### Accelerator conversion

`src/main/shortcuts/accelerator.ts`:

```ts
const TOKEN_MAP: Record<string, string> = {
  Ctrl: 'CommandOrControl',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: 'Super',
  Space: 'Space',
  '↑': 'Up', '↓': 'Down', '←': 'Left', '→': 'Right',
  Esc: 'Escape',
  // single chars pass through
};

export function toAccelerator(keys: string[]): string {
  return keys.map((k) => TOKEN_MAP[k] ?? k).join('+');
}
```

### Dispatching to handlers

`src/main/shortcuts/dispatcher.ts` maintains a `Record<actionId, (value?: unknown) => Promise<void>>`. Wire each action's handler to the
existing service IPC:

```ts
const handlers: Record<string, (value?: unknown) => Promise<void>> = {
  'arctis.mute':         () => serviceManager.sendToService('arctis-hid', { cmd: 'mute-toggle' }),
  'arctis.anc-cycle':    () => serviceManager.sendToService('arctis-hid', { cmd: 'anc-cycle' }),
  'arctis.anc-set':      (mode) => serviceManager.sendToService('arctis-hid', { cmd: 'anc-set', mode }),
  'arctis.vol-up':       (step) => serviceManager.sendToService('arctis-hid', { cmd: 'vol-delta', step }),
  'arctis.vol-down':     (step) => serviceManager.sendToService('arctis-hid', { cmd: 'vol-delta', step: -(step as number) }),
  // …
  'app.toggle':          () => toggleMainWindow(),
  'app.lock':            () => exec('rundll32.exe user32.dll,LockWorkStation'),
  'app.go-to-page':      (page) => mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE, page),
};

export async function dispatch(actionId: string, value?: unknown): Promise<void> {
  const fn = handlers[actionId];
  if (!fn) {
    console.warn('[shortcuts] unknown actionId:', actionId);
    return;
  }
  try { await fn(value); }
  catch (err) { console.error('[shortcuts] dispatch failed:', actionId, err); }
}
```

Some actions (`app.go-to-page`, `app.toggle`) are renderer-targeted —
those send a message back to the renderer. Others (Arctis, Sonar)
forward into the existing `serviceManager` subprocess message protocol.

### Subprocess protocol extension

The Arctis HID service currently only emits stdout messages
(`connected` / `disconnected` / `event` / `log` / `fatal`). For
shortcut dispatch the service will also need to **accept** stdin
commands. Add a small JSON protocol:

```jsonc
// from main process → service stdin
{ "cmd": "mute-toggle" }
{ "cmd": "anc-set", "mode": "anc" }
{ "cmd": "vol-delta", "step": 5 }
```

Implement in `resources/services/arctis_hid_service.py` by polling
stdin in a separate thread (the existing reconnect loop blocks).

---

## Acceptance Checklist

- [ ] Sidebar entry "Shortcuts" appears between Services and Settings, with `IconKeyboard`, and shows the configured count.
- [ ] Clicking the entry routes to a `Shortcuts` page registered in `MainContent`.
- [ ] List groups by category in the order Arctis → Sonar → Displays → App, with sticky group headers.
- [ ] Filter chips switch the visible category; counts match the unfiltered total per category.
- [ ] Search filters by action label, formatted value, category, and combo string.
- [ ] **No hardcoded colours** anywhere — every fill / border / text colour is a CSS variable.
- [ ] Light and dark themes both look correct.
- [ ] Clicking a row's keybind pill puts the row into capture mode; the next valid combo replaces the binding and persists.
- [ ] Bare letter/number keys are rejected as bindings; function keys are allowed without a modifier.
- [ ] `+ New shortcut` opens the inline NewShortcutPanel (not a modal).
- [ ] Category dropdown is always enabled; Action dropdown is disabled until a category is picked; Value field shows the right empty state until an action is picked.
- [ ] Picking an action auto-seeds the value via `defaultValueFor`.
- [ ] Save is disabled until action + keys + (value if param) are valid AND no conflict exists.
- [ ] Conflict warning surfaces in the panel **and** on every conflicting row's meta line.
- [ ] Custom Dropdown supports keyboard nav (↑/↓/Enter/Esc), click-outside-close, animated open, auto-grows to content (max 360 px).
- [ ] NumberField clamps to min/max, snaps to step, disables −/+ at limits, shows the signed prefix when configured.
- [ ] Toggle on the row enables/disables the binding immediately; disabled rows visually dim and don't fire when their combo is pressed.
- [ ] Deleting a row removes it from the list and from `shortcuts.json`.
- [ ] App boot reads `shortcuts.json` and re-registers all enabled `global` shortcuts via `globalShortcut`.
- [ ] Renderer-side `keydown` listener handles `focused` scope without registering at the OS level.
- [ ] Dispatching `arctis.*` actions sends commands into the Arctis HID service over stdin (new subprocess protocol).

---

## Files in this Bundle

| File | Purpose |
|---|---|
| `README.md` | This document |
| `reference/Shortcuts.html` | Full interactive prototype — open in any browser |
| `reference/shortcuts-icons.jsx` | All line icons referenced by the design |
| `reference/shortcuts-data.jsx` | Reference catalog: CATEGORIES, ACTIONS, SCOPES, INITIAL_SHORTCUTS, helpers |
| `reference/shortcuts-dropdown.jsx` | Reference `Dropdown`, `NumberField`, `ValueField` components |
| `reference/shortcuts-app.jsx` | Reference `ShortcutsPage`, `ShortcutRow`, `NewShortcutPanel` |

Open `Shortcuts.html` to interact with the prototype: pick a row's
keybind pill to re-record, hit **N** to add, **⌘K** to search. Toggle
between light and dark via the buttons above the window.
