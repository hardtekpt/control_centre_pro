import { create } from 'zustand'
import type { AppView, SettingsTab } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

interface AppState {
  /* ── Navigation ──────────────────────────────────────────────────────────── */
  /** The top-level view currently displayed */
  currentView: AppView
  /** Which tab is active inside the settings view */
  currentSettingsTab: SettingsTab

  /* ── Sidebar ─────────────────────────────────────────────────────────────── */
  /** True when the sidebar is collapsed to icon-only mode */
  sidebarCollapsed: boolean
  /** Sidebar width in pixels — only applied when not collapsed */
  sidebarWidth: number

  /* ── Window ──────────────────────────────────────────────────────────────── */
  /** Whether the OS window is currently maximized — drives the title bar icon */
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
}

/**
 * Global app state managed by Zustand.
 * Components call useAppStore() to read state and dispatch actions.
 * No Redux boilerplate — just a plain object with setter functions.
 */
export const useAppStore = create<AppState>((set) => ({
  currentView: 'home',
  currentSettingsTab: 'general',
  sidebarCollapsed: false,
  sidebarWidth: 240,
  isMaximized: false,
  theme: 'dark',

  setView: (view) => set({ currentView: view }),
  setSettingsTab: (tab) => set({ currentSettingsTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setTheme: (theme) => set({ theme }),
}))
