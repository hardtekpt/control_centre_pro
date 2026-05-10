import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type { NavigateTarget } from '../shared/types'

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
}

contextBridge.exposeInMainWorld('api', api)
