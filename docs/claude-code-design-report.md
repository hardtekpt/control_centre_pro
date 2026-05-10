# Claude Code Windows App — Design & Technology Report

> **Purpose**: Reference guide for building a Windows desktop application in the same visual style and spirit as the Claude Code desktop app.  
> **Date compiled**: May 2026  
> **Sources**: Official Anthropic documentation, product blog, brand resources, community analysis

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Technology Stack](#2-technology-stack)
3. [Brand & Color System](#3-brand--color-system)
4. [Typography](#4-typography)
5. [Layout Architecture](#5-layout-architecture)
6. [Sidebar — Detailed Behavior Guide](#6-sidebar--detailed-behavior-guide)
7. [Settings Page — Detailed Guide](#7-settings-page--detailed-guide)
8. [Window & Pane Resize Behavior](#8-window--pane-resize-behavior)
9. [UI Components & Patterns](#9-ui-components--patterns)
10. [Dark & Light Themes](#10-dark--light-themes)
11. [Interaction & Motion Design](#11-interaction--motion-design)
12. [Iconography & Visual Language](#12-iconography--visual-language)
13. [Design Philosophy & Principles](#13-design-philosophy--principles)
14. [Implementation Recommendations](#14-implementation-recommendations)

---

## 1. Product Overview

Claude Code is Anthropic's AI-powered coding assistant desktop application available for **macOS and Windows** (x64 and ARM64). The app integrates directly with codebases and provides a conversational + visual workspace for software development tasks.

The Windows version launched just ten days after the macOS debut (March 24, 2025), underscoring that cross-platform parity is a first-class concern. The app underwent a major redesign on **April 14, 2026**, which is the reference version for this document.

### Core App Tabs

The Claude desktop app is structured around three top-level tabs:

| Tab | Purpose |
|-----|---------|
| **Chat** | Conversational AI interactions |
| **Cowork** | Dispatch and long-running agentic work |
| **Code** | Software development workspace (the primary focus) |

### Key Platforms

- Desktop (macOS + Windows) — primary reference
- VS Code & JetBrains IDE extensions
- Terminal / CLI
- Web (claude.ai/code)
- iOS (mobile companion)
- Slack integration

---

## 2. Technology Stack

### Core Framework: Electron

The Claude desktop app is built with **Electron** — a framework that bundles a Chromium web engine with a Node.js backend. This is the same technology used by VS Code, Slack, and Figma's desktop client.

**Why Electron was chosen (from the Claude Code engineering team):**

- Some engineers had prior Electron experience and preferred building non-natively.
- Code sharing guarantees that **features across web and desktop have the same look and feel**.
- Claude itself is effective at generating Electron code, accelerating development.

**Known trade-offs (design implications):**

| Concern | Implication for your app |
|---------|--------------------------|
| Higher memory footprint (~200 MB+) | Expected and acceptable for this class of app |
| Non-native OS chrome | Must deliberately implement native-feeling UX (scrolling, focus, menus) |
| Chromium rendering | Full CSS/Web API support; pixel-perfect cross-platform layout |
| Performance | Must optimize React renders; avoid heavy re-renders in terminal/diff views |

### Electron Process Architecture

```
┌─────────────────────────────────────────┐
│           Main Process (Node.js)        │
│  - Window management                    │
│  - System tray / notifications          │
│  - File system access                   │
│  - IPC coordination                     │
│  - Auto-updater                         │
└──────────────┬──────────────────────────┘
               │  IPC Bridge (contextBridge)
┌──────────────▼──────────────────────────┐
│        Renderer Process (Chromium)      │
│  - React + TypeScript UI                │
│  - Session management                   │
│  - Chat + diff + terminal panes         │
│  - Preview browser (embedded)           │
└─────────────────────────────────────────┘
```

### Frontend Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Electron** (Chromium + Node.js) |
| UI Library | **React** + **TypeScript** |
| Layout | CSS Grid / Flexbox, custom Yoga-based layout for terminal |
| Terminal rendering | Custom ANSI/CSI/DEC/ESC/OSC parser + React reconciler |
| State management | React state + IPC events |
| Build/bundler | Inferred: Vite or Webpack |

### Terminal Layer (Deep Technical Detail)

The Claude Code terminal UI is particularly sophisticated — it is described as a "production-grade rendering engine" containing:

- A **custom React reconciler** for terminal output
- A **pure TypeScript port of the Yoga layout engine** (Facebook's cross-platform layout library)
- A **complete ANSI/CSI/DEC/ESC/OSC parser stack**
- Dozens of polished UI components battle-tested across 500,000+ daily sessions

### Deployment & Distribution

| Platform | Format |
|----------|--------|
| Windows | `.exe` installer or MSIX package |
| Windows ARM64 | Separate ARM64 installer |
| macOS | `.dmg` (Universal: Intel + Apple Silicon) |
| Enterprise MDM | Group Policy (Windows: `SOFTWARE\Policies\Claude`) |

---

## 3. Brand & Color System

Claude's color system is a deliberate counter-positioning against the cold, clinical aesthetic of other AI products. It uses **warm, terracotta-adjacent tones** instead of the cool grays and blues common in developer tooling.

### Brand Philosophy

> "Cream is central to the brand, emphasizing warmth and approachability over clinical coldness. The coral is warm and slightly muted — a deliberate counter-positioning against OpenAI's cool slate, Google's saturated blue, and Microsoft's corporate cyan."

### Core Color Palette

| Token | Hex | RGB | Role |
|-------|-----|-----|------|
| `claude-light` (Cream) | `#FAF9F5` | 250, 249, 245 | Primary background (light mode canvas) |
| `claude-dark` | `#141413` | 20, 20, 19 | Primary text / dark mode background |
| `claude-coral` (Primary accent) | `#CC785C` | 204, 120, 92 | Primary CTAs, brand wordmark, callout cards |
| `claude-brand-orange` | `#DE7356` | 222, 115, 86 | Brand logo color (Pantone 7416 C equivalent) |
| `claude-mid-gray` | `#B0AEA5` | 176, 174, 165 | Secondary text, inactive states |
| `claude-light-gray` | `#E8E6DC` | 232, 230, 220 | Borders, dividers, subtle backgrounds |

### Extended Palette (Dark Theme / Code Editor)

| Role | Hex | Notes |
|------|-----|-------|
| Dark background | `#1C1B19` (approx) | Warm dark, brown undertone — NOT cool gray |
| Active line highlight | Orange-tinted | Consistent with brand coral |
| Sidebar/panel surface | Slightly lighter than editor | Depth layering |
| Primary text (dark bg) | `#F5E6D3` | Warm cream, not stark white |
| Secondary text | `#C4A584` | Muted tan |
| Git add | `#98C379` | Warm green |
| Git modify | `#E67D22` | Brand-consistent orange |
| Git delete | `#E06C75` | Soft red |

### Color Rules

1. **No cool grays** — all neutrals have warm undertones (slightly yellow/brown, never blue-gray).
2. **No cyan or pure blue** as accent — coral/orange is the primary action color.
3. **Backgrounds layer from dark to slightly lighter**, not the reverse.
4. **Cream on dark** for readable text, not pure white (too harsh contrast).
5. The coral/orange accent appears on: primary buttons, active tab indicators, hover states, brand elements, and key interactive controls.

### Surface Depth Layers (Dark Mode)

The UI creates depth through sequential background lightening, not shadows:

```
Layer 0 (Base):     #141413  — app background
Layer 1 (Raised):   #1A1917  — sidebar, panel backgrounds
Layer 2 (Card):     #1F1E1C  — cards, dropdowns, popovers
Layer 3 (Elevated): #252320  — tooltips, floating menus
```

Each step is approximately +5–8 lightness points in the warm direction. Borders (`#2E2C28`) are used only when a background boundary would be ambiguous.

---

## 4. Typography

### Type System Approach

Claude's design system explicitly **avoids default system fonts** (Inter, Roboto, San Francisco) to establish brand distinctiveness. The philosophy is to choose fonts that feel editorial and considered, not generic.

### Recommended Typeface Stacks

| Context | Font | Fallback |
|---------|------|---------|
| UI / Interface | Considered custom or curated (not Inter) | `system-ui` |
| Body / Conversational text | Serif or warm sans-serif | `Georgia` |
| Code / Monospace | **JetBrains Mono** or **Fira Code** | `monospace` |
| Headings | Semi-bold weight, slightly larger tracking | — |

### Typography Characteristics

- **Minimal**: 2–3 type styles maximum across the entire app
- **Serif accents**: used selectively for a warm, editorial feel in headings and prose
- **Clean hierarchy**: clear size separation between levels (not subtle — 2pt+ jumps)
- **No decorative or display fonts** — functionality first
- **Code blocks**: distinct monospace treatment with consistent background fill and subtle border
- Italics used meaningfully (comments in code, emphasis in prose, not decoration)

### Text Sizing Principles

- Body/chat text: ≥14px for comfortable reading during long sessions
- UI chrome (labels, toolbar text): 12–13px
- Code/terminal output: 13px to maximize density
- Line height in conversational views: ≈1.6×
- Line height in code/diff views: ≈1.4×
- Letter spacing on headings: slightly loosened (+0.02em)

---

## 5. Layout Architecture

### Top-Level Structure

```
┌──────────────────────────────────────────────────────────────┐
│  [≡] Claude   [Chat] [Cowork] [Code]            [─][□][×]   │  ← Custom title bar
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│   SESSIONS    │             SESSION WORKSPACE                │
│   SIDEBAR     │                                              │
│  ─────────    │  ┌──────────────┬────────────────────────┐  │
│  [▼ Filter]   │  │   Chat Pane  │   Diff / Preview /     │  │
│               │  │              │   Terminal / File Pane  │  │
│  ● Session 1  │  │              │                        │  │
│  ○ Session 2  │  │              │                        │  │
│  ○ Session 3  │  ├──────────────┴────────────────────────┤  │
│               │  │         Tasks / Plan Pane              │  │
│  [+ New]      │  └────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────┐  │
│  [Customize]  │  │  [+] Prompt box...   [Mode▼] [⊙] [▶]  │  │
└───────────────┴──┴────────────────────────────────────────┴──┘
```

### Main Workspace Panes

All panes are **drag-and-drop repositionable** and **edge-resizable**. Available pane types:

| Pane | Purpose | Default Position |
|------|---------|-----------------|
| **Chat** | Conversational thread with Claude | Left/main |
| **Diff** | Visual file diff viewer | Right |
| **Preview** | Embedded browser / HTML / PDF / image | Right |
| **Terminal** | Integrated shell (Ctrl+\`) | Bottom |
| **File** | In-app file editor with save button | Right or bottom |
| **Plan** | Claude's proposed task plan (Plan mode) | Right |
| **Tasks** | Background subagent task monitor | Bottom |
| **Subagent** | Individual subagent output | Bottom |

Multiple panes can be open simultaneously in a grid. Two sessions can be viewed side-by-side by Ctrl-clicking a sidebar session.

### Prompt Area

Located at the bottom of the session:

```
┌────────────────────────────────────────────────────────────┐
│ [+]  Type your message or @mention a file...               │
│                                          [Mode▼] [⊙Mod▼] [▶]│
└────────────────────────────────────────────────────────────┘
```

- `[+]` opens submenu: file attachments, skills, connectors, plugins, slash commands
- `@` triggers inline file autocomplete dropdown (local/SSH sessions only)
- Mode selector: Ask / Auto accept edits / Plan / Auto / Bypass
- Model picker: Opus / Sonnet / Haiku with inline switcher
- Usage ring `⊙`: circular arc showing context window fill
- Send: Enter key or send button; `Esc` to stop mid-response

### Session Toolbar (Top of Active Session)

```
[Session Title ✎]  [Local ▼]  [main • repo-name ▼]  [+]  ···  [Views ▼] [Normal ▼] [⊙] [↗]
```

- Session title is **click-to-edit** inline
- Environment pill: Local / Remote / SSH (with connection name)
- Repo pill shows current branch; click to switch
- `+` adds additional repositories (remote sessions only)
- `···` overflow for less-common actions
- **Diff stats** (`+12 -1`) appear inline when code is changed — click to open diff pane
- **CI status bar** appears below toolbar after PR is opened: `● Checks: 3 passing` with Auto-fix and Auto-merge toggles
- Views menu: open/close specific panes
- Transcript dropdown: Normal / Verbose / Summary
- Usage ring: context fill indicator
- `↗` Continue In menu: send to web, open in IDE

---

## 6. Sidebar — Detailed Behavior Guide

The sidebar is the app's **mission control** — a persistent left panel that displays all sessions and enables rapid navigation and orchestration of parallel work.

### Visual Structure

```
┌─────────────────────────┐
│  [▼ Filter  ···]        │  ← Filter bar + overflow menu
│  ─────────────────────  │
│  ● api-refactor         │  ← Active session (highlighted)
│    main · local         │  ← Subtitle: branch · environment
│    +14 -2  ⏱ 3m ago     │  ← Diff stats + time
│  ─────────────────────  │
│  ○ fix-login-bug        │  ← Idle session
│    feat/login · local   │
│    ✓ PR merged          │  ← Auto-archive candidate
│  ─────────────────────  │
│  ◌ docs-update          │  ← Waiting / paused session
│    main · remote        │
│    [Dispatch]           │  ← Badge: phone-spawned
│                         │
│  [+ New session]        │  ← Sticky bottom of list
│  ─────────────────────  │
│  [⚙ Customize]          │  ← Connectors / plugins / skills
└─────────────────────────┘
```

### Dimensions & Sizing

- **Default width**: ~220–240px
- **Minimum width**: ~180px (below this the sidebar should collapse or be hidden)
- **Maximum width**: ~320px (capped to prevent over-expansion)
- The sidebar width is **user-resizable** by dragging the right edge
- Width preference is **persisted** across app restarts
- No explicit collapse button visible in the default state — the resize handle is the primary control

### Session Item — Anatomy

Each session row in the sidebar contains:

```
[●]  Session title (truncated with ellipsis)          [⊘]
      branch-name · environment                    (on hover)
      +N -N  ·  N minutes ago
```

| Element | Description |
|---------|-------------|
| Status dot `●` | Filled coral/orange = active; hollow `○` = idle; dotted `◌` = waiting/paused |
| Session title | User-editable name; defaults to first message summary |
| Branch · environment | Subtle secondary line, `#B0AEA5` color, smaller font |
| Diff stats | `+N -N` shown in green/red when there are uncommitted changes |
| Timestamp | Relative time since last activity (`3m ago`, `2h ago`) |
| Archive icon `⊘` | Appears **only on hover** over the row; hidden at rest |

### Session Item — States

| State | Dot Color | Row Background | Text Color |
|-------|-----------|----------------|------------|
| **Active** (selected) | Coral `#CC785C` | Slightly lighter than sidebar bg | `text-primary` |
| **Running** (Claude active) | Animated coral pulse | Sidebar bg | `text-primary` |
| **Idle** (awaiting input) | Hollow circle, `#B0AEA5` | Sidebar bg | `text-primary` |
| **Waiting** (permission prompt) | Dotted outline, orange | Sidebar bg + subtle left-border accent | `text-primary` |
| **Archived** | — | Dimmed/greyed row | `text-secondary` |
| **Dispatch-spawned** | Coral dot + `[Dispatch]` badge | Sidebar bg | `text-primary` |

### Hover Behavior

- Hovering a session row: background lightens slightly (1–2 steps up the surface scale), archive icon `⊘` fades in at the right edge
- Hovering the archive icon: icon fills/becomes opaque
- Clicking `⊘` archives the session immediately; row animates out with a collapse transition (~150ms)
- Hovering the resize handle (right edge of sidebar): cursor changes to `col-resize`; a thin 1px accent line appears

### Filter Bar

Positioned at the top of the session list, collapsible:

```
[▼ All]  [Project ▼]  [Env ▼]  [Group by project ☐]
```

- **Status filter**: All / Running / Waiting / Idle / Archived
- **Project filter**: Dropdown of all projects encountered in sessions
- **Environment filter**: Local / Remote / SSH
- **Group by project toggle**: When on, sessions are grouped under project name headers with a subtle section separator
- Filter state is **not persisted** — resets to "All" on restart

### New Session Button

- Fixed at the bottom of the session list (sticky, above `Customize`)
- Label: `+ New session`
- Style: ghost/outline button in the sidebar's accent color (`#CC785C` border, text matches)
- Keyboard: `Ctrl+N`
- Clicking opens the prompt area in a blank new session with the environment/model/folder configuration controls exposed

### Customize Link

- Fixed at the very bottom of the sidebar
- Small label: `⚙ Customize` or gear icon + text
- Opens the Connectors/Skills/Plugins management view (not a modal — replaces or overlays the workspace area)
- Secondary text color (`#B0AEA5`), smaller than session items

### Split Session View

- Hold `Ctrl` and click a sidebar session: that session opens in a **second pane alongside** the current one
- While split is active: clicking another sidebar item replaces the **focused** pane
- Focus is indicated by a subtle top-border accent line or slightly brighter background
- `Ctrl+\` closes the focused pane and returns to single-session view

### Auto-Archive Behavior

Sessions automatically archive (disappear from the active list) when:
- Their associated PR merges or closes (if Auto-archive is enabled in Settings → Claude Code)
- The user manually clicks the archive icon `⊘`

Archived sessions are not deleted — they can be retrieved via the status filter ("Archived"). The transition is a smooth row-height collapse animation.

### Sidebar Scroll Behavior

- Scrollable when session count exceeds visible height
- Custom scroll styling: thin scrollbar, warm-toned thumb, no visible track
- Scroll position is retained when switching between sessions
- Pinned elements (`+ New session`, `Customize`) remain visible and do not scroll

---

## 7. Settings Page — Detailed Guide

The Settings interface in Claude Code is accessed via the app menu (**Help → Settings** on Windows) or keyboard shortcut. It opens as a **modal dialog or a dedicated view** rather than a full-page navigation — the workspace remains in the background.

### Overall Settings Layout

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                          [×]  │
│ ─────────────────────────────────────────────────────── │
│  [General]  [Claude Code]  [Connectors]  [Account]     │  ← Tab navigation
│ ─────────────────────────────────────────────────────── │
│                                                         │
│  Section heading                                        │
│  ─────────────────────────────────                      │
│  Setting label                    [Toggle / Input]      │
│  Helper text below label                                │
│                                                         │
│  Section heading                                        │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

- Section headers are bold, slightly larger, followed by a 1px divider line
- Each setting row: label left-aligned, control right-aligned
- Helper text: 1–2 lines below the label in `text-secondary` color and smaller font
- Toggle switches: rounded pill style, coral/orange when on, gray when off
- Inputs: single-line, bordered, warm background (`--color-surface`)

### Section: General (Desktop App)

| Setting | Control | Notes |
|---------|---------|-------|
| Theme | Toggle or dropdown (Light / Dark / System) | System follows OS preference |
| Computer use | Toggle | Enables screen/app control; macOS requires extra permissions; not on Team/Enterprise |
| Denied apps | Multi-select input | Apps Claude cannot interact with even when computer use is on |
| Unhide windows when Claude finishes | Toggle | Default ON — restores minimized windows after computer use completes |
| Auto-update | Toggle | Default ON |
| Check for updates | Button | Manual update trigger |

### Section: Claude Code

This is the most detailed settings section, specific to the Code tab:

| Setting | Control | Default | Notes |
|---------|---------|---------|-------|
| Worktree location | Path input + browse button | `<project>/.claude/worktrees/` | Where Git worktrees are stored |
| Branch prefix | Text input | (empty) | Prefix added to all worktree branch names |
| Auto-archive after PR merge or close | Toggle | OFF | Archives sessions automatically when PR closes |
| Allow bypass permissions mode | Toggle | OFF | Enables the `Bypass permissions` mode option in the mode selector |
| Auto mode | Toggle | OFF | Enables the `Auto` mode option; only on Max/Team/Enterprise/API |
| Preview | Toggle | ON | Enables the embedded preview pane feature |
| Persist preview sessions | Toggle | ON | Preserves cookies/localStorage between dev server restarts |
| Auto-verify changes | Toggle | ON (per-project via launch.json) | Claude takes screenshots to verify changes after edits |
| Extended thinking | Toggle | ON | Enables deep reasoning on complex tasks; uses more tokens |
| MAX_THINKING_TOKENS | Number input | (model default) | Override thinking budget; set to 0 to disable |
| Connectors for Code | Sub-section | — | Manage which MCP connectors are active in Code sessions |

### Section: Connectors

Accessed via `Settings → Connectors` or `Customize → Connectors` in the sidebar:

```
┌───────────────────────────────────────────────────────┐
│  Connectors                                    [+ Add] │
│ ─────────────────────────────────────────────────────  │
│  [GitHub]    Connected ●                    [Manage ▼] │
│  [Slack]     Connected ●                    [Manage ▼] │
│  [Linear]    Not connected ○                [Connect]  │
│  [Notion]    Not connected ○                [Connect]  │
│  ...                                                   │
└───────────────────────────────────────────────────────┘
```

Each connected service expands to show **Tool permissions**:

```
  GitHub — Tool permissions
  ─────────────────────────
  Read-only tools
    Read repositories          [Always allow ▼]
    Read issues                [Always allow ▼]
  
  Write tools
    Create pull requests       [Needs approval ▼]
    Push commits               [Needs approval ▼]
  
  Delete tools
    Delete branches            [Blocked ▼]
  
  Tool access   [Auto ▼]   (Auto or On demand)
  
  [Disconnect]  [Test connection]
```

Permission levels for each tool:
- **Always allow**: Claude uses the tool without prompting
- **Needs approval**: Claude shows an inline prompt before each use
- **Blocked**: Tool is disabled; Claude cannot use it

Tool access mode:
- **Auto** (default): Claude decides when to load and use the connector
- **On demand**: Connector loads only when explicitly invoked

### Section: Account

| Setting | Control | Notes |
|---------|---------|-------|
| Account email | Read-only display | Shows signed-in email |
| Plan | Read-only display | Pro / Max / Team / Enterprise |
| Usage this period | Read-only counter | Token/request consumption |
| Sign out | Button | Signs out from the desktop app |
| Manage subscription | Link | Opens browser to billing portal |

### Settings Visual Style

- **Background**: `--color-bg` (cream or dark depending on theme) — same as the app canvas
- **Modal container**: slightly elevated surface (`--color-surface`), 1px border (`--color-border`), rounded corners (~8px), centered on screen
- **Tab bar**: horizontal, text tabs with an underline indicator on the active tab using the coral accent color
- **Toggles**: pill-shaped; 40×24px approximately; thumb slides with a 100ms ease transition; coral fill when ON, neutral fill when OFF
- **Section dividers**: 1px, `--color-border`, full width
- **Buttons in settings**: secondary/ghost style for most; coral primary only for destructive-confirm (e.g., disconnect, sign out)
- **Path inputs**: monospace font, truncated left-to-right with browse `...` button

---

## 8. Window & Pane Resize Behavior

### App Window Sizing

- **Default launch size**: approximately 1200×800px — large enough to show sidebar + two panes comfortably
- **Minimum window size**: approximately 800×600px — below this the layout begins to degrade
- **Resizing behavior**: fully fluid; all panes reflow in real time as the window is dragged
- **Maximise**: standard OS maximize; app fills screen, layout stretches proportionally
- **Window position and size**: persisted across app restarts (saved in Electron's app data)
- **Multi-monitor**: window appears on the last-used monitor at last-used position/size
- **DPI awareness**: app renders at native DPI (no blurry scaling on HiDPI/4K displays)

### Title Bar

On Windows, Claude uses a **custom frameless title bar** (Electron `frame: false`):
- Draws its own window chrome in the app's warm dark/cream color
- Left side: app icon + tab navigation (`Chat` / `Cowork` / `Code`)
- Right side: standard Windows window controls (minimize `—`, maximize `□`, close `×`) rendered in the app's style, not native Win32 chrome
- Title bar is a **drag region** — clicking and dragging anywhere on the title bar (except controls) moves the window
- Double-click on the title bar: toggles maximize/restore

### Pane Resize — Behavior Guide

Panes within the workspace use a **split-panel** layout system (similar to `react-resizable-panels`):

**Dragging a pane edge:**
- Cursor changes to `col-resize` or `row-resize` on hover over the divider
- Divider highlights (brightens) on hover — typically 2–4px wide, accent color on hover
- Live reflow: panes resize in real time while dragging, no ghost/preview overlay
- Both adjacent panes resize together (pull left = right pane expands, left pane shrinks)

**Minimum pane size:**
- Each pane has a minimum width/height (~200px) to prevent it from becoming unusable
- When dragging past the minimum, the pane **snaps closed** (collapses to zero height/width), effectively hiding it
- The divider remains at the edge to allow re-expansion
- A collapsed pane can be reopened from the **Views menu** or by dragging its edge outward

**Pane drag-to-reorder:**
- Drag a pane by its **header tab** (the strip at the top of the pane containing its name)
- A **drop zone highlight** appears over valid target positions as you drag
- Drop targets: swap with another pane, or drop into a new row/column split
- Snap-to-grid: panes snap into the available grid positions; no arbitrary freeform placement
- Pane layout is **persisted per-session** (remembered when you return to that session)

### Sidebar Resize

- Drag the right edge of the sidebar to resize it
- Cursor becomes `col-resize` on hover over the ~4px wide drag handle
- No explicit collapse button — drag to minimum width (~50px icon-only state) to collapse, or close to 0 to hide
- Minimum usable width: ~180px (shows session names); icon-only mode at ~56px (shows status dots only)
- A collapsed sidebar can be re-expanded by clicking the icon strip or dragging the handle outward

### Terminal Pane Resize

The integrated terminal has additional complexity:
- Terminal character dimensions (columns × rows) recalculate on every resize event
- A full terminal redraw is triggered on resize — this is unavoidable but should complete in <16ms
- Rapid resize dragging (many intermediate widths) can produce visible redraws; this is a known trade-off
- **Minimum terminal height**: approximately 4 lines of text (enough to see output without wrapping)

### Scroll Behavior in Panes

- **Chat pane**: auto-scrolls to the bottom when Claude is streaming; user can scroll up to read history without breaking the auto-scroll — when the user scrolls up, auto-scroll pauses; it resumes when the user scrolls back to the bottom
- **Terminal pane**: scroll-back buffer preserved; auto-scrolls to latest output unless user has scrolled up
- **Diff pane**: independent scroll per file selected in the file list
- **File pane**: standard editor scroll; line numbers visible; current line highlighted

### Window Minimize / Restore

- Minimizing the window pauses no active sessions — Claude continues running in the background
- Remote sessions continue even if the window is fully closed (quit)
- Local sessions stop when the app is quit (process is terminated)
- Push notifications (OS-native) arrive when CI finishes or sessions need approval — clicking the notification restores and focuses the app

---

## 9. UI Components & Patterns

### Buttons

- **Primary**: Coral/orange fill (`#CC785C`), white text, ~6px border radius
- **Secondary**: Ghost/outline style, `1px solid #CC785C` border or neutral border
- **Destructive**: Red fill or red text; secondary ghost style until confirmation step
- **Icon buttons**: 28–32px hit target, icon-only with tooltip on 400ms hover delay
- **Stop button**: Square stop icon (■), visible only while Claude is generating; disappears when idle

### Cards & Panels

- Subtle raised surface using background-only depth (no box-shadow)
- Warm off-white (`#F0EDE4`) in light mode; `#1F1E1C` in dark mode
- Consistent internal padding: 16px
- Border radius: 6–8px
- Borders: 1px `#E8E6DC` (light) or `#2E2C28` (dark), used only when two adjacent surfaces have identical background colors

### Diff View

- Left panel: scrollable file list with change summary (+N / -N per file)
- Right panel: unified diff only (no split view)
- Added lines: warm green background `rgba(152, 195, 121, 0.15)`, `+` gutter marker in `#98C379`
- Removed lines: warm red background `rgba(224, 108, 117, 0.15)`, `-` gutter marker in `#E06C75`
- Click any line: comment box appears inline below that line
- Submit all comments: `Ctrl+Enter`
- `Review code` button: top-right of the pane header, triggers Claude code review

### Diff Stats Indicator

Shown inline in the session toolbar when there are uncommitted changes:

```
+12 -1
```

- `+N` in green (`#98C379`), `-N` in red (`#E06C75`)
- Click → opens/focuses the diff pane
- Disappears when all changes are committed or reverted

### Badges & Status Indicators

| State | Visual |
|-------|--------|
| Active / Running | Filled coral dot `●`, may pulse softly |
| Idle | Hollow circle `○`, `#B0AEA5` |
| Waiting (needs input) | Dotted/animated border, orange |
| Completed | Checkmark `✓`, warm green |
| Dispatch-spawned | `Dispatch` text badge, secondary color, small caps |
| CI Passing | Green `●` + "Checks: N passing" |
| CI Failing | Red `●` + failure count |
| PR Open | Badge with PR number |

### Menus & Dropdowns

- Drop-down list with `1–9` keyboard selection for quick item picking
- Consistent `▼` arrow indicator; rotates `▲` when open
- Grouped items: subtle 1px separator between groups, group label in `text-secondary`
- Keyboard shortcut shown right-aligned in muted text within menu items
- Maximum dropdown height: ~300px with internal scroll
- Dropdowns use `--color-surface` background, `1px` border, `6px` radius, subtle shadow (`0 4px 12px rgba(0,0,0,0.15)`)

### Toggles (Settings-style)

- Pill shape, 40×24px
- Thumb: white circle, 18×18px, 2px inset from edges
- ON state: coral fill `#CC785C`, thumb at right
- OFF state: `#B0AEA5` fill, thumb at left
- Transition: `thumb left/right` + `background-color`, 100ms ease
- Disabled: 40% opacity, `not-allowed` cursor

### Notification & Progress

- Context window: **usage ring** (SVG arc) at ~24px size; fills clockwise from 0–100%; color shifts from neutral → orange → red as it approaches capacity
- CI progress: linear bar or status dot
- Desktop notifications (OS-native toast): used for CI completion, session approval requests

### Permission Prompt (Inline)

```
┌────────────────────────────────────────────────────┐
│ ⚠ Claude wants to run: git push origin feat/login  │
│                                                    │
│ [Allow for this session]        [Deny]             │
└────────────────────────────────────────────────────┘
```

- Appears inline in the chat thread, not a modal
- Describes the exact command or action
- High-risk apps (terminals, file browsers) get a warning icon and additional context text
- Approval lasts the session; Dispatch-spawned sessions expire after 30 minutes

### Side Chat Overlay

- Invoked via `Ctrl+;` or typing `/btw` in the prompt
- Appears as a **panel overlay** on the right side of the workspace
- Has its own independent prompt box
- Does not send output back to the main thread — read-only access to context
- Visually distinct: slightly elevated background, subtle left or top border in accent color
- Dismiss: click outside, press `Esc`, or close the pane via `Ctrl+\`

### @mention Autocomplete

- Triggered by typing `@` in the prompt box
- Inline dropdown appears below the cursor: lists files matching the typed prefix
- Keyboard navigable (↑↓ + Enter); `Esc` dismisses
- Each item shows: file icon, filename, relative path in `text-secondary`
- Maximum 8 items visible; scrollable for more
- Available in local and SSH sessions only (not remote)

---

## 10. Dark & Light Themes

### Light Mode Aesthetic

| Element | Value |
|---------|-------|
| App background | `#FAF9F5` (warm cream) |
| Panel / card background | `#F0EDE4` (slightly darker cream) |
| Primary text | `#141413` (near-black, warm) |
| Secondary text | `#B0AEA5` (warm mid-gray) |
| Borders / dividers | `#E8E6DC` (warm light gray) |
| Primary accent | `#CC785C` (coral) |
| Code background | `#EDEBE3` (warm tinted surface) |
| Input background | `#F5F4F0` |
| Hover overlay | `rgba(0,0,0,0.04)` |
| Active/selected | `rgba(204,120,92,0.10)` (coral tint) |

### Dark Mode Aesthetic

| Element | Value |
|---------|-------|
| App background | `#141413` |
| Panel / card background | `#1F1E1C` |
| Primary text | `#F5E6D3` (warm cream) |
| Secondary text | `#C4A584` (muted tan) |
| Borders / dividers | `#2E2C28` |
| Primary accent | `#E67D22` – `#CC785C` |
| Terminal background | `#141413` |
| Input background | `#1A1917` |
| Hover overlay | `rgba(255,255,255,0.05)` |
| Active/selected | `rgba(230,125,34,0.15)` (orange tint) |

### Theme Switching

- System default follows OS preference
- Toggle in Settings → General
- Both themes maintain **warm color temperature** — dark mode is NOT a blue-dark
- The 2026 redesign updated dark mode; some users preferred the prior version, indicating that the exact dark tone is a matter of active refinement

---

## 11. Interaction & Motion Design

### Principles

- **Functional animation only**: transitions convey state change, not decoration
- **Fast and snappy**: 100–200ms for state changes, never more than 300ms for layout transitions
- **Streaming text**: Claude's responses stream character by character — this is a core, defining interaction
- **Interrupt at any time**: stop button always visible during generation; `Esc` always works

### Key Interactions

| Interaction | Behavior |
|------------|---------|
| Pane resize (edge drag) | Live reflow at 60fps; no ghost overlay |
| Pane snap-close | Spring-snaps to 0 past minimum size; edge remains draggable to reopen |
| Pane reorder (header drag) | Drop-zone highlights at valid targets |
| Session switch | Instant; no loading state; previous session state preserved |
| Diff stats click | Pane slides in or expands; diff loads instantly |
| Stop button / Esc | Immediate halt; Claude sends acknowledgement in the chat |
| @mention autocomplete | Dropdown fades in (~80ms), navigable by keyboard |
| Streaming response | Token-by-token; cursor blinks at end of stream |
| Toggle ON/OFF | 100ms ease, thumb translates |
| Modal open | Fade-in + scale up from 0.95 → 1.0 over 150ms |
| Session archive | Row collapses to 0 height over 150ms |
| Sidebar resize | Live drag; width is clamped to min/max |

### Keyboard-First Design

Every major action has a shortcut. The full list is always accessible via `Ctrl+/`:

| Shortcut (Windows) | Action |
|---------------------|--------|
| `Ctrl+N` | New session |
| `Ctrl+W` | Close session |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle sessions (next / previous) |
| `Ctrl+Shift+]` / `Ctrl+Shift+[` | Next / previous session (alt) |
| `Esc` | Stop Claude's response |
| `Ctrl+Shift+D` | Toggle diff pane |
| `Ctrl+Shift+P` | Toggle preview pane |
| `Ctrl+Shift+S` | Select an element in preview |
| `Ctrl+\`` | Toggle terminal pane |
| `Ctrl+\` | Close focused pane |
| `Ctrl+;` | Open side chat |
| `Ctrl+O` | Cycle view modes (Normal → Verbose → Summary) |
| `Ctrl+Shift+M` | Open permission mode menu |
| `Ctrl+Shift+I` | Open model menu |
| `Ctrl+Shift+E` | Open effort menu |
| `1`–`9` | Select numbered item in any open menu |
| `Ctrl+/` | Show all shortcuts |
| `Ctrl+Enter` (in diff) | Submit all line comments |

---

## 12. Iconography & Visual Language

### Icon Style

- **Minimal and functional** — icons reinforce meaning, never decorate
- **Line icons** preferred over filled, except for active/selected states (which fill with accent)
- Consistent 1.5px stroke weight
- Icon sizes: 16px in dense toolbars, 20px in sidebars and menus, 24px+ in empty states
- Platform logos (Windows, macOS) used contextually for setup/download flows only

### Visual Metaphors

| Concept | Visual |
|---------|--------|
| Sessions | Status dot + text row |
| Active/Running | Filled coral dot, optional pulse animation |
| Git branch | Branch fork icon near session title |
| Diff / Changes | `+/-` markers; green/red |
| CI status | Circle with checkmark or ×; colored ring |
| Usage / Context | Arc/ring fill (SVG) |
| Dispatch (phone-origin) | Text badge: `Dispatch` |
| Pane close | `×` in pane header (appears on hover) |
| Overflow actions | `···` horizontal ellipsis |
| Drag handle | `⠿` or `⠿` dotgrid (appears on pane headers on hover) |

### Empty & Loading States

- Empty session list: centered prompt — "Start a new session with `Ctrl+N`" — no heavy illustration
- Pane loading: a minimal single-line shimmer bar, not a full-pane spinner
- Error states: inline red text with an action link; never a blocking modal
- First-time state: guided prompt inside the empty workspace to configure environment/project

---

## 13. Design Philosophy & Principles

### 1. Warmth Over Sterility

Claude is intentionally designed to feel **warm and approachable** in an industry dominated by cold, clinical interfaces. Every color, font, and surface reflects this.

> "The warm terracotta orange and cream backgrounds invite conversation, giving the sense of talking with something thoughtful rather than querying a database."

### 2. Developer-Respecting Density

The interface is built for professionals who spend all day in it:
- High information density without clutter
- Keyboard shortcuts for nearly every action
- Multiple view modes (Verbose / Normal / Summary) to match working style
- No unnecessary whitespace when it reduces utility

### 3. Parity Across Surfaces

The same React codebase powers both web and desktop — visual identity is **identical across platforms**. This is a deliberate architectural and design choice. The desktop app is not a "desktop port" — it is the canonical app.

### 4. Progressive Complexity

- New users start with `Ask permissions` — Claude asks before every action
- Power users opt into `Auto accept edits` or `Auto` mode
- The UI reflects this: safe defaults, opt-in power features, nothing hidden in obscure config files

### 5. Code as First-Class Content

Code and diffs are treated with the same care as the conversational UI — the diff viewer, terminal, and file editor are not afterthoughts. Syntax highlighting, readable monospace fonts, and inline actions are as considered as the chat message design.

### 6. Minimal Decoration

- No heavy drop shadows or glassmorphism
- No gradients (especially no purple gradients — explicitly avoided by the design team)
- No avatars in the chat thread — the conversation is the focus
- Borders and dividers used sparingly, only where a background boundary would be ambiguous

### 7. Avoiding "AI Slop" Aesthetics

Anthropic's design explicitly avoids:
- Generic sans-serif defaults (Inter, Roboto) — they produce "statistical center" design
- Purple gradient hero sections
- Three rounded white cards on white backgrounds
- Blue primary buttons on neutral backgrounds
- Emoji decoration
- Rounded containers with colored left-border accents

The goal: look **distinctive and considered**, not like every other AI product.

### 8. Single-Window Philosophy

Everything happens in one window — parallel sessions, split views, side chats. The user never needs to manage multiple app windows. This places significant responsibility on the layout system (sidebar + draggable panes) but keeps cognitive load low.

---

## 14. Implementation Recommendations

### Technology

```
Recommended Stack:
- Electron (latest stable)
- React 18+ with TypeScript
- Tailwind CSS with custom design tokens (matching Claude palette)
  OR CSS Modules with CSS custom properties
- react-resizable-panels for pane layout
- Vite for bundling
- electron-builder for packaging (.exe / MSIX)
```

### Color Token Setup

```css
:root {
  /* Light mode */
  --color-bg:              #FAF9F5;
  --color-surface:         #F0EDE4;
  --color-surface-raised:  #EDEBE3;
  --color-border:          #E8E6DC;
  --color-text-primary:    #141413;
  --color-text-secondary:  #B0AEA5;
  --color-accent:          #CC785C;
  --color-accent-hover:    #B86848;
  --color-accent-subtle:   rgba(204, 120, 92, 0.10);
  --color-hover-overlay:   rgba(0, 0, 0, 0.04);
  --color-code-bg:         #EDEBE3;
}

[data-theme="dark"] {
  --color-bg:              #141413;
  --color-surface:         #1A1917;
  --color-surface-raised:  #1F1E1C;
  --color-border:          #2E2C28;
  --color-text-primary:    #F5E6D3;
  --color-text-secondary:  #C4A584;
  --color-accent:          #E67D22;
  --color-accent-hover:    #F08C38;
  --color-accent-subtle:   rgba(230, 125, 34, 0.15);
  --color-hover-overlay:   rgba(255, 255, 255, 0.05);
  --color-code-bg:         #1A1917;
}
```

### Sidebar Implementation Pattern

```tsx
<Sidebar
  defaultWidth={240}
  minWidth={180}
  maxWidth={320}
  collapsedWidth={56}        // icon-only mode
  persistWidth                // save to localStorage
>
  <SidebarHeader>
    <FilterBar />
  </SidebarHeader>

  <SessionList>
    {sessions.map(s => (
      <SessionItem
        key={s.id}
        session={s}
        isActive={s.id === activeId}
        onSelect={() => setActive(s.id)}
        onArchive={() => archive(s.id)}
        // Archive icon only renders on hover (CSS: opacity-0 group-hover:opacity-100)
      />
    ))}
  </SessionList>

  <SidebarFooter>
    <NewSessionButton />
    <CustomizeLink />
  </SidebarFooter>
</Sidebar>
```

### Pane Layout Pattern

```tsx
<PanelGroup direction="horizontal" autoSaveId="workspace-layout">
  <Panel defaultSize={45} minSize={25}>
    <ChatPane />
  </Panel>

  <PanelResizeHandle className="resize-handle" />

  <Panel defaultSize={55} minSize={25}>
    <PanelGroup direction="vertical">
      <Panel defaultSize={65} minSize={20}>
        <DiffPane />
      </Panel>
      <PanelResizeHandle className="resize-handle-horizontal" />
      <Panel defaultSize={35} minSize={15} collapsible>
        <TerminalPane />
      </Panel>
    </PanelGroup>
  </Panel>
</PanelGroup>
```

### Settings Page Pattern

```tsx
<SettingsModal>
  <SettingsTabs>
    <Tab label="General">
      <SettingsSection title="Desktop app">
        <SettingRow
          label="Theme"
          helper="Controls the app's color scheme"
        >
          <Select options={["System", "Light", "Dark"]} />
        </SettingRow>
        <SettingRow label="Computer use" helper="Allow Claude to control your screen">
          <Toggle />
        </SettingRow>
      </SettingsSection>
    </Tab>

    <Tab label="Claude Code">
      <SettingsSection title="Sessions">
        <SettingRow label="Worktree location" helper="Where Git worktrees are stored">
          <PathInput browsable />
        </SettingRow>
        <SettingRow label="Auto-archive after PR merge or close">
          <Toggle defaultOff />
        </SettingRow>
      </SettingsSection>
    </Tab>
  </SettingsTabs>
</SettingsModal>
```

### Window Resize Rules to Implement

```
Minimum app window:    800 × 600px
Default app window:    1200 × 800px
Sidebar min width:     180px
Sidebar max width:     320px
Sidebar icon-only:     56px
Pane minimum width:    200px
Pane minimum height:   120px
Terminal minimum:      4 lines of text height
```

### Key Design Rules Summary

1. **Use warm tones everywhere** — no cool grays
2. **Coral/orange is the ONLY accent color** — not blue, not purple
3. **Cream background in light mode** (`#FAF9F5`) — not white
4. **Dark background must be warm dark** (`#141413`) — not a blue-dark like `#1a1a2e`
5. **No heavy shadows** — use background layers for depth
6. **Sidebar items**: status dot + title + subtitle + hover-reveal archive icon
7. **Settings**: tabs across the top, rows with right-aligned controls, section headers with dividers
8. **Panes**: drag edges to resize live, drag headers to reorder, snap-close past minimum
9. **Typography: choose something distinctive** — avoid Inter/Roboto defaults
10. **JetBrains Mono or Fira Code** for all code/terminal text
11. **Every major action must have a keyboard shortcut**
12. **Streaming text is a core UX pattern** — implement character-by-character output
13. **Persist layout state** — sidebar width, pane sizes, last window position

---

## Sources

- [Claude Code Official Product Page](https://claude.com/product/claude-code)
- [Claude Code Desktop Documentation](https://code.claude.com/docs/en/desktop)
- [Claude Code Desktop Redesign Blog Post](https://claude.com/blog/claude-code-desktop-redesign)
- [Why is Claude an Electron App? — dbreunig.com](https://www.dbreunig.com/2026/02/21/why-is-claude-an-electron-app.html)
- [Claude Brand Color Codes — BrandColorCode.com](https://www.brandcolorcode.com/claude)
- [Use Connectors to Extend Claude's Capabilities — Anthropic Support](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)
- [Claude Code Desktop Redesign 2026 — BuildFastWithAI](https://www.buildfastwithai.com/blogs/claude-code-desktop-redesign-2026)
- [Claude Code Desktop Redesign: Parallel Sessions — Miraflow](https://miraflow.ai/blog/claude-code-desktop-redesign-parallel-sessions-routines-workspace-guide)
- [Anthropic Rebuilds Claude Code Desktop App — MacRumors](https://www.macrumors.com/2026/04/15/anthropic-rebuilds-claude-code-desktop-app/)
- [Claude Code Desktop Redesign Hands-On — FindSkill.ai](https://findskill.ai/blog/claude-code-desktop-redesign-review/)
- [Claude Code Just Redesigned Its App for Parallel Sessions — DevToolPicks](https://devtoolpicks.com/blog/claude-code-desktop-redesign-parallel-sessions-2026)
- [Claude Code Inspired Dark Theme — GitHub](https://github.com/ericbuess/claude-code-inspired-dark)
- [Prompting for Frontend Aesthetics — Anthropic Cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [I Studied Claude Code's Leaked Source — DEV Community](https://dev.to/minnzen/i-studied-claude-codes-leaked-source-and-built-a-terminal-ui-toolkit-from-it-4poh)
- [Bulk-manage Sidebar Sessions — GitHub Issues](https://github.com/anthropics/claude-code/issues/54044)
- [Claude Code Window Resize Bug — GitHub Issues](https://github.com/anthropics/claude-code/issues/6481)
