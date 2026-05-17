# Handoff: Notification System

> A custom in-app notification system for **Control Centre Pro** (Mission Control).
> Two surface shapes — rectangular and circular — sharing the app's neutral
> palette. Appears at the bottom-centre of the active window. Newest at the
> bottom; capped at 3 visible; auto-dismiss; click to dismiss.

---

## About the Design Files

The files under `reference/` are **design references**, not production code.
They are React + inline JSX prototypes (`<script type="text/babel">`) used to
explore visuals and motion in isolation. **Do not copy them verbatim.** Your
task is to recreate the same look and behaviour inside the existing
`control_centre_pro` codebase using its established conventions:

- **TypeScript strict** (no `any`, no loose JSX)
- **React 18 functional components**
- **Tailwind for layout/spacing; CSS custom properties for all colours** (never
  hardcode hex values — every colour must reference a token in
  `src/renderer/src/styles/globals.css`)
- **Zustand** for state (mirrors the existing `appStore` / `serviceStore`)
- **`contextBridge` + `IPC_CHANNELS` constants** — never raw IPC strings

The reference `notif-components.jsx` uses inline styles and a global stylesheet
because it has no Tailwind. In the real app, prefer Tailwind utilities for
layout, and inline `style={{ color: 'var(--token)' }}` for any token reference,
matching the pattern already used by `HeadsetCard.tsx` and the layout shell.

---

## Fidelity

**High-fidelity.** Exact tokens, sizes, type ramps, motion timings, and dedupe
behaviour are specified below. The reference prototype is the visual truth —
when in doubt, open `reference/Notification System.html` and inspect.

---

## Use Cases

Every notification fires in response to an existing IPC event or store action.
The mapping is one-to-one with the events that `App.tsx` already subscribes
to via `window.api.*`.

| Trigger source | Event | Notification kind | Dedupe key | TTL |
|---|---|---|---|---|
| Arctis HID service | `MicMuteEvent` | **circle** (icon: `IconMic` / `IconMicOff`) | `mic-mute` | 1800 ms |
| Arctis HID service | `AncModeEvent` | **rect** (icon: `IconAnc` / `IconTransparency`, title: "Noise cancellation" / "Transparency mode") | `anc-mode` | 2400 ms |
| Arctis HID service | `VolumeEvent` | **volume** (slider, icon: `IconVolume`) | `headset-volume` | 1800 ms |
| Arctis HID service | `BatteryEvent` | **ring** (icon: `IconBattery` or `IconBatteryLow` if < 20%) | `battery` | 2400 ms |
| Arctis HID service | `connected` message | **rect** ("Arctis Nova Pro — Connected · ready") | `arctis-connection` | 2400 ms |
| Arctis HID service | `disconnected` message | **rect** ("Arctis Nova Pro — Disconnected") | `arctis-connection` | 2400 ms |
| Future: Sonar service | preset change | **rect** + optional **glyph** circle (M / G / S / C) | `sonar-preset` | 2400 ms |
| Future: Sonar service | volume change | **volume** | `sonar-volume` | 1800 ms |
| App | `fatal` service event | **rect** (icon: `IconWarn`) | `service-${id}` | sticky |
| App | service started | **rect** (icon: `IconChip`) | `service-${id}-state` | 2400 ms |
| App | update available | **rect** (icon: `IconBell`) | none (each unique) | sticky |

**Dedupe behaviour:** if a notification with the same `key` is already in the
stack, replace it in place and reset its TTL. This is essential for rapid
events (volume slider drag → would otherwise queue dozens of notifications).

**Sticky** = `ttl: Infinity` — only dismissed by user click or programmatic
`dismiss(id)` / `clear()`.

---

## File Plan

Create the following files. Names match the project's existing naming
conventions (PascalCase components, camelCase stores).

```
src/renderer/src/
├── components/
│   └── notifications/
│       ├── NotificationStack.tsx           # mounts in App.tsx, renders queue
│       ├── NotificationRect.tsx            # rect + volume slider variant
│       ├── NotificationCircle.tsx          # circle + ring + glyph variants
│       ├── icons.tsx                       # all icon components
│       └── notifications.css               # @import in globals.css
├── stores/
│   └── notificationStore.ts                # Zustand
└── lib/
    └── notifyFromEvent.ts                  # maps Arctis events → notification specs
```

In `src/renderer/src/styles/globals.css` add the new tokens block (see
**Design Tokens** below) and `@import './components/notifications/notifications.css'`.

In `App.tsx`:
- Mount `<NotificationStack />` once near the root of the layout tree.
- In the existing `useEffect` that subscribes to `window.api.onArctisEvent`,
  call `notifyFromArctisEvent(evt)` after the existing `serviceStore.updateArctisState(evt)` call. Same for `onArctisConnected` / `onArctisDisconnected`.

---

## Design Tokens

The notification system reuses the existing neutral palette and adds three
surface-specific tokens. Append to the `:root` (light) and `[data-theme="dark"]`
blocks in `globals.css`:

```css
/* Light theme — add to :root */
--notif-bg:        rgba(245, 245, 245, 0.86);   /* acrylic-blurred base */
--notif-border:    rgba(20, 20, 20, 0.10);      /* hairline */
--notif-shadow:    0 8px 28px rgba(0, 0, 0, 0.10),
                   0 1px 0 rgba(255, 255, 255, 0.6) inset;

/* Dark theme — add to [data-theme="dark"] */
--notif-bg:        rgba(40, 40, 40, 0.86);
--notif-border:    rgba(255, 255, 255, 0.08);
--notif-shadow:    0 10px 32px rgba(0, 0, 0, 0.55),
                   0 1px 0 rgba(255, 255, 255, 0.04) inset;
```

**Do not introduce new colour values.** Inside the notification components,
every fill, stroke, and text colour must reference one of:
`--color-text-primary`, `--color-text-secondary`, `--color-border`,
`--color-accent`, `--color-surface-raised`, `--notif-bg`, `--notif-border`.

---

## Component Specs

### 1 · NotificationStack

A fixed-position host that mounts once. Reads from `notificationStore`,
renders each item with enter/exit animation, dispatches dismiss on
animation-end.

**Position**
```
position: absolute;        /* if inside an Electron window — anchored to the
                              .app-content area, NOT the document */
left: 50%;
bottom: 20px;
transform: translateX(-50%);
display: flex;
flex-direction: column-reverse;   /* newest sits at the bottom of the stack */
align-items: center;
gap: 10px;
z-index: 50;
pointer-events: none;             /* the stack itself is transparent to clicks */
```

Children re-enable pointer events: `.notif { pointer-events: auto; }`.

**API**
```tsx
export function NotificationStack(): JSX.Element {
  const items = useNotificationStore((s) => s.items);
  const dismiss = useNotificationStore((s) => s.dismiss);
  return (
    <div className="notif-stack">
      {items.map((item) => (
        <NotifItem key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  );
}
```

`NotifItem` runs a three-phase state machine: `enter` (mount, 1 frame) →
`shown` (visible for TTL) → `exit` (320 ms animate-out) → calls `onDismiss`.
If `ttl === Infinity`, the timer is never started.

---

### 2 · NotificationRect

The standard rectangle. Icon + title + optional subtitle + optional mono tail.

**Anatomy** (all in CSS pixels):

| Property | Value |
|---|---|
| Min width | 320 px |
| Max width | 440 px |
| Min width (wide) | 380 px |
| Height | auto (~64 px typical) |
| Padding | `12px 16px 12px 12px` |
| Border radius | 14 px |
| Border | `1px solid var(--notif-border)` |
| Background | `var(--notif-bg)` + `backdrop-filter: blur(20px) saturate(1.4)` |
| Shadow | `var(--notif-shadow)` |
| Grid | `grid-template-columns: 40px 1fr auto; gap: 14px; align-items: center;` |
| Icon badge | 40 × 40, `border-radius: 10px`, `background: var(--color-surface-raised)` |
| Icon | 20 px line icon, `color: var(--color-text-primary)`, stroke 1.75 |
| Title | Segoe UI Variable / Segoe UI, **600**, 13 px, line-height 1.25, primary |
| Subtitle | Segoe UI Variable / Segoe UI, **400**, 12 px, line-height 1.35, secondary, `margin-top: 2px` |
| Tail | JetBrains Mono, **400**, 11 px, secondary, `letter-spacing: 0.04em`, `padding-left: 8px` |
| Title/sub overflow | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` |

**Props**
```tsx
interface NotificationRectProps {
  icon: ReactNode;            // 20px line icon
  title: string;
  subtitle?: string;
  tail?: string;              // 1–5 char mono, e.g. "76%" or "MUS"
  wide?: boolean;             // min-width 380px
}
```

---

### 3 · NotificationVolume

Same chassis as `NotificationRect` with the body row layout swapped: title
+ percentage on top, full-width slider track below. Always `wide`.

**Differences**
- Body uses `flex-direction: column; gap: 6px`
- Top row: title left (same type as rect title) + mono percentage right (12 px,
  primary, `letter-spacing: 0.04em`)
- Bottom row: 6 px-tall track, `border-radius: 999px`, background
  `var(--color-border)`, fill `var(--color-accent)`, `transition: width 0.15s ease`

**Props**
```tsx
interface NotificationVolumeProps {
  icon: ReactNode;
  label?: string;             // default "Volume"
  value: number;              // 0..100
}
```

---

### 4 · NotificationCircle (icon-only)

56 × 56 perfect circle. Icon centred, 22–24 px (slightly larger than rect
icons since there's no badge).

| Property | Value |
|---|---|
| Size | 56 × 56 |
| Border radius | 999 px (perfect circle) |
| Border | `1px solid var(--notif-border)` |
| Background | `var(--notif-bg)` + `backdrop-filter: blur(20px) saturate(1.4)` |
| Shadow | `var(--notif-shadow)` |
| Icon | 22–24 px, `color: var(--color-text-primary)`, stroke 1.75 |

**Props**
```tsx
interface NotificationCircleProps {
  icon: ReactNode;
  dot?: boolean;              // status indicator in top-right
}
```

**Status dot** (when `dot`): 10 × 10 absolutely-positioned dot at
`top: 3px; right: 3px`, `background: var(--color-text-primary)`,
`box-shadow: 0 0 0 2.5px var(--color-bg)` (the box-shadow acts as a
ring matching the parent surface — gives the dot visual separation from
the circle's edge without a real border).

---

### 5 · NotificationCircle — ring progress variant

Same 56 × 56 chassis, but contains an inset SVG progress ring around the
icon. Use for any value-driven state notification (battery %, volume %,
sync %).

**Anatomy**
- 56 × 56 SVG overlay, absolutely positioned to fill the circle
- Two `<circle>` elements at `cx=28 cy=28 r=25` (inset 3 px from the edge)
- Track: `stroke="var(--color-border)" stroke-width="2.5" fill="none"`
- Fill: `stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" fill="none"`, rotated `-90°` around centre so the arc starts at 12 o'clock
- Fill arc length = `2 * π * 25 * (value / 100)`; the easy way is to set
  `stroke-dasharray = circumference` and `stroke-dashoffset = circumference * (1 - value/100)`
- Icon sits in a relative-positioned child above the SVG (`z-index: 1`)

**Props**
```tsx
interface NotificationCircleRingProps {
  icon: ReactNode;
  value: number;              // 0..100
}
```

---

### 6 · NotificationCircle — glyph variant

Same 56 × 56 chassis with a monospace letter (1–3 chars) instead of an
icon. Use for short codes — Sonar preset letters (M / G / S / C), channel
indicators (L / R), playback speed (1x / 2x).

**Anatomy**
- Main glyph: JetBrains Mono, **500**, 22 px, primary, `letter-spacing: 0.01em`,
  `line-height: 1`, centred
- Optional sub: JetBrains Mono, **400**, 8 px, secondary,
  `letter-spacing: 0.1em`, uppercase, absolutely positioned at `bottom: 7px`

**Props**
```tsx
interface NotificationCircleGlyphProps {
  glyph: string;              // 1–3 chars
  sub?: string;               // 3–7 char uppercase sublabel, e.g. "music"
}
```

---

## State Management

**File:** `src/renderer/src/stores/notificationStore.ts`

```tsx
import { create } from 'zustand';
import type { ReactNode } from 'react';

export type NotificationKind = 'rect' | 'volume' | 'circle' | 'ring' | 'glyph';

interface BaseNotification {
  id: number;
  key?: string;       // dedupe key — replaces existing item with same key
  kind: NotificationKind;
  ttl?: number;       // ms; omit for default; Infinity = sticky
}

export interface RectNotification extends BaseNotification {
  kind: 'rect';
  icon: ReactNode;
  title: string;
  subtitle?: string;
  tail?: string;
  wide?: boolean;
}

export interface VolumeNotification extends BaseNotification {
  kind: 'volume';
  icon: ReactNode;
  label?: string;
  value: number;
}

export interface CircleNotification extends BaseNotification {
  kind: 'circle';
  icon: ReactNode;
  dot?: boolean;
}

export interface RingNotification extends BaseNotification {
  kind: 'ring';
  icon: ReactNode;
  value: number;
}

export interface GlyphNotification extends BaseNotification {
  kind: 'glyph';
  glyph: string;
  sub?: string;
}

export type Notification =
  | RectNotification | VolumeNotification | CircleNotification
  | RingNotification | GlyphNotification;

export type NotificationInput = Omit<Notification, 'id'>;

interface NotificationStoreState {
  items: Notification[];
  push: (n: NotificationInput) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

const MAX_VISIBLE = 3;
let _nextId = 1;

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  items: [],
  push: (n) => {
    const id = _nextId++;
    set((s) => {
      let next = s.items;
      // Dedupe: replace existing notification with the same key in place.
      if (n.key) {
        const ix = next.findIndex((i) => i.key === n.key);
        if (ix >= 0) {
          next = [...next];
          next[ix] = { ...n, id } as Notification;
          return { items: next };
        }
      }
      next = [...next, { ...n, id } as Notification];
      if (next.length > MAX_VISIBLE) next = next.slice(-MAX_VISIBLE);
      return { items: next };
    });
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
```

**Subscribing outside React:**
```tsx
useNotificationStore.getState().push({ kind: 'circle', icon: <IconMicOff />, key: 'mic-mute' });
```

---

## Integration

### `notifyFromEvent.ts`

A small adapter that turns Arctis service events into notification specs. Keep
it pure (no side effects beyond calling `push`) — easier to test.

```tsx
import { useNotificationStore } from '../stores/notificationStore';
import {
  IconMic, IconMicOff, IconAnc, IconTransparency,
  IconVolume, IconBattery, IconBatteryLow, IconLink, IconUnlink,
} from '../components/notifications/icons';

export function notifyArctisConnected(): void {
  useNotificationStore.getState().push({
    kind: 'rect',
    key: 'arctis-connection',
    icon: <IconLink />,
    title: 'Arctis Nova Pro',
    subtitle: 'Connected · ready',
  });
}

export function notifyArctisDisconnected(): void {
  useNotificationStore.getState().push({
    kind: 'rect',
    key: 'arctis-connection',
    icon: <IconUnlink />,
    title: 'Arctis Nova Pro',
    subtitle: 'Disconnected',
  });
}

export function notifyArctisEvent(evt: ArctisEvent): void {
  const push = useNotificationStore.getState().push;
  switch (evt.event) {
    case 'MicMuteEvent':
      push({
        kind: 'circle',
        key: 'mic-mute',
        icon: evt.data.muted ? <IconMicOff /> : <IconMic />,
        ttl: 1800,
      });
      break;

    case 'AncModeEvent': {
      const mode = evt.data.mode; // 'OFF' | 'TRANSPARENCY' | 'ANC'
      push({
        kind: 'rect',
        key: 'anc-mode',
        icon: mode === 'TRANSPARENCY' ? <IconTransparency /> : <IconAnc />,
        title: mode === 'TRANSPARENCY' ? 'Transparency mode'
             : mode === 'ANC'          ? 'Noise cancellation'
             :                           'ANC off',
        subtitle: mode === 'TRANSPARENCY' ? 'Hear what\u2019s around you'
                : mode === 'ANC'          ? 'Active · ambient suppressed'
                :                           'Passive listening',
      });
      break;
    }

    case 'VolumeEvent':
      push({
        kind: 'volume',
        key: 'headset-volume',
        icon: <IconVolume />,
        label: 'Headset volume',
        value: evt.data.volume,
        ttl: 1800,
      });
      break;

    case 'BatteryEvent':
      push({
        kind: 'ring',
        key: 'battery',
        icon: evt.data.headset < 20 ? <IconBatteryLow /> : <IconBattery />,
        value: evt.data.headset,
      });
      break;
  }
}
```

### Wiring in `App.tsx`

In the existing `useEffect` that subscribes to IPC events, **add** notification
calls — don't replace the existing state updates.

```tsx
useEffect(() => {
  const offEvent = window.api.onArctisEvent((evt) => {
    serviceStore.getState().updateArctisState(evt);   // existing
    notifyArctisEvent(evt);                            // NEW
  });
  const offConnected = window.api.onArctisConnected((data) => {
    serviceStore.getState().setArctisState(data);     // existing
    notifyArctisConnected();                          // NEW
  });
  const offDisconnected = window.api.onArctisDisconnected(() => {
    serviceStore.getState().setArctisState(null);     // existing
    notifyArctisDisconnected();                       // NEW
  });
  return () => { offEvent(); offConnected(); offDisconnected(); };
}, []);
```

### Mounting `NotificationStack`

The stack must render inside the **app content area**, not the document body —
its `position: absolute` is relative to the nearest positioned ancestor. Mount
it inside `<MainContent>` (or wherever the main view container is rendered),
*not* in `App.tsx` at the root. The container that holds `<MainContent>` needs
`position: relative` and `overflow: hidden` already.

```tsx
// MainLayout.tsx (or wherever the main content area is composed)
<div className="relative flex-1 overflow-hidden">
  <MainContent />
  <NotificationStack />
</div>
```

---

## Motion

| Phase | Duration | Easing | Properties |
|---|---|---|---|
| Enter | 280 ms | `cubic-bezier(.2, .7, .3, 1)` | `opacity 0→1`, `translateY(14px)→0`, `scale(.96)→1` |
| Shown | TTL (default 2400 ms, 1800 ms for volume/circle) | — | none |
| Exit | 280 ms | `ease` | `opacity 1→0`, `translateY(0→8px)`, `scale(1→.96)` |

When a dedupe replaces an item, the existing DOM node stays mounted and the
new props re-render in place — no exit/enter animation. The TTL timer resets.

**Stack movement:** when one item dismisses and another shifts up, animate the
shift with the same enter easing. The reference implementation does this
implicitly by relying on flexbox + the per-item transition; you may need
FLIP if your renderer reorders aggressively.

---

## Icon Set

All icons in `src/renderer/src/components/notifications/icons.tsx`. Single
file, one export per icon, shared `IconProps` interface.

```tsx
import type { FC, ReactNode } from 'react';

export interface IconProps {
  size?: number;             // default 20
}

const Ico: FC<IconProps & { children: ReactNode }> = ({ size = 20, children }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
```

Required icons (copy SVG paths from `reference/notif-icons.jsx` — they are
correct as-is, just convert to `.tsx` with the `IconProps` type):

`IconHeadset`, `IconMic`, `IconMicOff`, `IconAnc`, `IconTransparency`,
`IconBattery`, `IconBatteryLow`, `IconVolume`, `IconVolumeMute`,
`IconMusic`, `IconBell`, `IconCheck`, `IconLink`, `IconUnlink`, `IconChip`,
`IconPower`, `IconCog`, `IconWarn`, `IconPlay`, `IconPause`, `IconRefresh`,
`IconBluetooth`, `IconMoon`.

All render at 20 px by default with stroke 1.75. They are visually balanced at
16–24 px. Don't change stroke weight — the consistency across icons matters
more than any single icon's optical correctness.

---

## Open Questions / Decisions

These were left open in the design — confirm with the designer before
implementing.

1. **Notification source for "no Arctis service running"** — should we fire a
   sticky `IconWarn` rect when the user has the Arctis service disabled in
   General Settings, or rely on the empty Home state? Recommendation: no
   notification; the empty state covers it.

2. **Volume notification coalescing during slider drag** — the dedupe key
   handles this automatically (each VolumeEvent replaces in place + resets
   TTL). Confirm this is the desired UX rather than the slider notification
   staying visible continuously while the user drags.

3. **Sound on notification** — design system doesn't speak to audio cues. None
   in v1.

4. **Click-to-dismiss vs swipe-to-dismiss** — v1 is click-anywhere-on-notification
   to dismiss. Swipe gestures are out of scope (Electron desktop).

5. **Stack capacity** — capped at 3 visible. Older items pushed off the top
   are dropped, not queued. Confirm 3 is right (could be 4 if subtitle-less
   circles dominate).

---

## Files in this Bundle

- `README.md` — this file
- `reference/Notification System.html` — full interactive prototype
- `reference/notif-components.jsx` — reference React components (JS, not TS)
- `reference/notif-icons.jsx` — reference icon definitions
- `reference/notif-app.jsx` — reference usage / trigger panel

Open the HTML file in any modern browser to interact with the prototype. The
trigger panel on the right fires every notification archetype; the variant
catalog below shows every shape on both themes.

---

## Acceptance Checklist

When the implementation is done, verify:

- [ ] All 5 notification kinds (`rect`, `volume`, `circle`, `ring`, `glyph`) render.
- [ ] Light and dark themes both look correct (toggle via `data-theme` on `<html>`).
- [ ] No hardcoded colours anywhere — every fill / stroke / background is a CSS variable.
- [ ] Mic mute / unmute fires a circle notification with the correct icon.
- [ ] ANC mode change fires a rect with the correct title for all three modes.
- [ ] Rapid volume changes don't queue notifications — the same notification updates in place.
- [ ] Battery sync below 20% uses `IconBatteryLow`; otherwise `IconBattery`.
- [ ] Headset connect / disconnect deduplicate against each other (same `arctis-connection` key).
- [ ] Stack caps at 3 visible.
- [ ] Notifications appear in the bottom-centre of the **main content area**, not the OS desktop.
- [ ] Enter and exit animations run; click-to-dismiss works mid-animation.
- [ ] Sticky notifications (`ttl: Infinity`) never auto-dismiss.
