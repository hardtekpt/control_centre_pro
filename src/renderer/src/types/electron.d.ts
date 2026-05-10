import type { NavigateTarget } from '../../../shared/types'

/**
 * TypeScript declarations for the API exposed by the preload script via
 * contextBridge.exposeInMainWorld('api', ...).
 * These must stay in sync with src/preload/index.ts.
 */
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
  }
}
