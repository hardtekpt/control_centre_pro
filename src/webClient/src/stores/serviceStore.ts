import { create } from 'zustand'
import type { ArctisState, DdcMonitor } from '@shared/types'
import { get } from '../api/http'

interface ServiceStoreState {
  arctisState: ArctisState | null
  ddcMonitors: DdcMonitor[]
  setArctisConnected: (state: ArctisState) => void
  setArctisDisconnected: () => void
  updateArctisState: (patch: Partial<ArctisState>) => void
  fetchArctisState: () => Promise<void>
  setDdcMonitors: (monitors: DdcMonitor[]) => void
  fetchDdcMonitors: () => Promise<void>
}

export const useServiceStore = create<ServiceStoreState>((set) => ({
  arctisState: null,
  ddcMonitors: [],

  setArctisConnected: (state) => set({ arctisState: state }),

  setArctisDisconnected: () => set({ arctisState: null }),

  updateArctisState: (patch) =>
    set((s) => ({
      arctisState: s.arctisState ? { ...s.arctisState, ...patch } : null,
    })),

  fetchArctisState: async () => {
    try {
      const state = await get<ArctisState | null>('/api/arctis/state')
      if (state) {
        set({ arctisState: state })
      } else {
        set({ arctisState: null })
      }
    } catch {
      // Server unreachable — state stays as-is; WS will sync when reconnected
    }
  },

  setDdcMonitors: (monitors) => set({ ddcMonitors: monitors }),

  fetchDdcMonitors: async () => {
    try {
      const monitors = await get<DdcMonitor[]>('/api/ddc/monitors')
      set({ ddcMonitors: monitors ?? [] })
    } catch {
      // Server unreachable — keep current state
    }
  },
}))
