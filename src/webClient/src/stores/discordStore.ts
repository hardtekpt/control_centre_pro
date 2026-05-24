import { create } from 'zustand'
import type { DiscordState } from '@shared/types'

interface DiscordStoreState {
  discordState: DiscordState | null
  setDiscordState: (state: DiscordState) => void
  patchParticipantVolume: (userId: string, volume: number) => void
  patchParticipantMute: (userId: string, muted: boolean) => void
}

export const useDiscordStore = create<DiscordStoreState>((set) => ({
  discordState: null,

  setDiscordState: (state) => set({ discordState: state }),

  patchParticipantVolume: (userId, volume) =>
    set((s) => {
      if (!s.discordState) return s
      return {
        discordState: {
          ...s.discordState,
          participants: s.discordState.participants.map((p) =>
            p.userId === userId ? { ...p, localVolume: volume } : p,
          ),
        },
      }
    }),

  patchParticipantMute: (userId, muted) =>
    set((s) => {
      if (!s.discordState) return s
      return {
        discordState: {
          ...s.discordState,
          participants: s.discordState.participants.map((p) =>
            p.userId === userId ? { ...p, localMuted: muted } : p,
          ),
        },
      }
    }),
}))
