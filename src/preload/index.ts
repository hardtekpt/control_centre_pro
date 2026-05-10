import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

/**
 * The API surface exposed to the renderer via contextBridge.
 * The renderer calls window.api.xxx() — it never sees ipcRenderer directly.
 * This keeps the renderer sandboxed while still allowing controlled IPC.
 */
const api = {
  /** Minimize the application window */
  minimize: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),

  /** Toggle maximize / restore the application window */
  maximize: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),

  /** Close the application window */
  close: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  /** Returns true if the window is currently maximized */
  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),

  /**
   * Subscribe to window maximize / restore events pushed from the main process.
   * Returns a cleanup function — call it in useEffect's return to unsubscribe.
   */
  onWindowStateChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, isMaximized: boolean): void =>
      callback(isMaximized)
    ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGE, handler)
    // Return a cleanup function so React can call it on unmount
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGE, handler)
  },
}

// Expose the API on window.api — accessible from any renderer component
contextBridge.exposeInMainWorld('api', api)
