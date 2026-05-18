# Handoff: Plugins Settings Tab

> A new **Plugins** tab in Mission Control's Settings page. Card grid of
> installable / installed plugins (Discord, Steam, Home Assistant,
> Spotify, OBS, Hue, Twitch, Stream Deck) + a per-plugin Configure page
> rendering a schema-driven form (OAuth, API keys, toggles, selects,
> multi-select chips, status banners, lifecycle controls).

---

## About the Design Files

Files under `reference/` are **design references**, not production code:
React + inline JSX prototypes (`<script type="text/babel">`). **Do not
copy verbatim.** Recreate the same look and behaviour inside the
existing `control_centre_pro` codebase using its established
conventions:

- **TypeScript strict** — no `any`, no loose JSX
- **React 18 functional components**
- **Tailwind for layout/spacing; CSS custom properties for all colours**
- **Zustand** for state (mirrors `appStore` / `serviceStore`)
- **`contextBridge` + `IPC_CHANNELS` constants** — never raw IPC strings
- Plugin background services follow the existing Python subprocess
  pattern from `arctis_hid_service.py` — newline-delimited JSON on
  stdout. New `cmd:` messages on stdin (already specified in the
  Shortcuts handoff) for renderer → plugin commands.

---

## Fidelity

**High-fidelity.** Exact tokens, sizes, status semantics, field
behaviour, and layout breakpoints are specified below.
`reference/Plugins.html` is the visual source of truth.

---

## Where it lives

| | |
|---|---|
| Settings tab id | `plugins` — add to `SettingsTab` union in `shared/types.ts` |
| Position | Between **General** and **About** in `SETTINGS_NAV` |
| Nav icon | `IconPlug` (added in this design) |
| Sidebar badge | Number of currently-connected plugins (count of `status === 'connected'`) |
| Page component | `src/renderer/src/pages/settings/Plugins.tsx` |
| Routing model | Two views: `grid` (list of all plugins) and `configure` (single plugin form). Held in component state — `{ pluginId: string \| null }`. Back-arrow returns to grid. |

---

## Layout

```
┌─ Settings shell ─────────────────────────────────────────────────────┐
│ [General]    Plugins                          [🔍 search] [Browse…] │
│ [Plugins]    4 connected · 7 installed                               │
│ [About]      ──────────────────────────────────────────────────────  │
│              [All 8] [Connected 4] [Communication 1] … [Available 1] │
│              ──────────────────────────────────────────────────────  │
│              ┌───────────────────┐  ┌───────────────────┐           │
│              │ D  Discord    [○]  │  │ S  Steam      [○]  │           │
│              │    .discord        │  │    .steam          │           │
│              │ Rich presence,…    │  │ Sync library,…     │           │
│              │ ● Connected    →   │  │ ● Connected    →   │           │
│              └───────────────────┘  └───────────────────┘           │
│              … (grid auto-fills, min 280px)                          │
└──────────────────────────────────────────────────────────────────────┘
```

On click of any card → Configure page:

```
┌─ Settings shell ─────────────────────────────────────────────────────┐
│ [General]    ← Plugins                                               │
│ [Plugins]    [D]  Discord                                  Plugin    │
│ [About]           Rich presence, status sync…              [On  ●]   │
│                   ● Connected · 2m ago · v1.2.0 · .discord           │
│              ──────────────────────────────────────────────────────  │
│              ┌─ Account ─────────────────────────────────────────┐  │
│              │ Discord account     [● hardtekpt#0451] [Re-auth] … │  │
│              └─────────────────────────────────────────────────────┘  │
│              ┌─ Rich Presence ─ Show what you're doing on profile ─┐ │
│              │ Show activity        Display Mission Control…  [○] │ │
│              │ Show headset         Includes "Arctis Nova Pro"… [○]│ │
│              │ Show Sonar preset    Appends the active preset… [○] │ │
│              └─────────────────────────────────────────────────────┘  │
│              … more sections                                          │
│              ┌─ Plugin lifecycle ─────────────────────────────────┐  │
│              │ Reset configuration    Clear all stored…    [Reset]│  │
│              │ Uninstall plugin       Remove the plugin…   [Uninstall] │
│              └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Plugin descriptor

```ts
type PluginStatus =
  | 'connected'      // live and OK
  | 'error'          // enabled but failing (auth/network/etc)
  | 'disabled'       // installed, switched off
  | 'installed'     // installed, never configured / not connected
  | 'not-installed'; // not yet acquired

interface Plugin {
  id: string;                    // unique slug, e.g. 'discord'
  name: string;                  // display name
  glyph: string;                 // 1-char placeholder (D, S, H, P, O, T, K)
  author: string;                // 'mission-control.discord', 'community.hass'
  version: string;
  blurb: string;                 // short description shown on cards
  status: PluginStatus;
  enabled: boolean;              // user-controlled
  statusLine: string;            // monospace tail under header
  category: 'communication' | 'gaming' | 'streaming'
          | 'smart-home' | 'media' | 'peripheral';
  error?: string;                // only present when status === 'error'
  sections: PluginSection[];     // form schema for Configure page
}
```

### Section + Field schema

```ts
interface PluginSection {
  id: string;
  title: string;
  desc?: string;                 // optional sub-header description
  fields: PluginField[];
}

type PluginField =
  | { kind: 'toggle';   id: string; label: string; sub?: string; value: boolean }
  | { kind: 'text';     id: string; label: string; sub?: string; value: string; placeholder?: string; mono?: boolean }
  | { kind: 'password'; id: string; label: string; sub?: string; value: string; placeholder?: string; hint?: string }
  | { kind: 'select';   id: string; label: string; sub?: string; value: string; options: Array<{ id: string; label: string }> }
  | { kind: 'multi';    id: string; label: string; sub?: string; value: Set<string>; options: Array<{ id: string; label: string }> }
  | { kind: 'oauth';    id: string; label: string; account: string; lastAuth: string; expiresAt?: string }
  | { kind: 'readonly'; id: string; label: string; sub?: string; value: string; mono?: boolean; copy?: boolean }
  | { kind: 'action';   id: string; label: string; sub?: string; button: string; danger?: boolean };
```

Each field is **stateless** as far as the form chassis is concerned —
all values come from the descriptor's `value` property; `onChange`
patches that value back to the store and persists.

### Status presentation map

```ts
const STATUS_PRESENT: Record<PluginStatus, { label: string; dot: string }> = {
  'connected':     { label: 'Connected',     dot: 'connected' },
  'error':         { label: 'Error',         dot: 'error' },
  'disabled':      { label: 'Disabled',      dot: 'disabled' },
  'installed':     { label: 'Not connected', dot: 'installed' },
  'not-installed': { label: 'Not installed', dot: 'not-installed' },
};
```

---

## Plugin Catalog

Minimum set for v1. The full schema for each plugin is in
`reference/plugins-data.jsx` — these IDs are the contract between the
renderer, the plugin runtime, and any IPC handlers. Don't rename.

| `id` | Name | Author | Category | Status | Notes |
|---|---|---|---|---|---|
| `discord` | Discord | `mission-control.discord` | communication | connected | OAuth · Rich Presence · DND sync · call notifications |
| `steam` | Steam | `mission-control.steam` | gaming | connected | Web API · library sync · auto-launch |
| `hass` | Home Assistant | `community.hass` | smart-home | connected | URL + token · domain multi-select · scene triggers |
| `spotify` | Spotify | `mission-control.spotify` | media | connected | OAuth · playback · home dashboard card |
| `obs` | OBS Studio | `community.obs` | streaming | **error** | WebSocket URL + password · banner displays the error |
| `hue` | Philips Hue | `mission-control.hue` | smart-home | **disabled** | bridge IP + app key · group selection · light sync |
| `twitch` | Twitch | `community.twitch` | streaming | **installed** | channel + OAuth · not yet configured |
| `streamdeck` | Stream Deck | `mission-control.streamdeck` | peripheral | **not-installed** | card shows "Install" instead of toggle |

Filter chips (with example counts in parens):

```ts
const PLUGIN_CATEGORIES = [
  { id: 'all',            label: 'All' },
  { id: 'connected',      label: 'Connected', match: (p) => p.status === 'connected' },
  { id: 'communication',  label: 'Communication' },
  { id: 'gaming',         label: 'Gaming' },
  { id: 'streaming',      label: 'Streaming' },
  { id: 'smart-home',     label: 'Smart home' },
  { id: 'media',          label: 'Media' },
  { id: 'available',      label: 'Available', match: (p) => p.status === 'not-installed' },
];
```

`match` overrides category-id matching for "Connected" and "Available".
All others compare against `plugin.category`.

---

## Design Tokens

Reuses the existing Mission Control palette. Add **two new tokens** for
status signalling (the only non-gray accents allowed):

```css
/* Light theme — add to :root */
--color-warn:  #9a6a2c;   /* error banner border, error status dot */
--color-ok:    #4a6d4c;   /* connected status dot */

/* Dark theme — add to [data-theme="dark"] */
--color-warn:  #c4a36a;
--color-ok:    #8baa7b;
```

Plus these reused-elsewhere ones already specified in the Shortcuts handoff:
`--color-text-tertiary`, `--color-row-hover`. Don't re-introduce them
twice.

---

## File Plan

```
src/renderer/src/
├── pages/settings/
│   └── Plugins.tsx                       # tab-level component (grid ↔ configure)
├── components/plugins/
│   ├── PluginGrid.tsx                    # header + filters + grid
│   ├── PluginCard.tsx                    # single card
│   ├── ConfigurePage.tsx                 # per-plugin form
│   ├── SectionCard.tsx                   # wrapper for a list of form rows
│   ├── FormField.tsx                     # schema → control dispatcher
│   ├── fields/
│   │   ├── TextField.tsx
│   │   ├── PasswordField.tsx
│   │   ├── ToggleField.tsx
│   │   ├── SelectField.tsx               # wraps Dropdown
│   │   ├── MultiField.tsx                # chip array
│   │   ├── OAuthField.tsx                # account pill + re-auth/disconnect
│   │   ├── ReadonlyField.tsx
│   │   └── ActionField.tsx
│   ├── StatusPill.tsx                    # dot + label
│   ├── Dropdown.tsx                      # SHARED with Shortcuts page — extract
│   ├── icons.tsx                         # plugin-page-specific icons
│   └── plugins.css                       # @import in globals.css
├── stores/
│   └── pluginStore.ts                    # Zustand: catalog + CRUD + dispatch helpers
└── lib/
    └── plugins/
        ├── catalog.ts                    # default plugin descriptors
        └── status.ts                     # STATUS_PRESENT, helpers
```

Main-process side (out of scope for "render the design" — but the
schema-driven form is meaningless without these wired up):

```
src/main/
├── plugins/
│   ├── pluginRegistry.ts                 # load installed plugins from disk
│   ├── pluginRuntime.ts                  # spawn / kill plugin subprocesses
│   └── handlers.ts                       # IPC: get/save/test/reauth/uninstall
src/shared/types.ts                       # IPC channels + Plugin/Field types
```

---

## Component Specs

### 1 · Plugins page component

Top-level Settings tab. Holds `pluginId: string | null` in component
state. Renders `<PluginGrid />` when `pluginId === null`, otherwise
`<ConfigurePage plugin={…} onBack={() => setPluginId(null)} />`.

Subscribes to `pluginStore` for the catalog and CRUD methods.

### 2 · PluginCard

CSS grid with named areas — this is the layout that broke during
verification, so keep the explicit `grid-template-areas`:

```css
.pl-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  grid-template-columns: 44px 1fr auto;
  grid-template-rows: auto auto 1fr auto;
  grid-template-areas:
    "glyph  name    toggle"
    "glyph  author  toggle"
    "blurb  blurb   blurb"
    "footer footer  footer";
  gap: 4px 14px;
  cursor: pointer;
  transition: background .12s, border-color .12s, transform .15s;
  text-align: left;
  appearance: none;
  color: var(--color-text-primary);
  font: inherit;
  width: 100%;
}
.pl-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-raised);
}
.pl-card.disabled { opacity: 0.7; }
```

| Element | Style |
|---|---|
| `.glyph` (area: `glyph`) | 44 × 44, `border-radius: 11px`, bg `var(--color-surface-raised)` (light) / `var(--color-bg)` (dark), JetBrains Mono 600 18 px |
| `.name` (area: `name`) | Inter **600** 14 px, `line-height: 1.2`, `align-self: end` |
| `.author` (area: `author`) | JetBrains Mono 11 px, secondary |
| `.pl-toggle-wrap` (area: `toggle`) | `align-self: center` — holds the 32 × 18 toggle, OR an "Install" ghost button if `status === 'not-installed'`. Both must stop propagation on click. |
| `.blurb` (area: `blurb`) | Inter 12 px, secondary, `line-height: 1.5`, `text-wrap: pretty`, `margin-top: 10px` |
| `.footer` (area: `footer`) | top-border separator (`1px solid var(--color-border)`), `padding-top: 12px`, holds `<StatusPill>` left and a chevron-right arrow on the right (only when installed). Hover translates the arrow `2px` right. |

Whole-card click opens Configure (only when installed); inner toggle
and Install button must `stopPropagation`.

### 3 · StatusPill

```tsx
function StatusPill({ status, label }: { status: PluginStatus; label?: string }) {
  const preset = STATUS_PRESENT[status];
  return (
    <span className="status">
      <span className={`status-dot ${preset.dot}`} />
      <span>{label ?? preset.label}</span>
    </span>
  );
}
```

Dot variants:
```css
.status-dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
.status-dot.connected   { background: var(--color-ok);   box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-ok) 20%, transparent); }
.status-dot.error       { background: var(--color-warn); box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-warn) 20%, transparent); }
.status-dot.disabled    { background: var(--color-text-tertiary); }
.status-dot.installed   { background: transparent; border: 1.5px solid var(--color-text-tertiary); }
.status-dot.not-installed { background: transparent; border: 1.5px dashed var(--color-text-tertiary); }
```

Label is JetBrains Mono 11 px, secondary.

### 4 · PluginGrid

Header (sticky to scroll container top):
```css
.pl-header {
  padding: 24px 32px 14px;
  display: flex; align-items: center; gap: 16px;
  flex-wrap: wrap;                       /* IMPORTANT — see verification note */
  border-bottom: 1px solid var(--color-border);
  position: sticky; top: 0;
  background: var(--color-bg);
  z-index: 2;
}
.pl-header .titles  { flex: 1 1 220px; min-width: 220px; }
.pl-header .actions { flex: 0 0 auto; }
@media (max-width: 720px) {
  .pl-header .actions { flex: 1 1 100%; }
  .pl-header .actions .pl-search { flex: 1; width: auto; }
}
```

**Verification note** (don't regress): the original layout used
`flex: 1` on the titles cell and crushed to 0 width when the actions
section was wide. `flex: 1 1 220px` + `min-width: 220px` + `flex-wrap:
wrap` on the parent makes the actions fall to a second row when there's
not enough room. Mirror the same pattern in `cfg-header-row`
(`grid-template-columns: 56px minmax(0, 1fr) auto` — the `minmax(0,1fr)`
matters so the middle column can't push beyond its track).

Search input — neutral search field (NOT a dropdown). Matches the
shortcuts page search. 220 px wide, 8 px radius, sub icon, ⌘K keyboard
hint optional (not required at the plugins page).

"Browse store" — secondary ghost button, opens an external store URL
or in-app store view (out of scope for v1; treat as a no-op button).

Filter chips row (`.pl-filters`):
- Sticky to `top: 71px` (just below the header)
- 12 × 32 px padding
- `display: flex; gap: 6px;`
- `overflow-x: auto; scrollbar-width: none;` (hidden scrollbar) — chips scroll horizontally if there's not enough room

Grid (`.pl-grid`):
```css
.pl-grid {
  padding: 22px 32px 40px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
```

Empty state when no plugins match: dashed-border block, centred, 56 px
vertical padding.

### 5 · ConfigurePage

Sticky header section:

```css
.cfg-header {
  padding: 22px 32px 22px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  position: sticky; top: 0;
  z-index: 2;
}
.cfg-header-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}
```

Header contents:
- **Back button** above the grid: `← Plugins` (ghost-styled, JetBrains Mono 12 px secondary, returns to `pluginId = null`)
- **Glyph** 56 × 56, `border-radius: 14px`, JetBrains Mono 600 22 px
- **Meta** (middle col, must have `minmax(0, 1fr)` so it can shrink): name (Inter **600** 18 px), blurb (Inter 12 px secondary 1.45 line-height), stat row (`StatusPill` with statusLine + version + author, JetBrains Mono 11 px)
- **Actions** (right col): a small caption ("Plugin" / "On"/"Off" stacked) + a **large** toggle (40 × 22, dot 18 × 18) for plugin-wide enable/disable. The big toggle is the only "lg" variant.

Body (`.cfg-body`): max-width 880 px, 28 × 32 px padding.

**Banners** (rendered above the first section when applicable):

```css
.banner {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  border-radius: 10px;
  font-size: 12px;
  background: var(--color-surface);
  line-height: 1.5;
  margin-bottom: 18px;
}
.banner.warn { border-left-color: var(--color-warn); }
.banner.info { border-left-color: var(--color-text-secondary); }
```

- `status === 'error'` → banner with `IconWarn`, title "Connection failed", `plugin.error` as sub, `Retry` ghost button right
- `status === 'disabled'` → banner with `IconInfo`, title "Plugin is disabled", "Turn it on in the top-right…" sub
- Other statuses → no banner

**Sections** are rendered from `plugin.sections`. Each section is a
`SectionCard`:

```css
.cfg-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 18px;
}
.cfg-section-h {
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
  display: flex; align-items: baseline; gap: 10px;
}
.cfg-section-h h3 { margin: 0; font-size: 13px; font-weight: 600; }
.cfg-section-h .desc { font-size: 12px; color: var(--color-text-secondary); }
```

**Lifecycle section** is always appended at the bottom, regardless of
the plugin's own sections:
- Reset configuration → `btn-ghost danger`, "Reset"
- Uninstall plugin → `btn-ghost danger`, "Uninstall"

### 6 · FormField + FieldRow

Row chassis:
```css
.ff {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 24px;
  padding: 14px 18px;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}
.ff:last-child { border-bottom: 0; }
.ff.ff-stacked { grid-template-columns: 1fr; gap: 8px; }
```

Use the stacked variant for `multi`, `oauth`, and `readonly` — those
controls are wide and don't fit the 320 px right column.

Label cell: title (Inter 13 px 500 primary) + optional description
(Inter 12 px secondary, 1.4 line-height, `text-wrap: pretty`).

### 7 · Field controls

#### TextField
Plain input (`<input type="text" className="input">`), 7 × 10 px
padding, 8 px radius, 13 px Inter. `mono` flag swaps font to JetBrains
Mono 12 px. Focus state: `border-color: var(--color-text-primary)`,
`background: var(--color-bg)`.

#### PasswordField
Same chassis as TextField + an eye/eye-off toggle button in the right
gutter. The button is `position: absolute; right: 8px;`, 24 × 24, 6 px
radius, ghost-style hover. `field.hint` renders below the input in
small mono tertiary.

#### ToggleField
Right-aligned 32 × 18 toggle (same component as the row toggle).

#### SelectField
Wraps the shared `<Dropdown>` component (extract this from the
Shortcuts page — don't re-implement). Options are
`{ id, label }`.

#### MultiField
Chip array, full-width (stacked). Click toggles a chip. Value is a
`Set<string>`.

```css
.ms-chip {
  appearance: none;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit; font-size: 12px;
  padding: 5px 10px; border-radius: 999px;
  cursor: pointer;
}
.ms-chip:hover { color: var(--color-text-primary); border-color: var(--color-border-strong); }
.ms-chip.on {
  background: var(--color-text-primary);
  color: var(--color-bg);
  border-color: var(--color-text-primary);
}
```

#### OAuthField
Stacked row. Read-only pill on the left (status-dot + account string +
optional "renews in 27 minutes"), `Re-auth` and `Disconnect` ghost
buttons on the right. `Disconnect` uses `btn-ghost danger`.

#### ReadonlyField
Dashed-border value display (looks like a disabled input) + optional
`Copy` ghost button. Clicking Copy hits the clipboard and swaps the
icon to `IconCheck` for 1.2 s.

#### ActionField
Single right-aligned ghost button with `field.button` label. Used for
"Test connection", "Re-pair bridge", etc. `field.danger` adds the
warn-coloured border on hover.

---

## State Management

```ts
// stores/pluginStore.ts
import { create } from 'zustand';
import type { Plugin } from '../shared/types';

interface PluginStoreState {
  plugins: Plugin[];
  load: (plugins: Plugin[]) => void;
  togglePlugin: (id: string) => void;
  patchField: (pluginId: string, sectionId: string, fieldId: string, value: unknown) => void;
  fieldAction: (pluginId: string, sectionId: string, fieldId: string, kind: string) => Promise<void>;
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  plugins: [],
  load: (plugins) => set({ plugins }),

  togglePlugin: (id) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== id) return p;
        const nextEnabled = !p.enabled;
        let nextStatus = p.status;
        // Status flips in lockstep with enable, EXCEPT for 'error' —
        // which stays until the user retries.
        if (p.status === 'connected' && !nextEnabled)        nextStatus = 'disabled';
        else if (p.status === 'disabled' && nextEnabled)     nextStatus = 'connected';
        return { ...p, enabled: nextEnabled, status: nextStatus };
      }),
    });
    void window.api.pluginsSave(get().plugins);
    void window.api.pluginsApply(id);     // tell the main process to
                                          // start/stop the runtime
  },

  patchField: (pluginId, sectionId, fieldId, value) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== pluginId) return p;
        return {
          ...p,
          sections: p.sections.map((s) => {
            if (s.id !== sectionId) return s;
            return {
              ...s,
              fields: s.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
            };
          }),
        };
      }),
    });
    void window.api.pluginsSave(get().plugins);
  },

  fieldAction: async (pluginId, sectionId, fieldId, kind) => {
    return window.api.pluginsDispatchAction({ pluginId, sectionId, fieldId, kind });
  },
}));
```

Every mutation persists via `window.api.pluginsSave`. The Status field's
`fieldAction` is async — main process resolves with the new status /
account info.

---

## IPC + Persistence

### Channels (add to `IPC_CHANNELS`)

| Channel | Direction | Payload |
|---|---|---|
| `PLUGINS_GET` | renderer → main | none → `Plugin[]` |
| `PLUGINS_SAVE` | renderer → main | `Plugin[]` → `void` |
| `PLUGINS_APPLY` | renderer → main | `pluginId` → `void` (start/stop runtime to match `enabled`) |
| `PLUGINS_DISPATCH_ACTION` | renderer → main | `{ pluginId, sectionId, fieldId, kind }` → `{ status?: PluginStatus, account?: string, error?: string }` |
| `PLUGINS_STATE_CHANGE` | main → renderer | `{ pluginId, patch: Partial<Plugin> }` — for live connection state updates pushed from runtimes |

### Persistence

`app.getPath('userData') + '/plugins.json'` — same pattern as
`services.json` and `shortcuts.json`. Single file holding the full
`Plugin[]` array.

Sensitive fields (passwords, OAuth tokens) should NOT be plain-text in
this file. Use Electron's `safeStorage` to encrypt the value at write
time and decrypt on read. The renderer never sees raw tokens — the main
process performs the actual HTTP/WS requests on behalf of the plugin.

### Renderer ↔ main process contract for credentials

Mock pattern:
1. Renderer sets `field.value = '••••'` placeholder for password-kind
   fields when listing; the real value lives only in the main process
   (encrypted at rest).
2. When the user edits a password field, the renderer sends the new
   plain-text value to the main process via `PLUGINS_SAVE`, which
   encrypts and persists. The next `PLUGINS_GET` returns the masked
   placeholder again.
3. The `eye-toggle` reveal works against the local React state, not the
   stored value. It's only meaningful when the user has just typed
   something they haven't yet saved.

---

## Plugin Runtime Model

Each plugin can ship as a Python (or Node) subprocess following the
existing service protocol:

```jsonc
// stdout (plugin → main)
{ "type": "log",          "level": "info|warn|error", "message": "..." }
{ "type": "status",       "status": "connected|error|disabled", "statusLine": "...", "error": "..." }
{ "type": "field-update", "sectionId": "...", "fieldId": "...", "value": ... }   // e.g. OAuth token refresh
{ "type": "event",        "event": "incoming-call", "data": { ... } }            // routed to other plugins / notifications

// stdin (main → plugin) — new in this design
{ "cmd": "start" }
{ "cmd": "stop" }
{ "cmd": "config-update", "sectionId": "...", "fieldId": "...", "value": ... }
{ "cmd": "action",        "sectionId": "...", "fieldId": "...", "kind": "test" }
```

Plugins live under `resources/plugins/<id>/` with a `plugin.json`
manifest (icon, glyph, default sections) and the executable. The
existing `ServiceManager` is the right place to host this — extend it
to spawn plugins identically to services and route messages through the
new IPC channels.

---

## Acceptance Checklist

- [ ] Settings sidebar shows the Plugins tab between General and About, with `IconPlug` and a numeric badge of connected plugins.
- [ ] Grid view renders all installed plugins as cards, plus `not-installed` ones at the end with an "Install" button instead of a toggle.
- [ ] Cards use the named-area grid (`glyph / name / author / blurb / footer / toggle`) — no auto-flow regression.
- [ ] Plugin header has `flex-wrap: wrap` and the titles cell has `flex: 1 1 220px; min-width: 220px` (verified bug fix — actions row wraps below at narrow widths instead of crushing the title).
- [ ] Configure header grid uses `grid-template-columns: 56px minmax(0, 1fr) auto` so the middle column can't push beyond its track.
- [ ] Status dots render with correct colours and ring effect; only `--color-ok` and `--color-warn` introduce non-gray.
- [ ] Light + dark themes both look correct.
- [ ] **No hardcoded colours** anywhere — every fill / border / text colour is a CSS variable.
- [ ] Clicking a card opens Configure; clicking the toggle on a card stops propagation and toggles enable in place.
- [ ] Toggling an enabled connected plugin → `disabled` status; toggling a disabled plugin → `connected`; `error` status sticks until Retry.
- [ ] Error banner appears for `error` plugins with title, sub, and Retry button; info banner for `disabled` plugins.
- [ ] All 8 field kinds render and persist correctly: text, password, toggle, select, multi, oauth, readonly, action.
- [ ] Password fields mask the value, support reveal toggle, never log raw values, persist encrypted via `safeStorage`.
- [ ] Multi-select stores `Set<string>` (serialise to `string[]` over IPC).
- [ ] Read-only fields display the dashed input and support copy-to-clipboard when `copy: true`.
- [ ] Filter chips row scrolls horizontally when overflowed; chip `white-space: nowrap` so "Smart home" doesn't break.
- [ ] Search filters by plugin name, author, and blurb.
- [ ] Lifecycle section always renders Reset + Uninstall buttons regardless of plugin's own sections.
- [ ] Plugin runtime spawns / kills cleanly via `pluginsApply` when the user toggles enable.
- [ ] Live status pushes from plugin runtimes (`PLUGINS_STATE_CHANGE`) update the store without a full reload.

---

## Files in this Bundle

| File | Purpose |
|---|---|
| `README.md` | This document |
| `reference/Plugins.html` | Full interactive prototype |
| `reference/plugins-icons.jsx` | Icon set |
| `reference/plugins-data.jsx` | Catalog: PLUGINS, PLUGIN_CATEGORIES, STATUS_PRESENT |
| `reference/plugins-components.jsx` | Dropdown, PluginCard, FormField, all sub-controls |
| `reference/plugins-app.jsx` | PluginGrid, ConfigurePage, SettingsShell, App |

Open `Plugins.html` to interact. Click any plugin card to enter
Configure, click the back button or a Settings tab to return. Toggle
plugins from the card or the configure header. The theme toggle above
the window switches both themes; verify both before sign-off.
