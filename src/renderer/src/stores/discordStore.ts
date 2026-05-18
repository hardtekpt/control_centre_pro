import { create } from 'zustand'
import type { DiscordState, DiscordParticipant } from '@shared/types'

interface DiscordStoreState {
  discordState: DiscordState | null

  setDiscordState: (state: DiscordState) => void
  patchParticipantVolume: (userId: string, volume: number) => void
  patchParticipantMute: (userId: string, muted: boolean) => void
}

const DEFAULT_STATE: DiscordState = {
  available: false,
  authenticated: false,
  error: null,
  voiceChannel: null,
  participants: [],
  selfMuted: false,
  selfDeafened: false,
  inputVolume: 100,
  outputVolume: 100,
}

function patchParticipant(
  participants: DiscordParticipant[],
  userId: string,
  patch: Partial<DiscordParticipant>,
): DiscordParticipant[] {
  return participants.map((p) => (p.userId === userId ? { ...p, ...patch } : p))
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
          participants: patchParticipant(s.discordState.participants, userId, {
            localVolume: volume,
          }),
        },
      }
    }),

  patchParticipantMute: (userId, muted) =>
    set((s) => {
      if (!s.discordState) return s
      return {
        discordState: {
          ...s.discordState,
          participants: patchParticipant(s.discordState.participants, userId, {
            localMuted: muted,
          }),
        },
      }
    }),
}))
