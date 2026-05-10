import type { NavigateTarget, ServiceInfo, ServiceConfig, LogEntry, ArctisState } from '../../../shared/types'

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
    }
  }
}
