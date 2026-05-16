import { create } from 'zustand'
import type { ServiceInfo, LogEntry, ArctisState, DdcMonitor } from '@shared/types'

const MAX_LOG_ENTRIES = 500

interface ServiceState {
  services: ServiceInfo[]
  logs: LogEntry[]
  arctisState: ArctisState | null
  ddcMonitors: DdcMonitor[]

  setServices: (services: ServiceInfo[]) => void
  addLog: (entry: LogEntry) => void
  setArctisConnected: (state: ArctisState) => void
  setArctisDisconnected: () => void
  updateArctisState: (patch: Partial<ArctisState>) => void
  setDdcMonitors: (monitors: DdcMonitor[]) => void
}

export const useServiceStore = create<ServiceState>((set) => ({
  services: [],
  logs: [],
  arctisState: null,
  ddcMonitors: [],

  setServices: (services) => set({ services }),

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

  setDdcMonitors: (monitors) =>
    set({ ddcMonitors: [...monitors].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)) }),
}))
