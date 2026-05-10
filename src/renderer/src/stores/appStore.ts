import { create } from 'zustand'
import type { AppView, SettingsTab } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

/**
 * Module-level timer for the sidebar peek-hide delay.
 * Lives outside the store so it persists across renders and is shared between
 * TopBar (which starts the timer) and Sidebar (which cancels it on mouse-enter).
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
   * Temporary "peek" — sidebar is visually expanded even though it's in
   * collapsed state (triggered by hovering the sidebar-toggle icon in TopBar).
   */
  sidebarPeek: boolean

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

  // Peek actions — used by TopBar icon (show) and Sidebar (cancel/hide)
  showPeek: () => void
  schedulePeekHide: () => void
  cancelPeekHide: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'home',
  currentSettingsTab: 'general',
  sidebarCollapsed: false,
  sidebarWidth: 240,
  sidebarPeek: false,
  isMaximized: false,
  theme: 'dark',

  setView: (view) => set({ currentView: view }),
  setSettingsTab: (tab) => set({ currentSettingsTab: tab }),
  toggleSidebar: () => {
    // When collapsing, also end any active peek
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed, sidebarPeek: false }))
  },
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setTheme: (theme) => set({ theme }),

  /** Show sidebar instantly (no delay) when the icon is hovered */
  showPeek: () => {
    if (!get().sidebarCollapsed) return // no-op if already expanded
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    _peekHideTimer = null
    set({ sidebarPeek: true })
  },

  /**
   * Schedule sidebar collapse after 180ms.
   * The delay gives the mouse time to travel from the TopBar icon to the
   * sidebar without the sidebar snapping closed mid-travel.
   */
  schedulePeekHide: () => {
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    _peekHideTimer = setTimeout(() => set({ sidebarPeek: false }), 180)
  },

  /** Cancel a pending peek-hide (called when the mouse enters the sidebar) */
  cancelPeekHide: () => {
    if (_peekHideTimer) clearTimeout(_peekHideTimer)
    _peekHideTimer = null
  },
}))
