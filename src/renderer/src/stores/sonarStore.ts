import { create } from 'zustand'
import type { SonarState, SonarChannel, SonarDeviceChannel, SonarChannelVolume } from '@shared/types'

interface SonarStoreState {
  sonarState: SonarState | null
  /** Tracks which preset is active per virtualAudioDevice (local-only, not from API) */
  activePresetIds: Record<string, string>

  setSonarState: (state: SonarState) => void
  /** Optimistic patch for a channel's classic volume/mute — avoids fader flicker during poll cycle */
  patchClassicVolume: (channel: SonarChannel, patch: Partial<SonarChannelVolume>) => void
  setActivePreset: (virtualAudioDevice: string, presetId: string) => void
}

export const useSonarStore = create<SonarStoreState>((set) => ({
  sonarState: null,
  activePresetIds: {},

  setSonarState: (state) => set({ sonarState: state }),

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
}))
