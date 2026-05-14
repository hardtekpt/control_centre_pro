import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type {
  NavigateTarget, ServiceInfo, ServiceConfig, LogEntry, ArctisState,
  SonarState, SonarChannel, SonarMode, SonarPollingConfig,
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

  onSonarStateChange: (callback: (state: SonarState) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: SonarState): void => callback(state)
    ipcRenderer.on(IPC_CHANNELS.SONAR_STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SONAR_STATE_CHANGE, handler)
  },

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),

  openSteelSeriesGG: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_STEELSERIES_GG),
}

contextBridge.exposeInMainWorld('api', api)
