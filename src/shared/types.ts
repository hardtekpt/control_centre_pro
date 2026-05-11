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
  SERVICES_GET_CONFIG: 'services:getConfig', // renderer → main invoke
  SERVICES_SET_PYTHON_PATH: 'services:setPythonPath', // renderer → main invoke

  // Per-service log stream
  SERVICE_LOG: 'service:log',               // main → renderer push

  // Arctis Nova Pro HID device events
  ARCTIS_GET_STATE: 'arctis:getState',      // renderer → main invoke
  ARCTIS_CONNECTED: 'arctis:connected',     // main → renderer push
  ARCTIS_DISCONNECTED: 'arctis:disconnected', // main → renderer push
  ARCTIS_EVENT: 'arctis:event',             // main → renderer push
  ARCTIS_CMD: 'arctis:cmd',                 // renderer → main invoke (write/query command)
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

/** Global configuration for all services */
export interface ServiceConfig {
  pythonPath: string
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

/**
 * Screen-dim / auto-off timeout — mirrors arctis_hid.TimeoutStep enum.
 * OFF = disabled; other values are the inactivity delay before triggering.
 */
export type TimeoutStep =
  | 'OFF'
  | 'ONE_MIN'
  | 'FIVE_MIN'
  | 'TEN_MIN'
  | 'FIFTEEN_MIN'
  | 'THIRTY_MIN'
  | 'SIXTY_MIN'


/** Live state snapshot of the connected Arctis Nova Pro Wireless headset */
export interface ArctisState {
  // ── Status ──────────────────────────────────────────────────────────────────
  batteryHeadset: number         // 0–100 %
  batteryDock: number            // 0–100 %
  micMuted: boolean
  volume: number                 // 0–100 %

  // ── Connectivity ────────────────────────────────────────────────────────────
  wirelessConnected: boolean     // 2.4 GHz link active
  btActive: boolean              // Bluetooth radio is on
  btConnected: boolean           // a BT device is paired and connected
  btPairing: boolean             // headset is in BT pairing mode

  // ── ANC ─────────────────────────────────────────────────────────────────────
  ancMode: 'OFF' | 'TRANSPARENCY' | 'ANC'   // AncMode enum
  transparencyLevel: number      // 1–10

  // ── Audio Options ────────────────────────────────────────────────────────────
  micGain: 'LOW' | 'HIGH'                           // GainLevel enum
  sidetone: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH'      // SidetoneLevel enum
  micVolume: number                                 // 1–10

  // ── Wireless ────────────────────────────────────────────────────────────────
  wirelessMode: 'PERFORMANCE' | 'EXTENDED_RANGE'    // WirelessMode enum
  btDefault: boolean
  btAutoMute: 'OFF' | 'DB_MINUS_12' | 'FULL'       // BtAutoMute enum

  // ── ChatMix (hardware dial) ───────────────────────────────────────────────────
  chatmixEnabled: boolean        // dial active; false = flat 50/50 mix
  chatmixGame: number            // 0–100
  chatmixChat: number            // 0–100

  // ── Audio Output ────────────────────────────────────────────────────────────
  audioOutput: 'SPEAKERS' | 'STREAM'                // AudioOutput enum
  streamMain: number             // 0–100
  streamAux: number              // 0–100
  streamMic: number              // 0–100

  // ── Base Station ─────────────────────────────────────────────────────────────
  oledBrightness: number         // 1–10
  dimTimeout: TimeoutStep        // TimeoutStep enum
  homescreenMode: 'DETAILED' | 'SIMPLE'             // HomeScreenMode enum
  micLedBrightness: number       // 1–10
  autoOffTimeout: TimeoutStep    // TimeoutStep enum

  // ── EQ ───────────────────────────────────────────────────────────────────────
  eqPresetIndex: number          // 0x04 = custom; 0x00–0x03 and 0x05–0x18 = named presets
  eqBands: number[]              // 10 band levels, 0–40 (20 = flat / 0 dB)
}
