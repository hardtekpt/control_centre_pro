import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SonarState, SonarChannel, SonarDeviceChannel, SonarChannelVolume } from '@shared/types'

interface SonarStoreState {
  sonarState: SonarState | null
  /** Tracks which preset is active per virtualAudioDevice (local-only, not from API) */
  activePresetIds: Record<string, string>
  /** Tracks which channels are visible in the mixer */
  visibleChannels: Set<SonarChannel>

  setSonarState: (state: SonarState) => void
  /** Optimistic patch for a channel's classic volume/mute — avoids fader flicker during poll cycle */
  patchClassicVolume: (channel: SonarChannel, patch: Partial<SonarChannelVolume>) => void
  setActivePreset: (virtualAudioDevice: string, presetId: string) => void
  setChannelVisibility: (channel: SonarChannel, visible: boolean) => void
}

const DEFAULT_VISIBLE_CHANNELS: SonarChannel[] = ['master', 'game', 'chatRender', 'chatCapture', 'media', 'aux']

export const useSonarStore = create<SonarStoreState>()(
  persist(
    (set) => ({
      sonarState: null,
      activePresetIds: {},
      visibleChannels: new Set(DEFAULT_VISIBLE_CHANNELS),

      setSonarState: (state) =>
        set((s) => {
          const merged = { ...s.activePresetIds }
          for (const config of state.configs) {
            if (config.isSelected) merged[config.virtualAudioDevice] = config.id
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

      setActivePreset: (virtualAudioDevice, presetId) =>
        set((s) => ({ activePresetIds: { ...s.activePresetIds, [virtualAudioDevice]: presetId } })),

      setChannelVisibility: (channel, visible) =>
        set((s) => {
          const newSet = new Set(s.visibleChannels)
          if (visible) {
            newSet.add(channel)
          } else {
            newSet.delete(channel)
          }
          return { visibleChannels: newSet }
        }),
    }),
    {
      name: 'sonar-store',
      partialize: (state) => ({
        visibleChannels: Array.from(state.visibleChannels),
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        visibleChannels: new Set((persistedState as any).visibleChannels || DEFAULT_VISIBLE_CHANNELS),
      }),
    }
  )
)
