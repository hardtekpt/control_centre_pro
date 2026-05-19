import { create } from 'zustand'
import type { KvmState } from '@shared/types'

interface KvmStoreState {
  kvmState: KvmState | null
  setKvmState: (state: KvmState) => void
}

export const useKvmStore = create<KvmStoreState>((set) => ({
  kvmState: null,
  setKvmState: (state) => set({ kvmState: state }),
}))
