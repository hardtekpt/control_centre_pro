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

  // GG Sonar HTTP REST integration
  SONAR_GET_STATE: 'sonar:getState',        // renderer → main invoke
  SONAR_STATE_CHANGE: 'sonar:stateChange',  // main → renderer push
  SONAR_SET_VOLUME: 'sonar:setVolume',      // renderer → main invoke
  SONAR_SET_MUTE: 'sonar:setMute',          // renderer → main invoke
  SONAR_SELECT_PRESET: 'sonar:selectPreset', // renderer → main invoke
  SONAR_SET_MODE: 'sonar:setMode',          // renderer → main invoke
  SONAR_GET_POLLING_CONFIG: 'sonar:getPollingConfig', // renderer → main invoke
  SONAR_SET_POLLING_CONFIG: 'sonar:setPollingConfig', // renderer → main invoke
  SONAR_SET_REDIRECTION: 'sonar:setRedirection', // renderer → main invoke (channel, deviceId)
  SONAR_ROUTE_PROCESS: 'sonar:routeProcess',     // renderer → main invoke (sessionId, targetDeviceId)
  SONAR_REFRESH_DEVICES: 'sonar:refreshDevices', // renderer → main invoke (on-demand device refresh)

  // Preset Switcher — auto-switch presets by active app
  ACTIVE_WINDOW_CHANGE: 'activeWindow:change',          // main → renderer push
  ACTIVE_WINDOW_GET_OPEN_APPS: 'activeWindow:getOpenApps', // renderer → main invoke
  PRESET_SWITCHER_GET_RULES: 'presetSwitcher:getRules', // renderer → main invoke
  PRESET_SWITCHER_SET_RULES: 'presetSwitcher:setRules', // renderer → main invoke
  PRESET_SWITCHER_GET_ENABLED: 'presetSwitcher:getEnabled', // renderer → main invoke
  PRESET_SWITCHER_SET_ENABLED: 'presetSwitcher:setEnabled', // renderer → main invoke
  PRESET_SWITCHER_ENABLED_CHANGE: 'presetSwitcher:enabledChange', // main → renderer push

  // Shell utilities
  SHELL_OPEN_EXTERNAL: 'shell:openExternal', // renderer → main invoke
  SHELL_OPEN_STEELSERIES_GG: 'shell:openSteelSeriesGG', // renderer → main invoke

  // DDC/CI display control
  DDC_GET_MONITORS: 'ddc:getMonitors',       // renderer → main invoke
  DDC_SET_BRIGHTNESS: 'ddc:setBrightness',   // renderer → main invoke
  DDC_SET_INPUT_SOURCE: 'ddc:setInputSource', // renderer → main invoke
  DDC_SET_PRIMARY_MONITOR: 'ddc:setPrimaryMonitor', // renderer → main invoke
  DDC_UPDATE: 'ddc:update',                  // main → renderer push
  DDC_GET_POLL_INTERVAL: 'ddc:getPollInterval', // renderer → main invoke
  DDC_SET_POLL_INTERVAL: 'ddc:setPollInterval', // renderer → main invoke
} as const

/** Union of all valid IPC channel strings */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ─── Settings ────────────────────────────────────────────────────────────────

/** App-wide settings persisted to disk */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  sidebarCollapsed: boolean
  ddcPollIntervalSeconds: number
  ddcSyncBrightness: boolean
  minimizeToTray: boolean
}

/** Defaults applied when no saved settings exist */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sidebarWidth: 240,
  sidebarCollapsed: false,
  ddcPollIntervalSeconds: 60,
  ddcSyncBrightness: false,
  minimizeToTray: true,
}

// ─── Navigation ──────────────────────────────────────────────────────────────

/** Top-level views the app can show */
export type AppView =
  | 'home'
  | 'arctis'
  | 'gg-sonar'
  | 'shortcuts'
  | 'notifications'
  | 'settings'

/** Tabs within the settings view */
export type SettingsTab = 'general' | 'gg-sonar' | 'ddc' | 'about'

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
 * 2.4 GHz wireless link state — mirrors arctis_hid.WirelessLinkState enum.
 * ABSENT = headset off/removed; SEARCHING = base scanning; ACTIVE = link up.
 */
export type WirelessLinkState = 'ABSENT' | 'SEARCHING' | 'ACTIVE'

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
  wirelessConnected: boolean     // 2.4 GHz link active (ACTIVE state)
  wirelessLinkState: WirelessLinkState  // granular link state from WirelessLinkState enum
  headsetPowered: boolean        // headset is powered on (false = off or removed)
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

  // ── GG Sonar / USB Input ─────────────────────────────────────────────────────
  sonarConnected: boolean        // GG Sonar software is active (from DisplayData.sonar_running)
  usbInput: 'INPUT_1' | 'INPUT_2'  // UsbInput enum — active USB input channel
  volumeLimiterOn: boolean       // volume limiter enabled (from VolumeLimiterData.limiter_on)
}

// ─── GG Sonar HTTP REST ───────────────────────────────────────────────────────

export type SonarMode = 'classic' | 'streamer'

export const SONAR_CHANNELS = ['master', 'game', 'chatRender', 'chatCapture', 'media', 'aux'] as const
export type SonarChannel = (typeof SONAR_CHANNELS)[number]

/** All channels except master — these appear in `devices` maps */
export type SonarDeviceChannel = 'game' | 'chatRender' | 'chatCapture' | 'media' | 'aux'

export interface SonarChannelVolume {
  volume: number   // 0.0–1.0
  muted: boolean
}

export interface SonarStreamerMix {
  streaming: SonarChannelVolume
  monitoring: SonarChannelVolume
}

export interface SonarClassicVolumes {
  masters: { classic: SonarChannelVolume; stream: object }
  devices: Record<SonarDeviceChannel, { classic: SonarChannelVolume; stream: object }>
}

export interface SonarStreamerVolumes {
  masters: { stream: SonarStreamerMix; classic: SonarChannelVolume }
  devices: Record<SonarDeviceChannel, { stream: SonarStreamerMix; classic: SonarChannelVolume }>
}

export interface SonarAudioSession {
  id: string
  processName: string
  processId: number
  displayName: string
  isSystemSound: boolean
  state: string
  isRoutingErrorProne: boolean
  routingErrorDetected: boolean
}

export interface SonarDeviceRoute {
  deviceId: string
  role: string
  dataFlow: string
  audioSessions: SonarAudioSession[]
}

export interface SonarConfigData {
  // Output channels (game, media, aux)
  bassBoostState?: { enabled: boolean; value: number }
  trebleBoostState?: { enabled: boolean; value: number }
  voiceClarityState?: { enabled: boolean; value: number }
  smartVolume?: { enabled: boolean; volumeLevel: number; loudness: string }
  generalGain?: number
  parametricEQ?: { enabled: boolean }
  virtualSurroundState?: boolean
  reverbGainDB?: number
  formFactor?: string
  globalEnableState?: boolean
  // Voice channels (chatRender, chatCapture)
  noiseReductionState?: { enabled: boolean }
  volumeStabilizerState?: { enabled: boolean }
  noiseGateState?: { enabled: boolean }
  automaticNoiseGateState?: { enabled: boolean }
  impactNoiseReductionState?: { enabled: boolean }
  noiseCancelingState?: { enabled: boolean }
  acousticEchoCancelingState?: { enabled: boolean }
}

export interface SonarConfig {
  id: string
  name: string
  virtualAudioDevice: string
  data: SonarConfigData
  isPreset: boolean
  isFavorite: boolean
  favoritePosition: number
  /** Set by the API when this config is the currently active one for its channel */
  isSelected?: boolean
  image: string
  createdAt: string
  updatedAt: string
}

export interface SonarChatMix {
  balance: number
  state: string
}

/** A Windows audio output device available for channel redirection */
export interface SonarAudioDevice {
  id: string    // Windows device GUID
  name: string  // Friendly display name
}

/** Maps Sonar channel role ('game', 'chatRender', etc.) → the currently assigned device */
export type SonarRedirections = Record<string, SonarAudioDevice>

export interface SonarState {
  available: boolean
  mode: SonarMode
  classic: SonarClassicVolumes | null
  streamer: SonarStreamerVolumes | null
  configs: SonarConfig[]
  routing: SonarDeviceRoute[]
  chatMix: SonarChatMix | null
  audioDevices: SonarAudioDevice[]       // available Windows playback devices
  redirections: SonarRedirections        // channel role → Windows device id
}

export interface SonarPollingConfig {
  pollingIntervalMs: number  // Polling interval (ms) — default 1000
}

// ─── Preset Switcher ──────────────────────────────────────────────────────────

export interface ActiveWindowInfo {
  processName: string
}

export interface OpenApp {
  processName: string
  displayName: string
}

export interface PresetSwitcherRule {
  id: string
  appProcessName: string  // Windows process name (no .exe)
  displayName: string     // Shown in UI
  channel: string         // SonarConfig.virtualAudioDevice
  presetId: string        // SonarConfig.id
  enabled: boolean
}

// ─── DDC/CI Display Control ───────────────────────────────────────────────────

/** Live state snapshot of a single connected display with DDC/CI support */
export interface DdcMonitor {
  monitor_id: number      // 1-based index
  name: string            // Human-readable monitor name
  is_primary: boolean     // True if this is the Windows primary display
  brightness: number      // 0–100 %
  contrast: number        // 0–100 %
  input_source: string    // Current input: hex string (e.g. "0x11") or empty if unsupported
  available_inputs: string[]  // Available input options: hex strings
  supports: string[]      // Features available: ['brightness', 'contrast', 'input_source']
}
