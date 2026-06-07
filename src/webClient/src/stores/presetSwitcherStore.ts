import { create } from 'zustand'
import type { PresetSwitcherRule, OpenApp } from '@shared/types'
import { get, post } from '../api/http'

interface PresetSwitcherStoreState {
  rules: PresetSwitcherRule[]
  enabled: boolean
  activeProcessName: string
  openApps: OpenApp[]

  /** Seed from the WS `init` snapshot. */
  initFromSnapshot: (rules: PresetSwitcherRule[], enabled: boolean) => void
  setActiveProcessName: (name: string) => void
  /** Apply an enabled change pushed from the server (no echo POST). */
  setEnabledFromWs: (enabled: boolean) => void

  fetchRules: () => Promise<void>
  fetchEnabled: () => Promise<void>
  fetchOpenApps: () => Promise<void>
  saveRules: (rules: PresetSwitcherRule[]) => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

export const usePresetSwitcherStore = create<PresetSwitcherStoreState>((set) => ({
  rules: [],
  enabled: false,
  activeProcessName: '',
  openApps: [],

  initFromSnapshot: (rules, enabled) => set({ rules, enabled }),
  setActiveProcessName: (name) => set({ activeProcessName: name }),
  setEnabledFromWs: (enabled) => set({ enabled }),

  fetchRules: async () => {
    try {
      set({ rules: await get<PresetSwitcherRule[]>('/api/presetswitcher/rules') })
    } catch { /* will sync from WS init */ }
  },

  fetchEnabled: async () => {
    try {
      const { enabled } = await get<{ enabled: boolean }>('/api/presetswitcher/enabled')
      set({ enabled })
    } catch { /* will sync from WS init */ }
  },

  fetchOpenApps: async () => {
    try {
      set({ openApps: await get<OpenApp[]>('/api/sonar/openapps') })
    } catch { /* ignore */ }
  },

  saveRules: async (rules) => {
    set({ rules })
    await post('/api/presetswitcher/rules', { rules })
  },

  setEnabled: async (enabled) => {
    set({ enabled })
    await post('/api/presetswitcher/enabled', { enabled })
  },
}))
