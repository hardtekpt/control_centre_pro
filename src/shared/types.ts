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

  // Native app menu popup
  MENU_SHOW: 'menu:show',

  // Navigation events pushed from main process (e.g. via menu actions)
  NAVIGATE: 'app:navigate',

  // Persistent settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Background service management
  SERVICES_LIST: 'services:list',           // renderer → main invoke
  SERVICES_SET_ENABLED: 'services:setEnabled', // renderer → main invoke
  SERVICES_STATE_CHANGE: 'services:stateChange', // main → renderer push

  // Per-service log stream
  SERVICE_LOG: 'service:log',               // main → renderer push

  // Arctis Nova Pro HID device events
  ARCTIS_GET_STATE: 'arctis:getState',      // renderer → main invoke
  ARCTIS_CONNECTED: 'arctis:connected',     // main → renderer push
  ARCTIS_DISCONNECTED: 'arctis:disconnected', // main → renderer push
  ARCTIS_EVENT: 'arctis:event',             // main → renderer push
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
export type AppView =
  | 'home'
  | 'gg-sonar'
  | 'shortcuts'
  | 'sonar-preset-switcher'
  | 'notifications'
  | 'settings'

/** Tabs within the settings view */
export type SettingsTab = 'general' | 'app' | 'gg-sonar' | 'ddc' | 'about'

/** Navigate targets that can be pushed from the main process */
export type NavigateTarget = AppView | 'settings:about'

// ─── Services ─────────────────────────────────────────────────────────────────

/** Describes a background service registered with the service manager */
export interface ServiceInfo {
  id: string
  name: string
  description: string
  enabled: boolean
  running: boolean
}

/** A single log entry emitted by a background service */
export interface LogEntry {
  id: string
  timestamp: number
  serviceId: string
  serviceName: string
  level: 'info' | 'warn' | 'error'
  message: string
}

// ─── Arctis Nova Pro HID ──────────────────────────────────────────────────────

/** Live state snapshot of the connected Arctis Nova Pro Wireless headset */
export interface ArctisState {
  batteryHeadset: number         // 0–100 %
  batteryDock: number            // 0–100 %
  ancMode: 'OFF' | 'TRANSPARENCY' | 'ANC'
  micMuted: boolean
  volume: number                 // 0–100 %
}
