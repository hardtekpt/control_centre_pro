import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type {
  NavigateTarget, ServiceInfo, ServiceConfig, LogEntry, ArctisState,
  SonarState, SonarChannel, SonarMode, SonarPollingConfig, SonarDeviceChannel, SonarConfig, SonarAudioSample,
  DiscordState, ActiveWindowInfo, OpenApp, PresetSwitcherRule, AppSettings, DdcMonitor,
  SerializedNotification, Shortcut, ShortcutDispatchEvent, KvmState, UsbDevice,
  HaState, HaServiceCall, ResourceSnapshot,
} from '../shared/types'

/**
 * The typed API exposed to the renderer via contextBridge.
 * Renderer calls window.api.xxx() — it never sees ipcRenderer directly.
 */
const api = {
  // ── Window controls ────────────────────────────────────────────────────────

  minimize: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),

  maximize: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),

  close: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),

  onWindowStateChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, isMaximized: boolean): void =>
      callback(isMaximized)
    ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGE, handler)
  },

  // ── Native app menu ────────────────────────────────────────────────────────

  /**
   * Pop up the native OS application menu at the given screen coordinates.
   * Pass the button's bounding rect bottom-left corner for a natural dropdown.
   */
  showMenu: (x: number, y: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.MENU_SHOW, x, y),

  // ── Navigation events from main process ────────────────────────────────────

  /**
   * Subscribe to navigation events pushed from menu click handlers.
   * Returns a cleanup function — call it in useEffect's return.
   */
  onNavigate: (callback: (target: NavigateTarget) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, target: NavigateTarget): void =>
      callback(target)
    ipcRenderer.on(IPC_CHANNELS.NAVIGATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.NAVIGATE, handler)
  },

  // ── Background services ────────────────────────────────────────────────────

  servicesList: (): Promise<ServiceInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SERVICES_LIST),

  setServiceEnabled: (id: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SERVICES_SET_ENABLED, id, enabled),

  getServiceConfig: (): Promise<ServiceConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SERVICES_GET_CONFIG),

  setPythonPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SERVICES_SET_PYTHON_PATH, path),

  onServicesStateChange: (callback: (services: ServiceInfo[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, services: ServiceInfo[]): void =>
      callback(services)
    ipcRenderer.on(IPC_CHANNELS.SERVICES_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SERVICES_STATE_CHANGE, handler)
  },

  getServiceLogHistory: (): Promise<LogEntry[]> =>
    ipcRenderer.invoke('SERVICES_GET_LOG_HISTORY'),

  getServiceLogFilePath: (): Promise<string> =>
    ipcRenderer.invoke('SERVICES_GET_LOG_FILE_PATH'),

  onServiceLog: (callback: (entry: LogEntry) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, entry: LogEntry): void => callback(entry)
    ipcRenderer.on(IPC_CHANNELS.SERVICE_LOG, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SERVICE_LOG, handler)
  },

  // ── Arctis Nova Pro HID ────────────────────────────────────────────────────

  arctisGetState: (): Promise<ArctisState | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.ARCTIS_GET_STATE),

  onArctisConnected: (callback: (state: ArctisState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: ArctisState): void => callback(state)
    ipcRenderer.on(IPC_CHANNELS.ARCTIS_CONNECTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ARCTIS_CONNECTED, handler)
  },

  onArctisDisconnected: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IPC_CHANNELS.ARCTIS_DISCONNECTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ARCTIS_DISCONNECTED, handler)
  },

  onArctisEvent: (
    callback: (eventName: string, data: Record<string, unknown>) => void,
  ): (() => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      eventName: string,
      data: Record<string, unknown>,
    ): void => callback(eventName, data)
    ipcRenderer.on(IPC_CHANNELS.ARCTIS_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ARCTIS_EVENT, handler)
  },

  arctisCmd: (cmd: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ARCTIS_CMD, cmd, value),

  // ── GG Sonar ───────────────────────────────────────────────────────────────

  sonarGetState: (): Promise<SonarState> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_GET_STATE),

  sonarSetVolume: (channel: SonarChannel, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_SET_VOLUME, channel, value),

  sonarSetMute: (channel: SonarChannel, muted: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_SET_MUTE, channel, muted),

  sonarSelectPreset: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_SELECT_PRESET, id),

  sonarSetMode: (mode: SonarMode): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_SET_MODE, mode),

  sonarGetPollingConfig: (): Promise<SonarPollingConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_GET_POLLING_CONFIG),

  sonarSetPollingConfig: (config: SonarPollingConfig): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_SET_POLLING_CONFIG, config),

  sonarSetRedirection: (channel: SonarDeviceChannel, deviceId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_SET_REDIRECTION, channel, deviceId),

  sonarRouteProcess: (processId: number, targetChannel: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_ROUTE_PROCESS, processId, targetChannel),

  sonarUpsertConfig: (config: SonarConfig): Promise<SonarConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_UPSERT_CONFIG, config),

  sonarDeleteConfig: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_DELETE_CONFIG, id),

  sonarDuplicateConfig: (sourceId: string): Promise<SonarConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_DUPLICATE_CONFIG, sourceId),

  sonarResetConfig: (id: string): Promise<SonarConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_RESET_CONFIG, id),

  sonarToggleFavorite: (id: string, isFavorite: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_TOGGLE_FAVORITE, id, isFavorite),

  sonarRefreshDevices: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_REFRESH_DEVICES),

  sonarGetAudioSamples: (role: string): Promise<SonarAudioSample[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_GET_AUDIO_SAMPLES, role),

  sonarPlayAudioSample: (role: string, id: string): Promise<SonarAudioSample[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_PLAY_AUDIO_SAMPLE, role, id),

  sonarMicStartRecord: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_MIC_START_RECORD),

  sonarMicStopRecord: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_MIC_STOP_RECORD),

  sonarMicSetPlayback: (isPlaying: boolean): Promise<SonarAudioSample[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SONAR_MIC_SET_PLAYBACK, isPlaying),

  onSonarStateChange: (callback: (state: SonarState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: SonarState): void => callback(state)
    ipcRenderer.on(IPC_CHANNELS.SONAR_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SONAR_STATE_CHANGE, handler)
  },

  // ── Discord Voice Control ──────────────────────────────────────────────────

  discordGetState: (): Promise<DiscordState> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_GET_STATE),

  discordSetSelfMute: (muted: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_SELF_MUTE, muted),

  discordSetSelfDeaf: (deafened: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_SELF_DEAF, deafened),

  discordSetInputVolume: (volume: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_INPUT_VOLUME, volume),

  discordSetOutputVolume: (volume: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_OUTPUT_VOLUME, volume),

  discordSetLocalVolume: (userId: string, volume: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_LOCAL_VOLUME, userId, volume),

  discordSetLocalMute: (userId: string, muted: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_LOCAL_MUTE, userId, muted),

  discordReconnect: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCORD_RECONNECT),

  onDiscordStateChange: (callback: (state: DiscordState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: DiscordState): void =>
      callback(state)
    ipcRenderer.on(IPC_CHANNELS.DISCORD_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DISCORD_STATE_CHANGE, handler)
  },

  // ── Preset Switcher ────────────────────────────────────────────────────────

  onActiveWindowChange: (callback: (info: ActiveWindowInfo) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: ActiveWindowInfo): void =>
      callback(info)
    ipcRenderer.on(IPC_CHANNELS.ACTIVE_WINDOW_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ACTIVE_WINDOW_CHANGE, handler)
  },

  getOpenApps: (): Promise<OpenApp[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.ACTIVE_WINDOW_GET_OPEN_APPS),

  getPresetSwitcherRules: (): Promise<PresetSwitcherRule[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.PRESET_SWITCHER_GET_RULES),

  setPresetSwitcherRules: (rules: PresetSwitcherRule[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PRESET_SWITCHER_SET_RULES, rules),

  getPresetSwitcherEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.PRESET_SWITCHER_GET_ENABLED),

  setPresetSwitcherEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PRESET_SWITCHER_SET_ENABLED, enabled),

  onPresetSwitcherEnabledChange: (callback: (enabled: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, enabled: boolean): void => callback(enabled)
    ipcRenderer.on(IPC_CHANNELS.PRESET_SWITCHER_ENABLED_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PRESET_SWITCHER_ENABLED_CHANGE, handler)
  },

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),

  openSteelSeriesGG: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_STEELSERIES_GG),

  // ── Persistent app settings ────────────────────────────────────────────────

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

  setSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // ── DDC Display Control ────────────────────────────────────────────────────

  ddcGetMonitors: (): Promise<DdcMonitor[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_GET_MONITORS),

  ddcSetBrightness: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_BRIGHTNESS, monitorId, value),

  ddcSetContrast: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_CONTRAST, monitorId, value),

  ddcSetColorPreset: (monitorId: number, preset: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_COLOR_PRESET, monitorId, preset),

  ddcSetRedGain: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_RED_GAIN, monitorId, value),

  ddcSetGreenGain: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_GREEN_GAIN, monitorId, value),

  ddcSetBlueGain: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_BLUE_GAIN, monitorId, value),

  ddcSetSharpness: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_SHARPNESS, monitorId, value),

  ddcSetVolume: (monitorId: number, value: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_VOLUME, monitorId, value),

  ddcSetMute: (monitorId: number, muted: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_MUTE, monitorId, muted),

  ddcSetPowerMode: (monitorId: number, mode: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_POWER_MODE, monitorId, mode),

  ddcFactoryReset: (monitorId: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_FACTORY_RESET, monitorId),

  ddcColorReset: (monitorId: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_COLOR_RESET, monitorId),

  ddcSetInputSource: (monitorId: number, inputValue: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_INPUT_SOURCE, monitorId, inputValue),

  ddcSetPrimaryMonitor: (monitorId: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_PRIMARY_MONITOR, monitorId),

  onDdcUpdate: (callback: (monitors: DdcMonitor[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, monitors: DdcMonitor[]): void =>
      callback(monitors)
    ipcRenderer.on(IPC_CHANNELS.DDC_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DDC_UPDATE, handler)
  },

  ddcGetPollInterval: (): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_GET_POLL_INTERVAL),

  ddcSetPollInterval: (seconds: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DDC_SET_POLL_INTERVAL, seconds),

  // ── Notification overlay ─────────────────────────────────────────────────

  notifPush: (spec: SerializedNotification): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTIF_PUSH, spec),

  onNotifReceive: (callback: (spec: SerializedNotification) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, spec: SerializedNotification): void =>
      callback(spec)
    ipcRenderer.on(IPC_CHANNELS.NOTIF_RECEIVE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.NOTIF_RECEIVE, handler)
  },

  notifSetIgnoreMouse: (ignore: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTIF_SET_IGNORE_MOUSE, ignore),

  notifAllDismissed: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTIF_ALL_DISMISSED),

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  shortcutsGet: (): Promise<Shortcut[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET),

  shortcutsSave: (shortcuts: Shortcut[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_SAVE, shortcuts),

  shortcutsDispatch: (actionId: string, value?: string | number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_DISPATCH, actionId, value),

  onShortcutsDispatch: (callback: (event: ShortcutDispatchEvent) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: ShortcutDispatchEvent): void =>
      callback(event)
    ipcRenderer.on(IPC_CHANNELS.SHORTCUTS_DISPATCH, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUTS_DISPATCH, handler)
  },

  // ── KVM Detector ──────────────────────────────────────────────────────────

  kvmGetState: (): Promise<KvmState> =>
    ipcRenderer.invoke(IPC_CHANNELS.KVM_GET_STATE),

  kvmIdentifyStart: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.KVM_IDENTIFY_START),

  kvmIdentifyCancel: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.KVM_IDENTIFY_CANCEL),

  onKvmStateChange: (callback: (state: KvmState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: KvmState): void => callback(state)
    ipcRenderer.on(IPC_CHANNELS.KVM_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.KVM_STATE_CHANGE, handler)
  },

  onKvmIdentifyResult: (callback: (device: UsbDevice | null) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, device: UsbDevice | null): void => callback(device)
    ipcRenderer.on(IPC_CHANNELS.KVM_IDENTIFY_RESULT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.KVM_IDENTIFY_RESULT, handler)
  },

  // ── Home Assistant ─────────────────────────────────────────────────────────

  haGetState: (): Promise<HaState> =>
    ipcRenderer.invoke(IPC_CHANNELS.HA_GET_STATE),

  haCallService: (call: HaServiceCall): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.HA_CALL_SERVICE, call),

  haTestConnection: (url: string, token: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.HA_TEST_CONNECTION, url, token),

  onHaStateChange: (callback: (state: HaState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: HaState): void => callback(state)
    ipcRenderer.on(IPC_CHANNELS.HA_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.HA_STATE_CHANGE, handler)
  },

  // ── Remote Web Client ────────────────────────────────────────────────────────

  remoteGetInfo: (): Promise<RemoteInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_GET_INFO),

  remoteRegenerateToken: (): Promise<RemoteInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOTE_REGENERATE_TOKEN),

  // ── Resource Monitor ────────────────────────────────────────────────────────

  resourceGetState: (): Promise<ResourceSnapshot | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOURCE_GET_STATE),

  resourceSetConfig: (config: { interval: number }): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOURCE_SET_CONFIG, config),

  onResourceStateChange: (cb: (snapshot: ResourceSnapshot) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, snapshot: ResourceSnapshot): void => cb(snapshot)
    ipcRenderer.on(IPC_CHANNELS.RESOURCE_STATE_CHANGE, handler)
    return () => ipcRenderer.off(IPC_CHANNELS.RESOURCE_STATE_CHANGE, handler)
  },
}

interface RemoteInfo {
  enabled: boolean
  url: string | null
  qrUrl: string | null
  token: string | null
  expiresAt: number   // 0 = never expires
  expired: boolean
}

contextBridge.exposeInMainWorld('api', api)
