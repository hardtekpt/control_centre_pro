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
  DDC_SET_CONTRAST: 'ddc:setContrast',       // renderer → main invoke
  DDC_SET_INPUT_SOURCE: 'ddc:setInputSource', // renderer → main invoke
  DDC_SET_PRIMARY_MONITOR: 'ddc:setPrimaryMonitor', // renderer → main invoke
  DDC_UPDATE: 'ddc:update',                  // main → renderer push
  DDC_GET_POLL_INTERVAL: 'ddc:getPollInterval', // renderer → main invoke
  DDC_SET_POLL_INTERVAL: 'ddc:setPollInterval', // renderer → main invoke
  DDC_SET_COLOR_PRESET: 'ddc:setColorPreset', // renderer → main invoke
  DDC_SET_RED_GAIN: 'ddc:setRedGain',        // renderer → main invoke
  DDC_SET_GREEN_GAIN: 'ddc:setGreenGain',    // renderer → main invoke
  DDC_SET_BLUE_GAIN: 'ddc:setBlueGain',      // renderer → main invoke
  DDC_SET_SHARPNESS: 'ddc:setSharpness',     // renderer → main invoke
  DDC_SET_VOLUME: 'ddc:setVolume',           // renderer → main invoke
  DDC_SET_MUTE: 'ddc:setMute',              // renderer → main invoke
  DDC_SET_POWER_MODE: 'ddc:setPowerMode',    // renderer → main invoke
  DDC_FACTORY_RESET: 'ddc:factoryReset',     // renderer → main invoke
  DDC_COLOR_RESET: 'ddc:colorReset',         // renderer → main invoke

  // Notification overlay
  NOTIF_PUSH:             'notif:push',           // main renderer → main invoke (show notification)
  NOTIF_RECEIVE:          'notif:receive',         // main → overlay push (forwarded spec)
  NOTIF_SET_IGNORE_MOUSE: 'notif:setIgnoreMouse',  // overlay → main invoke (passthrough toggle)
  NOTIF_ALL_DISMISSED:    'notif:allDismissed',    // overlay → main invoke (hide overlay window)

  // Keyboard shortcuts
  SHORTCUTS_GET:      'shortcuts:get',      // renderer → main invoke → Shortcut[]
  SHORTCUTS_SAVE:     'shortcuts:save',     // renderer → main invoke (Shortcut[]) → void
  SHORTCUTS_DISPATCH: 'shortcuts:dispatch', // main → renderer push ({ actionId, value })

  // Discord RPC voice integration
  DISCORD_GET_STATE: 'discord:getState',           // renderer → main invoke
  DISCORD_STATE_CHANGE: 'discord:stateChange',     // main → renderer push
  DISCORD_SET_SELF_MUTE: 'discord:setSelfMute',    // renderer → main invoke
  DISCORD_SET_SELF_DEAF: 'discord:setSelfDeaf',    // renderer → main invoke
  DISCORD_SET_INPUT_VOLUME: 'discord:setInputVolume', // renderer → main invoke
  DISCORD_SET_OUTPUT_VOLUME: 'discord:setOutputVolume', // renderer → main invoke
  DISCORD_SET_LOCAL_VOLUME: 'discord:setLocalVolume',   // renderer → main invoke
  DISCORD_SET_LOCAL_MUTE: 'discord:setLocalMute',       // renderer → main invoke
  DISCORD_RECONNECT: 'discord:reconnect',               // renderer → main invoke

  // KVM Detector plugin
  KVM_GET_STATE:        'kvm:getState',        // renderer → main invoke
  KVM_STATE_CHANGE:     'kvm:stateChange',     // main → renderer push
  KVM_IDENTIFY_START:   'kvm:identifyStart',   // renderer → main invoke
  KVM_IDENTIFY_CANCEL:  'kvm:identifyCancel',  // renderer → main invoke
  KVM_IDENTIFY_RESULT:  'kvm:identifyResult',  // main → renderer push (UsbDevice | null)

  // Home Assistant plugin
  HA_GET_STATE:       'ha:getState',        // renderer → main invoke
  HA_STATE_CHANGE:    'ha:stateChange',     // main → renderer push
  HA_CALL_SERVICE:    'ha:callService',     // renderer → main invoke
  HA_TEST_CONNECTION: 'ha:testConnection',  // renderer → main invoke

  // Remote Web Client
  REMOTE_GET_INFO: 'remote:getInfo',                  // renderer → main invoke
  REMOTE_REGENERATE_TOKEN: 'remote:regenerateToken',  // renderer → main invoke

  // Resource Monitor plugin
  RESOURCE_GET_STATE:    'resource:getState',    // renderer → main invoke
  RESOURCE_STATE_CHANGE: 'resource:stateChange', // main → renderer push
  RESOURCE_SET_CONFIG:   'resource:setConfig',   // renderer → main invoke
} as const

/** Union of all valid IPC channel strings */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ─── Serialized Notifications ─────────────────────────────────────────────────

/**
 * IPC-safe notification spec — icon is a string ID instead of a ReactNode.
 * Produced by notifyFromEvent.ts in the main renderer, consumed by the overlay renderer.
 */
export interface SerializedNotification {
  kind: 'rect' | 'volume' | 'circle' | 'ring' | 'glyph'
  key?: string
  iconId?: string   // maps to an icon component in the overlay's ICON_MAP
  ttl?: number
  // rect-specific
  title?: string
  subtitle?: string
  tail?: string
  wide?: boolean
  // volume / ring-specific
  value?: number
  label?: string
  // circle-specific
  dot?: boolean
  // glyph-specific
  glyph?: string
  sub?: string
}

// ─── Notification Settings ────────────────────────────────────────────────────

/** Shape variants available for simple state-change notifications */
export type NotifSimpleShape = 'circle' | 'rect'

/** Shape variants available for value-based notifications */
export type NotifValueShape = 'volume' | 'ring'

/** Toggle + shape for a simple (icon/title) notification */
export interface NotifSimple {
  enabled: boolean
  shape: NotifSimpleShape
}

/** Toggle + shape for a value-driven (volume/ring) notification */
export interface NotifValue {
  enabled: boolean
  shape: NotifValueShape
}

/** Low battery notification — includes configurable threshold */
export interface NotifBatteryLow {
  enabled: boolean
  shape: 'ring' | 'rect'
  threshold: number   // 0–100; fire notification when headset drops below this %
}

export interface HeadsetNotificationSettings {
  // Connectivity
  powerOnOff: NotifSimple       // headset powered on / off
  wireless: NotifSimple         // 2.4 GHz link connected / disconnected
  bluetooth: NotifSimple        // BT device connected / disconnected
  // Battery
  batteryLow: NotifBatteryLow
  batteryCharging: NotifSimple  // headset battery increasing (charging detected)
  batteryDock: NotifSimple      // dock inserted / removed (batteryDock 0↔>0)
  // ANC
  ancMode: NotifSimple
  // Mic
  micMute: NotifSimple
  // Volume
  volume: NotifValue
  // ChatMix
  chatmix: NotifValue
  // Sidetone
  sidetone: NotifSimple
}

export interface SonarNotificationSettings {
  presetChange: NotifSimple
}

export interface DisplayNotificationSettings {
  inputSourceChange: NotifSimple
  brightness: NotifValue
}

export interface NotificationSettings {
  headset: HeadsetNotificationSettings
  sonar: SonarNotificationSettings
  display: DisplayNotificationSettings
  durationMs: number  // how long notifications display; default 2400ms
}

const DEFAULT_HEADSET_NOTIFICATIONS: HeadsetNotificationSettings = {
  powerOnOff:      { enabled: true,  shape: 'rect'   },
  wireless:        { enabled: true,  shape: 'rect'   },
  bluetooth:       { enabled: true,  shape: 'rect'   },
  batteryLow:      { enabled: true,  shape: 'ring',  threshold: 20 },
  batteryCharging: { enabled: false, shape: 'circle' },
  batteryDock:     { enabled: false, shape: 'circle' },
  ancMode:         { enabled: true,  shape: 'rect'   },
  micMute:         { enabled: true,  shape: 'circle' },
  volume:          { enabled: true,  shape: 'volume' },
  chatmix:         { enabled: true,  shape: 'volume' },
  sidetone:        { enabled: true,  shape: 'rect'   },
}

const DEFAULT_SONAR_NOTIFICATIONS: SonarNotificationSettings = {
  presetChange: { enabled: true, shape: 'rect' },
}

const DEFAULT_DISPLAY_NOTIFICATIONS: DisplayNotificationSettings = {
  inputSourceChange: { enabled: true, shape: 'rect' },
  brightness: { enabled: true, shape: 'volume' },
}

// ─── Resource Monitor ─────────────────────────────────────────────────────────

export interface ResourceCpuInfo {
  usagePercent: number
  coreUsage: number[]
  temperatureCelsius: number | null
}

export interface ResourceRamInfo {
  usedPercent: number
  usedGb: number
  totalGb: number
  swapUsedPercent: number
}

export interface ResourceGpuInfo {
  name: string
  usagePercent: number | null
  vramUsedGb: number | null
  vramTotalGb: number | null
  temperatureCelsius: number | null
}

export interface ResourceDiskInfo {
  mountpoint: string
  label: string
  usedPercent: number
  usedGb: number
  totalGb: number
  readMbps: number
  writeMbps: number
}

export interface ResourceNetInfo {
  adapter: string
  sentMbps: number
  recvMbps: number
}

export interface ResourceSnapshot {
  cpu: ResourceCpuInfo
  ram: ResourceRamInfo
  gpu: ResourceGpuInfo | null
  disks: ResourceDiskInfo[]
  network: ResourceNetInfo[]
  gpuAvailable: boolean
  temperatureAvailable: boolean
}

// ─── Settings ────────────────────────────────────────────────────────────────

/** A named group of monitors for batch brightness shortcuts */
export interface MonitorGroup {
  id: string
  name: string
  monitorIds: number[]
}

/** App-wide settings persisted to disk */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  sidebarCollapsed: boolean
  ddcPollIntervalSeconds: number
  ddcSyncBrightness: boolean
  minimizeToTray: boolean
  openOnActiveDisplay: boolean
  notifications: NotificationSettings
  discordClientId: string
  discordClientSecret: string
  discordShowHomeCard: boolean
  kvmEnabled: boolean
  kvmDeviceInstanceId: string
  kvmDeviceName: string
  kvmConnectedActions: MonitorInputAction[]
  kvmDisconnectedActions: MonitorInputAction[]
  haEnabled: boolean
  haUrl: string
  haToken: string
  runAtStartup: boolean
  remoteEnabled: boolean
  remotePort: number
  /** Hex auth token embedded in the QR-code URL; clients must present this to access the API/WS. Empty until first generated. */
  remoteAuthToken: string
  /** Epoch ms when the current token expires. 0 = never. */
  remoteTokenExpiresAt: number
  /** Configured token lifetime in ms (0 = never expires). Applied when a new token is issued. */
  remoteTokenDurationMs: number
  /** User-defined groups of monitors for batch brightness shortcuts */
  monitorGroups: MonitorGroup[]
  /** Custom accent color hex (e.g. "#d97706"). Empty string = use theme default. */
  accentColor: string
  /** Custom highlight color hex for toggles, slider thumbs, and active chips. Empty string = use theme default. */
  highlightColor: string
  resourceMonitorEnabled: boolean
  /** Poll interval in seconds for the resource monitor service (default 2) */
  resourceMonitorInterval: number
}

/** Defaults applied when no saved settings exist */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sidebarWidth: 240,
  sidebarCollapsed: false,
  ddcPollIntervalSeconds: 60,
  ddcSyncBrightness: false,
  openOnActiveDisplay: false,
  minimizeToTray: true,
  notifications: {
    headset: DEFAULT_HEADSET_NOTIFICATIONS,
    sonar: DEFAULT_SONAR_NOTIFICATIONS,
    display: DEFAULT_DISPLAY_NOTIFICATIONS,
    durationMs: 2400,
  },
  discordClientId: '',
  discordClientSecret: '',
  discordShowHomeCard: true,
  kvmEnabled: false,
  kvmDeviceInstanceId: '',
  kvmDeviceName: '',
  kvmConnectedActions: [],
  kvmDisconnectedActions: [],
  haEnabled: false,
  haUrl: '',
  haToken: '',
  runAtStartup: false,
  remoteEnabled: false,
  remotePort: 8080,
  remoteAuthToken: '',
  remoteTokenExpiresAt: 0,
  remoteTokenDurationMs: 24 * 60 * 60 * 1000,  // 24 hours
  monitorGroups: [],
  accentColor: '',
  highlightColor: '',
  resourceMonitorEnabled: true,
  resourceMonitorInterval: 2,
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

/** Generic select option with a typed value */
export interface Option<T> {
  value: T
  label: string
}

/** Tabs within the settings view */
export type SettingsTab = 'general' | 'gg-sonar' | 'ddc' | 'notifications' | 'plugins' | 'about' | 'remote-access'

/** Navigate targets that can be pushed from the main process */
export type NavigateTarget = AppView | `settings:${SettingsTab}`

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

// ─── Plugins ──────────────────────────────────────────────────────────────────

export type PluginStatus = 'connected' | 'error' | 'disabled' | 'installed' | 'not-installed'

export type PluginCategory = 'communication' | 'gaming' | 'streaming' | 'smart-home' | 'media' | 'peripheral'

export type PluginFieldKind = 'toggle' | 'text' | 'password' | 'select' | 'multi' | 'oauth' | 'readonly' | 'action'

export interface PluginField {
  kind: PluginFieldKind
  id: string
  label: string
  sub?: string
  value?: unknown
  placeholder?: string
  mono?: boolean
  hint?: string
  options?: Array<{ id: string; label: string }>
  account?: string
  lastAuth?: string
  expiresAt?: string
  button?: string
  danger?: boolean
  copy?: boolean
}

export interface PluginSection {
  id: string
  title: string
  desc?: string
  fields: PluginField[]
}

export interface Plugin {
  id: string
  name: string
  glyph: string
  author: string
  version: string
  blurb: string
  status: PluginStatus
  enabled: boolean
  statusLine: string
  category: PluginCategory
  error?: string
  sections: PluginSection[]
}

// ─── Arctis Nova Pro HID ──────────────────────────────────────────────────────

/**
 * Bluetooth state — mirrors arctis_hid.BtStatus enum.
 * OFF = radio off; ON = active but no device connected; PAIRING = pairing mode; CONNECTED = device paired and active.
 */
export type BtStatus = 'OFF' | 'ON' | 'PAIRING' | 'CONNECTED'

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
  headsetPowered: boolean | null // headset powered on; null = not yet received from device
  btStatus: BtStatus             // Bluetooth state derived from ConnectivityStatus

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
  baseStationConnected: boolean  // USB HID connection to base station is active
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

// ─── Discord RPC Voice Integration ────────────────────────────────────────────

export interface DiscordParticipant {
  userId: string
  username: string
  nick: string
  muted: boolean        // their self-mute
  deafened: boolean
  localMuted: boolean   // we locally muted them
  localVolume: number   // 0-200 (100 = normal)
  speaking: boolean
  avatar: string | null
}

export interface DiscordState {
  available: boolean
  authenticated: boolean
  error: string | null
  voiceChannel: { id: string; name: string; guildName: string } | null
  participants: DiscordParticipant[]
  selfMuted: boolean
  selfDeafened: boolean
  inputVolume: number   // 0-100
  outputVolume: number  // 0-100
}

// ─── Preset Switcher ──────────────────────────────────────────────────────────

export interface ActiveWindowInfo {
  processName: string
}

export interface OpenApp {
  processName: string
  displayName: string
}

export interface MonitorInputAction {
  monitorId: number   // DdcMonitor.monitor_id
  inputValue: string  // hex string, e.g. "0x11"
}

export interface PresetSwitcherRule {
  id: string
  appProcessName: string        // Windows process name (no .exe)
  displayName: string           // Shown in UI
  channel?: string              // SonarConfig.virtualAudioDevice (optional — rule may be monitor-only)
  presetId?: string             // SonarConfig.id (optional)
  enabled: boolean
  monitorActions?: MonitorInputAction[]
}

// ─── DDC/CI Display Control ───────────────────────────────────────────────────

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

export type ShortcutScope = 'global' | 'focused'

export interface Shortcut {
  id: string
  actionId: string
  value?: string | number
  keys: string[]
  scope: ShortcutScope
  enabled: boolean
}

/** Dispatch payload sent from main → renderer for focused-scope actions */
export interface ShortcutDispatchEvent {
  actionId: string
  value?: string | number
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
  // Extended VCP features — null when monitor does not support the feature
  color_preset: number | null     // VCP 0x14: sRGB=0x01, 5000K=0x04, 6500K=0x05, 9300K=0x08
  red_gain: number | null         // VCP 0x16 current value
  green_gain: number | null       // VCP 0x18 current value
  blue_gain: number | null        // VCP 0x1A current value
  rgb_max: number                 // Max value for RGB gain sliders (typ. 100)
  sharpness: number | null        // VCP 0x87 current value
  sharpness_max: number           // Max sharpness value (varies per monitor)
  volume: number | null           // VCP 0x62 current value
  muted: boolean | null           // VCP 0x8D: true = muted
  power_mode: number | null       // VCP 0xD6: 1=on, 2=standby, 4=off
  usage_time_hours: number | null // VCP 0xC6 display on-time in hours
  vcp_version: string | null      // VCP 0xDF formatted e.g. "2.1"
  supports: string[]      // Feature flags: 'brightness'|'contrast'|'input_source'|'color_preset'|'rgb_gain'|'sharpness'|'volume'|'mute'|'power'
}

/** VCP 0x60 input source code → human-readable label (shared between main and renderer) */
export const DDC_INPUT_NAMES: Record<string, string> = {
  '0x01': 'VGA 1',
  '0x02': 'VGA 2',
  '0x03': 'DVI 1',
  '0x04': 'DVI 2',
  '0x0f': 'DisplayPort 1',
  '0x10': 'DisplayPort 2',
  '0x11': 'HDMI 1',
  '0x12': 'HDMI 2',
  '0x1b': 'USB-C',
}

// ─── KVM Detector Plugin ──────────────────────────────────────────────────────

/** A USB device visible to Windows PnP */
export interface UsbDevice {
  instanceId: string    // Unique PnP InstanceId (e.g. USB\VID_1234&PID_5678\...)
  friendlyName: string  // Human-readable label shown in Device Manager
}

/** Live KVM connection state pushed from main → renderer */
export interface KvmState {
  connected: boolean         // true = tracked USB device is present on this PC
  deviceInstanceId: string   // currently tracked device ('' = none configured)
}

// ─── Home Assistant Plugin ────────────────────────────────────────────────────

/** A single HA entity as returned by GET /api/states */
export interface HaEntity {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_changed: string
  last_updated: string
}

/** Renderer-facing HA state snapshot pushed over IPC */
export interface HaState {
  status: 'connected' | 'error' | 'disabled' | 'installed'
  error: string | null
  entityCount: number
  entities: HaEntity[]
}

/** Payload for calling an HA service from the renderer */
export interface HaServiceCall {
  domain: string
  service: string
  serviceData?: Record<string, unknown>
}
