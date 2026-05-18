import { create } from 'zustand'
import type { ServiceInfo, LogEntry, ArctisState, DdcMonitor, AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

const MAX_LOG_ENTRIES = 500

interface ServiceState {
  services: ServiceInfo[]
  logs: LogEntry[]
  arctisState: ArctisState | null
  ddcMonitors: DdcMonitor[]
  settings: AppSettings

  setServices: (services: ServiceInfo[]) => void
  setLogs: (logs: LogEntry[]) => void
  addLog: (entry: LogEntry) => void
  setArctisConnected: (state: ArctisState) => void
  setArctisDisconnected: () => void
  updateArctisState: (patch: Partial<ArctisState>) => void
  setDdcMonitors: (monitors: DdcMonitor[]) => void
  setSettings: (settings: AppSettings) => void
}

export const useServiceStore = create<ServiceState>((set) => ({
  services: [],
  logs: [],
  arctisState: null,
  ddcMonitors: [],
  settings: DEFAULT_SETTINGS,

  setServices: (services) => set({ services }),

  setLogs: (logs) => set({ logs: logs.slice(-MAX_LOG_ENTRIES) }),

  addLog: (entry) =>
    set((s) => ({
      logs: [...s.logs.slice(-(MAX_LOG_ENTRIES - 1)), entry],
    })),

  setArctisConnected: (state) => set({ arctisState: state }),

  setArctisDisconnected: () => set({ arctisState: null }),

  updateArctisState: (patch) =>
    set((s) => ({
      arctisState: s.arctisState ? { ...s.arctisState, ...patch } : null,
    })),

  setDdcMonitors: (monitors) => set({ ddcMonitors: monitors }),

  setSettings: (settings) => set({ settings }),
}))
