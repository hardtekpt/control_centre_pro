import { create } from 'zustand'
import type { SonarState, SonarChannel, SonarAudioDevice, SonarDeviceChannel, SonarChannelVolume, SonarAudioSession } from '@shared/types'
import { get, post } from '../api/http'

// Module-level drag tracking (same pattern as renderer store)
let _activeDrags = 0
let _postDragHoldTimer: ReturnType<typeof setTimeout> | null = null

interface SonarStoreState {
  sonarState: SonarState | null
  activePresetIds: Record<string, string>

  setSonarState: (state: SonarState) => void
  patchClassicVolume: (channel: SonarChannel, patch: Partial<SonarChannelVolume>) => void
  patchRedirection: (channel: SonarDeviceChannel, device: SonarAudioDevice) => void
  patchRouting: (processId: number, toChannel: string) => void
  setActivePreset: (virtualAudioDevice: string, presetId: string) => void
  fetchSonarState: () => Promise<void>
  beginDrag: () => void
  endDrag: () => void
}

export const useSonarStore = create<SonarStoreState>((set) => ({
  sonarState: null,
  activePresetIds: {},

  setSonarState: (state) =>
    set((s) => {
      if (_activeDrags > 0 || _postDragHoldTimer !== null) return s
      const merged = { ...s.activePresetIds }
      const now = Date.now()
      for (const config of state.configs) {
        const channel = config.virtualAudioDevice
        if (config.isSelected) {
          merged[channel] = config.id
        }
      }
      return { sonarState: state, activePresetIds: merged }
    }),

  patchClassicVolume: (channel, patch) =>
    set((s) => {
      if (!s.sonarState?.classic) return s
      const classic = s.sonarState.classic
      if (channel === 'master') {
        return {
          sonarState: {
            ...s.sonarState,
            classic: {
              ...classic,
              masters: { ...classic.masters, classic: { ...classic.masters.classic, ...patch } },
            },
          },
        }
      }
      const ch = channel as SonarDeviceChannel
      return {
        sonarState: {
          ...s.sonarState,
          classic: {
            ...classic,
            devices: {
              ...classic.devices,
              [ch]: { ...classic.devices[ch], classic: { ...classic.devices[ch].classic, ...patch } },
            },
          },
        },
      }
    }),

  patchRedirection: (channel, device) =>
    set((s) => {
      if (!s.sonarState) return s
      return {
        sonarState: {
          ...s.sonarState,
          redirections: { ...s.sonarState.redirections, [channel]: device },
        },
      }
    }),

  patchRouting: (processId, toChannel) =>
    set((s) => {
      if (!s.sonarState) return s
      // Find the session to move
      let session: SonarAudioSession | undefined
      for (const route of s.sonarState.routing) {
        session = route.audioSessions.find((ss) => ss.processId === processId)
        if (session) break
      }
      if (!session) return s
      // Remove it from all routes, then add to the route matching the target role
      const newRouting = s.sonarState.routing.map((r) => ({
        ...r,
        audioSessions: r.audioSessions.filter((ss) => ss.processId !== processId),
      }))
      const targetIdx = newRouting.findIndex((r) => r.role === toChannel)
      if (targetIdx >= 0) {
        newRouting[targetIdx] = {
          ...newRouting[targetIdx],
          audioSessions: [...newRouting[targetIdx].audioSessions, session],
        }
      }
      return { sonarState: { ...s.sonarState, routing: newRouting } }
    }),

  setActivePreset: (virtualAudioDevice, presetId) =>
    set((s) => ({ activePresetIds: { ...s.activePresetIds, [virtualAudioDevice]: presetId } })),

  fetchSonarState: async () => {
    try {
      const state = await get<SonarState>('/api/sonar/state')
      useSonarStore.getState().setSonarState(state)
    } catch {
      // Unreachable — will sync from WS on reconnect
    }
  },

  beginDrag: () => { _activeDrags++ },
  endDrag: () => {
    _activeDrags = Math.max(0, _activeDrags - 1)
    if (_activeDrags === 0) {
      if (_postDragHoldTimer !== null) clearTimeout(_postDragHoldTimer)
      _postDragHoldTimer = setTimeout(() => { _postDragHoldTimer = null }, 1500)
    }
  },
}))

// ── Sonar action helpers (called by pages, use REST API) ─────────────────────

export async function sonarSetVolume(channel: SonarChannel, volume: number): Promise<void> {
  useSonarStore.getState().patchClassicVolume(channel, { volume })
  await post('/api/sonar/volume', { channel, volume })
}

export async function sonarSetMute(channel: SonarChannel, muted: boolean): Promise<void> {
  useSonarStore.getState().patchClassicVolume(channel, { muted })
  await post('/api/sonar/mute', { channel, muted })
}

export async function sonarSelectPreset(presetId: string, virtualAudioDevice: string): Promise<void> {
  useSonarStore.getState().setActivePreset(virtualAudioDevice, presetId)
  await post('/api/sonar/preset', { presetId })
}

export async function sonarSetMode(mode: string): Promise<void> {
  await post('/api/sonar/mode', { mode })
}

export async function sonarSetRedirection(channel: SonarDeviceChannel, device: SonarAudioDevice): Promise<void> {
  useSonarStore.getState().patchRedirection(channel, device)
  await post('/api/sonar/redirection', { channel, deviceId: device.id })
}

export async function sonarRouteProcess(processId: number, targetChannel: string): Promise<void> {
  useSonarStore.getState().patchRouting(processId, targetChannel)
  await post('/api/sonar/route', { processId, targetChannel })
}
