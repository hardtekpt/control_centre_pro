import { create } from 'zustand'
import type { Plugin, ServiceInfo, KvmState } from '@shared/types'
import { DEFAULT_PLUGINS } from '../lib/plugins/catalog'

interface PluginStoreState {
  plugins: Plugin[]
  load: (plugins: Plugin[]) => void
  togglePlugin: (id: string) => void
  patchField: (pluginId: string, sectionId: string, fieldId: string, value: unknown) => void
  fieldAction: (pluginId: string, sectionId: string, fieldId: string, kind: string) => Promise<void>
  syncDiscordServiceState: (discordService: ServiceInfo | undefined) => void
  syncKvmState: (kvmState: KvmState, enabled: boolean) => void
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  plugins: DEFAULT_PLUGINS,

  load: (plugins) => set({ plugins }),

  togglePlugin: (id) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== id) return p
        const nextEnabled = !p.enabled
        let nextStatus = p.status
        if (p.status === 'connected' && !nextEnabled) nextStatus = 'disabled'
        else if (p.status === 'disabled' && nextEnabled) nextStatus = 'connected'

        // Sync plugin toggle with persistent settings
        if (id === 'discord') {
          window.api.setServiceEnabled('discord', nextEnabled)
        }
        if (id === 'kvm-detector') {
          window.api.getSettings()
            .then((s) => window.api.setSettings({ ...s, kvmEnabled: nextEnabled }))
            .catch(console.error)
        }

        return { ...p, enabled: nextEnabled, status: nextStatus }
      }),
    })
  },

  patchField: (pluginId, sectionId, fieldId, value) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== pluginId) return p
        return {
          ...p,
          sections: p.sections.map((s) => {
            if (s.id !== sectionId) return s
            return {
              ...s,
              fields: s.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
            }
          }),
        }
      }),
    })
  },

  fieldAction: async (pluginId, sectionId, fieldId, kind) => {
    // TODO: implement action dispatch
    return Promise.resolve()
  },

  syncDiscordServiceState: (discordService) => {
    if (!discordService) return
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== 'discord') return p
        const nextStatus = discordService.enabled && discordService.running ? 'connected' : 'disabled'
        return { ...p, enabled: discordService.enabled, status: nextStatus }
      }),
    })
  },

  syncKvmState: (kvmState, enabled) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== 'kvm-detector') return p
        let status: Plugin['status']
        let statusLine: string
        if (!enabled) {
          status = 'disabled'
          statusLine = 'Disabled'
        } else if (!kvmState.deviceInstanceId) {
          status = 'installed'
          statusLine = 'No device selected'
        } else if (kvmState.connected) {
          status = 'connected'
          statusLine = 'Connected'
        } else {
          status = 'installed'
          statusLine = 'Disconnected'
        }
        return { ...p, enabled: enabled, status, statusLine }
      }),
    })
  },
}))
