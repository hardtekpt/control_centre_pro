/**
 * Shared types between the main process (Node.js) and renderer process (React).
 * Both sides import from this file — no magic strings anywhere.
 */

// ─── IPC Channel Names ───────────────────────────────────────────────────────

/** All IPC channel identifiers used across main ↔ renderer communication */
export const IPC_CHANNELS = {
  // Window control
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_STATE_CHANGE: 'window:stateChange', // main → renderer push event

  // Persistent settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
} as const

/** Union of all valid IPC channel strings */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ─── Settings ────────────────────────────────────────────────────────────────

/** App-wide settings persisted to disk */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  sidebarCollapsed: boolean
}

/** Defaults applied when no saved settings exist */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sidebarWidth: 240,
  sidebarCollapsed: false,
}

// ─── Navigation ──────────────────────────────────────────────────────────────

/** Top-level views the app can show */
export type AppView = 'home' | 'settings'

/** Tabs within the settings view */
export type SettingsTab = 'general' | 'about'
