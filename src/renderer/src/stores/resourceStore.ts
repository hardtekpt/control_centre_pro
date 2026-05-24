import { create } from 'zustand'
import type { ResourceSnapshot } from '@shared/types'

interface ResourceStoreState {
  snapshot: ResourceSnapshot | null
  setSnapshot: (snapshot: ResourceSnapshot) => void
  clearSnapshot: () => void
}

export const useResourceStore = create<ResourceStoreState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  clearSnapshot: () => set({ snapshot: null }),
}))
