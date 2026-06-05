import type {
  NavigateTarget, ServiceInfo, ServiceConfig, LogEntry, ArctisState,
  SonarState, SonarChannel, SonarMode, SonarPollingConfig, SonarDeviceChannel, SonarConfig, SonarAudioSample,
  DiscordState, ActiveWindowInfo, OpenApp, PresetSwitcherRule, AppSettings, DdcMonitor,
  SerializedNotification, Shortcut, ShortcutDispatchEvent, KvmState, UsbDevice,
  HaState, HaServiceCall, ResourceSnapshot,
} from '../../../shared/types'

/**
 * TypeScript declarations for the API exposed by the preload script via
 * contextBridge.exposeInMainWorld('api', ...).
 * These must stay in sync with src/preload/index.ts.
 */
// Allow -webkit-app-region in React inline styles (Electron drag regions)
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

declare global {
  interface Window {
    api: {
    // Window controls
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    onWindowStateChange: (callback: (isMaximized: boolean) => void) => () => void

    // Native app menu
    showMenu: (x: number, y: number) => Promise<void>

    // Navigation pushed from main process
    onNavigate: (callback: (target: NavigateTarget) => void) => () => void

    // Background services
    servicesList: () => Promise<ServiceInfo[]>
    setServiceEnabled: (id: string, enabled: boolean) => Promise<void>
    getServiceLogHistory: () => Promise<LogEntry[]>
    getServiceLogFilePath: () => Promise<string>
    onServicesStateChange: (callback: (services: ServiceInfo[]) => void) => () => void
    onServiceLog: (callback: (entry: LogEntry) => void) => () => void
    getServiceConfig: () => Promise<ServiceConfig>
    setPythonPath: (path: string) => Promise<void>

    // Arctis Nova Pro HID
    arctisGetState: () => Promise<ArctisState | null>
    onArctisConnected: (callback: (state: ArctisState) => void) => () => void
    onArctisDisconnected: (callback: () => void) => () => void
    onArctisEvent: (
      callback: (eventName: string, data: Record<string, unknown>) => void,
    ) => () => void
    arctisCmd: (cmd: string, value: unknown) => Promise<void>

    // GG Sonar
    sonarGetState: () => Promise<SonarState>
    sonarSetVolume: (channel: SonarChannel, value: number) => Promise<void>
    sonarSetMute: (channel: SonarChannel, muted: boolean) => Promise<void>
    sonarSelectPreset: (id: string) => Promise<void>
    sonarSetMode: (mode: SonarMode) => Promise<void>
    sonarGetPollingConfig: () => Promise<SonarPollingConfig>
    sonarSetPollingConfig: (config: SonarPollingConfig) => Promise<void>
    sonarSetRedirection: (channel: SonarDeviceChannel, deviceId: string) => Promise<void>
    sonarRouteProcess: (processId: number, targetChannel: string) => Promise<void>
    sonarRefreshDevices: () => Promise<void>
    sonarUpsertConfig: (config: SonarConfig) => Promise<SonarConfig>
    sonarDeleteConfig: (id: string) => Promise<void>
    sonarDuplicateConfig: (sourceId: string) => Promise<SonarConfig>
    sonarResetConfig: (id: string) => Promise<SonarConfig>
    sonarToggleFavorite: (id: string, isFavorite: boolean) => Promise<void>
    sonarGetAudioSamples: (role: string) => Promise<SonarAudioSample[]>
    sonarPlayAudioSample: (role: string, id: string) => Promise<SonarAudioSample[]>
    onSonarStateChange: (callback: (state: SonarState) => void) => () => void

    // Discord Voice Control
    discordGetState: () => Promise<DiscordState>
    discordSetSelfMute: (muted: boolean) => Promise<void>
    discordSetSelfDeaf: (deafened: boolean) => Promise<void>
    discordSetInputVolume: (volume: number) => Promise<void>
    discordSetOutputVolume: (volume: number) => Promise<void>
    discordSetLocalVolume: (userId: string, volume: number) => Promise<void>
    discordSetLocalMute: (userId: string, muted: boolean) => Promise<void>
    discordReconnect: () => Promise<void>
    onDiscordStateChange: (callback: (state: DiscordState) => void) => () => void

    // Preset Switcher
    onActiveWindowChange: (callback: (info: ActiveWindowInfo) => void) => () => void
    getOpenApps: () => Promise<OpenApp[]>
    getPresetSwitcherRules: () => Promise<PresetSwitcherRule[]>
    setPresetSwitcherRules: (rules: PresetSwitcherRule[]) => Promise<void>
    getPresetSwitcherEnabled: () => Promise<boolean>
    setPresetSwitcherEnabled: (enabled: boolean) => Promise<void>
    onPresetSwitcherEnabledChange: (callback: (enabled: boolean) => void) => () => void

    // Shell utilities
    openExternal: (url: string) => Promise<void>
    openSteelSeriesGG: () => Promise<void>

    // Persistent app settings
    getSettings: () => Promise<AppSettings>
    setSettings: (settings: AppSettings) => Promise<void>

    // DDC Display Control
    ddcGetMonitors: () => Promise<DdcMonitor[]>
    ddcSetBrightness: (monitorId: number, value: number) => Promise<void>
    ddcSetContrast: (monitorId: number, value: number) => Promise<void>
    ddcSetColorPreset: (monitorId: number, preset: number) => Promise<void>
    ddcSetRedGain: (monitorId: number, value: number) => Promise<void>
    ddcSetGreenGain: (monitorId: number, value: number) => Promise<void>
    ddcSetBlueGain: (monitorId: number, value: number) => Promise<void>
    ddcSetSharpness: (monitorId: number, value: number) => Promise<void>
    ddcSetVolume: (monitorId: number, value: number) => Promise<void>
    ddcSetMute: (monitorId: number, muted: boolean) => Promise<void>
    ddcSetPowerMode: (monitorId: number, mode: number) => Promise<void>
    ddcFactoryReset: (monitorId: number) => Promise<void>
    ddcColorReset: (monitorId: number) => Promise<void>
    ddcSetInputSource: (monitorId: number, inputValue: string) => Promise<void>
    ddcSetPrimaryMonitor: (monitorId: number) => Promise<void>
    onDdcUpdate: (callback: (monitors: DdcMonitor[]) => void) => () => void
    ddcGetPollInterval: () => Promise<number>
    ddcSetPollInterval: (seconds: number) => Promise<void>

    // Notification overlay
    notifPush: (spec: SerializedNotification) => Promise<void>
    onNotifReceive: (callback: (spec: SerializedNotification) => void) => () => void
    notifSetIgnoreMouse: (ignore: boolean) => Promise<void>
    notifAllDismissed: () => Promise<void>

    // Keyboard shortcuts
    shortcutsGet: () => Promise<Shortcut[]>
    shortcutsSave: (shortcuts: Shortcut[]) => Promise<void>
    shortcutsDispatch: (actionId: string, value?: string | number) => Promise<void>
    onShortcutsDispatch: (callback: (event: ShortcutDispatchEvent) => void) => () => void

    // KVM Detector
    kvmGetState: () => Promise<KvmState>
    kvmIdentifyStart: () => Promise<void>
    kvmIdentifyCancel: () => Promise<void>
    onKvmStateChange: (callback: (state: KvmState) => void) => () => void
    onKvmIdentifyResult: (callback: (device: UsbDevice | null) => void) => () => void

    // Home Assistant
    haGetState: () => Promise<HaState>
    haCallService: (call: HaServiceCall) => Promise<void>
    haTestConnection: (url: string, token: string) => Promise<{ ok: boolean; error?: string }>
    onHaStateChange: (callback: (state: HaState) => void) => () => void

    // Remote Web Client
    remoteGetInfo: () => Promise<RemoteInfo>
    remoteRegenerateToken: () => Promise<RemoteInfo>

    // Resource Monitor
    resourceGetState: () => Promise<ResourceSnapshot | null>
    resourceSetConfig: (config: { interval: number }) => Promise<void>
    onResourceStateChange: (callback: (snapshot: ResourceSnapshot) => void) => () => void
    }
  }

  /** Info about the remote web client server, returned by remoteGetInfo / remoteRegenerateToken. */
  interface RemoteInfo {
    enabled: boolean
    url: string | null
    qrUrl: string | null
    token: string | null
    expiresAt: number   // 0 = never expires
    expired: boolean
  }
}
