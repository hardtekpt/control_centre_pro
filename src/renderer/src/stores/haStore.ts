import { create } from 'zustand'
import type { HaState } from '@shared/types'

interface HaStoreState {
  haState: HaState | null
  setHaState: (state: HaState) => void
}

export const useHaStore = create<HaStoreState>((set) => ({
  haState: null,
  setHaState: (state) => set({ haState: state }),
}))
