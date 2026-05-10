import { create } from 'zustand'
import type { AppView, SettingsTab } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

/** Screen-space anchor point recorded when the sidebar button is hovered */
export interface PeekAnchor {
  /** Left edge of the sidebar toggle button */
  x: number
  /** Bottom edge of the top bar (where the floating panel will start) */
  bottom: number
}

/**
 * Module-level timer for the peek-hide delay.
 * Lives outside the store so it's shared between TopBar (starts the timer)
 * and FloatingSidebar (cancels it on mouse-enter) without needing a context.
 */
let _peekHideTimer: ReturnType<typeof setTimeout> | null = null

interface AppState {
  /* ── Navigation ──────────────────────────────────────────────────────────── */
  currentView: AppView
  currentSettingsTab: SettingsTab

  /* ── Sidebar ─────────────────────────────────────────────────────────────── */
  sidebarCollapsed: boolean
  sidebarWidth: number

  /**
   * Whether the floating peek panel is currently visible.
   * Only meaningful when sidebarCollapsed === true.
   */
  sidebarPeek: boolean

  /**
   * Screen-space anchor for the floating peek panel.
   * Captured from the button's getBoundingClientRect() when hover starts.
   */
  sidebarPeekAnchor: PeekAnchor | null

  /* ── Window ──────────────────────────────────────────────────────────────── */
  isMaximized: boolean

  /* ── Appearance ──────────────────────────────────────────────────────────── */
  theme: Theme

  /* ── Actions ─────────────────────────────────────────────────────────────── */
  setView: (view: AppView) => void
  setSettingsTab: (tab: SettingsTab) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setMaximized: (isMaximized: boolean) => void
  setTheme: (theme: Theme) => void

  /**
   * Show the floating peek panel anchored at the given screen position.
   * Cancels any pending hide timer so rapid hover-in/out doesn't flicker.
   */
  showPeek: (anchor: PeekAnchor) => void

  /**
   * Schedule hiding the peek panel after 180ms.
   * The delay lets the mouse travel from the button to the floating panel
   * without the panel disappearing mid-travel.
   */
  schedulePeekHide: () => void

  /** Cancel a pending hide (called when the mouse enters the floating panel) */
  cancelPeekHide: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'home',
  currentSettingsTab: 'general',
  sidebarCollapsed: false,
  sidebarWidth: 240,
  sidebarPeek: false,
  sidebarPeekAnchor: null,
  isMaximized: false,
  theme: 'dark',

  setView: (view) => set({ currentView: view }),
  setSettingsTab: (tab) => set({ currentSettingsTab: tab }),

  toggleSidebar: () => {
    // End any active peek when the user explicitly toggles
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    set((s) => ({
      sidebarCollapsed: !s.sidebarCollapsed,
      sidebarPeek: false,
      sidebarPeekAnchor: null,
    }))
  },

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setTheme: (theme) => set({ theme }),

  showPeek: (anchor) => {
    if (!get().sidebarCollapsed) return // no-op when already expanded
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    _peekHideTimer = null
    set({ sidebarPeek: true, sidebarPeekAnchor: anchor })
  },

  schedulePeekHide: () => {
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    _peekHideTimer = setTimeout(
      () => set({ sidebarPeek: false }),
      180
    )
  },

  cancelPeekHide: () => {
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    _peekHideTimer = null
  },
}))
