/**
 * TypeScript declarations for the API exposed by the preload script.
 * The preload calls contextBridge.exposeInMainWorld('api', ...) which puts
 * this object on window.api — but TypeScript doesn't know about it unless
 * we declare it here.
 */
interface Window {
  api: {
    /** Minimize the application window */
    minimize: () => Promise<void>
    /** Toggle maximize / restore the application window */
    maximize: () => Promise<void>
    /** Close the application window */
    close: () => Promise<void>
    /** Returns true if the window is currently maximized */
    isMaximized: () => Promise<boolean>
    /**
     * Subscribe to window maximize / restore events.
     * Returns a cleanup function — call it in useEffect's return.
     */
    onWindowStateChange: (callback: (isMaximized: boolean) => void) => () => void
  }
}
