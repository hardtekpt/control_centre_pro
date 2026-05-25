import { create } from 'zustand'
import type { Plugin, ServiceInfo, KvmState, HaState, ResourceSnapshot } from '@shared/types'
import { DEFAULT_PLUGINS } from '../lib/plugins/catalog'

interface PluginStoreState {
  plugins: Plugin[]
  load: (plugins: Plugin[]) => void
  togglePlugin: (id: string) => void
  patchField: (pluginId: string, sectionId: string, fieldId: string, value: unknown) => void
  fieldAction: (pluginId: string, sectionId: string, fieldId: string, kind: string) => Promise<void>
  syncDiscordServiceState: (discordService: ServiceInfo | undefined) => void
  syncKvmState: (kvmState: KvmState, enabled: boolean) => void
  syncHaState: (haState: HaState) => void
  syncResourceMonitorState: (snapshot: ResourceSnapshot | null, enabled: boolean) => void
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
        if (id === 'home-assistant') {
          window.api.setServiceEnabled('home-assistant', nextEnabled)
          window.api.getSettings()
            .then((s) => window.api.setSettings({ ...s, haEnabled: nextEnabled }))
            .catch(console.error)
        }
        if (id === 'resource-monitor') {
          window.api.setServiceEnabled('resource-monitor', nextEnabled)
          window.api.getSettings()
            .then((s) => window.api.setSettings({ ...s, resourceMonitorEnabled: nextEnabled }))
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

  syncHaState: (haState) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== 'home-assistant') return p
        let status: Plugin['status']
        let statusLine: string
        const enabled = haState.status !== 'disabled'
        switch (haState.status) {
          case 'connected':
            status = 'connected'
            statusLine = `Connected · ${haState.entityCount} entities`
            break
          case 'error':
            status = 'error'
            statusLine = haState.error ?? 'Connection error'
            break
          case 'installed':
            status = 'installed'
            statusLine = 'Connecting…'
            break
          default:
            status = 'disabled'
            statusLine = 'Disabled'
        }
        return { ...p, status, statusLine, enabled }
      }),
    })
  },

  fieldAction: async (pluginId, sectionId, fieldId, kind) => {
    // TODO: implement action dispatch
    return Promise.resolve()
  },

  syncResourceMonitorState: (snapshot, enabled) => {
    set({
      plugins: get().plugins.map((p) => {
        if (p.id !== 'resource-monitor') return p

        const status: Plugin['status'] = !enabled ? 'disabled' : snapshot ? 'connected' : 'installed'
        const statusLine = !enabled
          ? 'Disabled'
          : snapshot
          ? `CPU ${snapshot.cpu.usagePercent.toFixed(0)} % · RAM ${snapshot.ram.usedPercent.toFixed(0)} %`
          : 'Starting…'

        if (!snapshot) {
          return { ...p, enabled, status, statusLine }
        }

        const fmt = (v: number | null | undefined, suffix: string, decimals = 0) =>
          v != null ? `${v.toFixed(decimals)} ${suffix}` : '—'

        const cpuTemp = fmt(snapshot.cpu.temperatureCelsius, '°C', 1)
        const cpuUsage = `${snapshot.cpu.usagePercent.toFixed(1)} %${cpuTemp !== '—' ? ` · ${cpuTemp}` : ''}`

        const ramUsed = `${snapshot.ram.usedGb.toFixed(1)} / ${snapshot.ram.totalGb.toFixed(1)} GB (${snapshot.ram.usedPercent.toFixed(0)} %)`
        const ramSwap = snapshot.ram.swapUsedPercent > 0 ? `${snapshot.ram.swapUsedPercent.toFixed(0)} %` : '—'

        const gpu = snapshot.gpu
        const gpuName = gpu?.name ?? '—'
        const gpuUsage = gpu ? fmt(gpu.usagePercent, '%', 1) : '—'
        const gpuVram = gpu && gpu.vramUsedGb != null && gpu.vramTotalGb != null
          ? `${gpu.vramUsedGb.toFixed(1)} / ${gpu.vramTotalGb.toFixed(1)} GB`
          : '—'
        const gpuTemp = gpu ? fmt(gpu.temperatureCelsius, '°C', 1) : '—'

        const diskSummary = snapshot.disks.length > 0
          ? snapshot.disks.map((d) => `${d.label} ${d.usedPercent.toFixed(0)} %`).join(' · ')
          : '—'

        const activeNets = snapshot.network.filter((n) => n.sentMbps > 0 || n.recvMbps > 0)
        const netSummary = activeNets.length > 0
          ? activeNets.map((n) => `↑ ${n.sentMbps.toFixed(2)} · ↓ ${n.recvMbps.toFixed(2)} MB/s`).join(' ')
          : '0 MB/s'

        const patch = (sections: Plugin['sections'], sectionId: string, fieldId: string, value: string) =>
          sections.map((s) =>
            s.id !== sectionId ? s : {
              ...s,
              fields: s.fields.map((f) => f.id !== fieldId ? f : { ...f, value }),
            }
          )

        let sections = p.sections
        sections = patch(sections, 'cpu', 'cpuUsage', cpuUsage)
        sections = patch(sections, 'cpu', 'cpuTemp', cpuTemp)
        sections = patch(sections, 'ram', 'ramUsage', ramUsed)
        sections = patch(sections, 'ram', 'ramSwap', ramSwap)
        sections = patch(sections, 'gpu', 'gpuName', gpuName)
        sections = patch(sections, 'gpu', 'gpuUsage', gpuUsage)
        sections = patch(sections, 'gpu', 'gpuVram', gpuVram)
        sections = patch(sections, 'gpu', 'gpuTemp', gpuTemp)
        sections = patch(sections, 'storage', 'diskSummary', diskSummary)
        sections = patch(sections, 'network', 'netSummary', netSummary)

        return { ...p, enabled, status, statusLine, sections }
      }),
    })
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
