# GG Sonar — Preset Subpage Design Notes

> Design reference: Claude Design handoff bundle `lnMLHhAdbQeXSBhfCQYTIw` (GG Sonar.html)

---

## What was changed

The floating `PresetEditor` panel (fixed-position overlay, portal-rendered to `document.body`)
was replaced with an **inline preset subpage** that renders in the normal document flow below
the channel mixer rail. The page now scrolls around it instead of a fixed overlay blocking
the mixer.

---

## Component map

| File | Role |
|---|---|
| `features/sonar/components/EQCurveEditor.tsx` | Interactive SVG EQ curve with bidirectional draggable nodes |
| `features/sonar/components/PresetSubpage.tsx` | Inline subpage container (replaces floating PresetEditor) |
| `features/sonar/components/ChannelMixer.tsx`  | Wires up PresetSubpage; toggle-open on channel header click |
| `features/sonar/sonar.css`                    | `.sn-subpage` + child classes |

The old `components/gg-sonar/PresetEditor.tsx` is **no longer used by ChannelMixer** but has
been left in place for now — it may be repurposed or removed.

---

## EQCurveEditor

### Coordinate system

- **X axis**: log-scale frequency, 20 Hz → 20 kHz mapped to SVG width (500 viewBox units).
  `freqToX(f) = VW * log(f / 20) / log(20000 / 20)`
- **Y axis**: ±12 dB gain, linear. Centre (0 dB) at `VH / 2`.
  `gainToY(g) = VH * (0.5 − g / 27)` (slightly wider than ±12 so nodes don't clip to edge)

### Frequency response

Each enabled `SonarEQFilter` is evaluated as a standard biquad IIR using the
**RBJ Audio EQ Cookbook** formulas for three types:
- `peakingEQ` — classic peak/dip bell curve
- `lowShelving` — low-shelf boost/cut
- `highShelving` — high-shelf boost/cut

Combined response = sum of per-filter dB responses at each sampled frequency (380 log-spaced
points). Computed via `useMemo` — rerenders only when `eq` changes.

### Drag interaction

Each filter band gets a **13 px invisible hit circle** layered over a **5–8 px visual node**.

Drag behaviour:
- **Vertical** — updates `filter.gain` (clamped ±12 dB, rounded to 0.1 dB steps)
- **Horizontal** — updates `filter.frequency` (clamped 20–20 000 Hz, rounded to integer Hz)
- Uses `window.addEventListener('pointermove' / 'pointerup')` so drag works outside the SVG

Tooltip: appears on hover and during drag, shows `{freq}Hz {gain}dB` in a rounded rect.

### Visual nodes

- `fill: var(--color-accent)` when enabled, `var(--color-border-strong)` when disabled
- `fill: var(--color-text-primary)` while actively dragging (contrast boost)
- Disabled filters still show nodes (smaller radius) so users know the band exists

---

## PresetSubpage layout

```
┌─ .sn-sp-head ──────────────────────────────────────────────────────┐
│ GAME ▸ [Preset name ▾]  [☆]  [✕]                                  │
├─ .sn-sp-actionbar (editable presets only) ─────────────────────────┤
│ [name input .......................] [Revert] [Save]                │
├─ .sn-sp-readonly-notice (built-in presets only) ───────────────────┤
│ Built-in preset — read only.                    [Duplicate]        │
├─ .sn-sp-body (scrollable, max-height 520 px) ──────────────────────┤
│  ┌─ EQ ──────────────────────────────────────────────── [ON] ─┐    │
│  │  [EQCurveEditor SVG — drag nodes for freq/gain]           │    │
│  │  [▸ Show bands]                                            │    │
│  │  (collapsible band table: enable, freq Hz, type, gain, Q) │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌─ TEST SOUNDS ──────────────────────────────────────────────┐    │
│  │  [▶ Bass]  [▶ Virtual Surround]  [▶ Pop]  …               │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ── output channels only: ──────────────────────────────────────   │
│  ┌─ TONE ─────────────────────────────────────────────────────┐    │
│  │  Bass Boost     [slider]  [toggle]                         │    │
│  │  Treble Boost   [slider]  [toggle]                         │    │
│  │  Voice Clarity  [slider]  [toggle]                         │    │
│  │  General Gain   [slider]                                   │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌─ SMART VOLUME ──────────────────────────── [ON toggle] ────┐    │
│  │  Loudness   [Balanced ▾]                                   │    │
│  │  Volume Level  [slider]                                    │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌─ SPATIAL AUDIO ─────────────────────────── [ON toggle] ────┐    │
│  │  Form Factor  [Headphones ▾]                               │    │
│  │  Reverb Gain  [slider]                                     │    │
│  │  (surround channel grid when enabled)                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ── mic channel (chatCapture) only: ────────────────────────────   │
│  ┌─ NOISE PROCESSING ─────────────────────────────────────────┐    │
│  │  Noise Reduction, Noise Gate, Volume Stabilizer, …         │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

### Open / close

Clicking a channel strip header **toggles** the subpage:
- First click: opens subpage for that channel, scrolls into view
- Second click on same channel: closes
- Clicking a different channel: switches to that channel's presets

`editingChannel` state lives in `ChannelMixer`. Escape key propagates through the subpage:
close dropdown → discard draft → close subpage.

### Preset lifecycle (identical to old floating panel)

- `activeConfig` is the currently selected preset for the channel
- `draft` is a local clone of `activeConfig` for editing
- `dirty = draft !== activeConfig (name or data)`
- `composing = true` means a brand-new preset not yet saved
- Save → `onUpsert(final)` → `sonarUpsertConfig` IPC
- Revert → re-clone from `activeConfig`

---

## CSS tokens used

All colours reference `var(--color-*)` — no hardcoded hex. Key classes:

| Class | Purpose |
|---|---|
| `.sn-subpage` | Root card: surface bg, 12 px radius, border, slide-in animation |
| `.sn-sp-head` | Header bar with channel label, preset selector, fav + close buttons |
| `.sn-sp-actionbar` | Name input + Save/Revert row (editable presets only) |
| `.sn-sp-body` | Scrollable section container (max-height 520 px) |
| `.sn-sp-section` | Each named section card |
| `.sn-sp-section-h` | Section header row: title + optional right element (toggle) |
| `.sn-sp-row` | Single control row: label + right-side control(s) |
| `.sn-sp-bands` | Collapsible per-band filter table |
| `.sn-sp-samples` | Test-sound button cluster |

---

## Design rules applied

- Colours: CSS custom properties only — `var(--color-accent)` is the only action colour (matches the global neutral gray scheme)
- No gradients, no heavy shadows — panel uses `border` and `background: var(--color-surface)`
- Fonts: `Segoe UI` for labels, `JetBrains Mono` / `Cascadia Code` for band labels, gain values, Hz values
- Animation: single 140 ms ease-out slide-in (translateY -6 → 0) on mount — respects reduced-motion if added

---

## Known gaps / future work

- **Keyboard navigation on EQ curve**: arrow keys on a focused node for fine ±0.1 dB / ±1 Hz control
- **Q factor drag**: could add a modifier key (e.g. Shift) to drag Q on the selected node
- **Scrolling to the subpage**: `scrollIntoView()` on open would improve UX on small windows
- **Filter type indicator on nodes**: small shape glyph inside node (circle = peak, triangle = shelf)
- **Undo / redo**: revert currently only to last-saved; per-edit undo stack would improve usability
