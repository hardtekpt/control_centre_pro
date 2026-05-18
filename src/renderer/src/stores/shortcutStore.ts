import { create } from 'zustand'
import { combosEqual } from '../lib/shortcuts/keys'
import type { Shortcut, ShortcutScope } from '../../../shared/types'

export type { Shortcut }

interface ShortcutStoreState {
  items: Shortcut[]
  load: (items: Shortcut[]) => void
  create: (input: Omit<Shortcut, 'id' | 'enabled'>) => string
  update: (id: string, patch: Partial<Shortcut>) => void
  toggle: (id: string) => void
  remove: (id: string) => void
  findConflict: (combo: string[], ignoreId?: string) => Shortcut | undefined
}

export { type ShortcutScope }

export const useShortcutStore = create<ShortcutStoreState>((set, get) => ({
  items: [],

  load: (items) => set({ items }),

  create: (input) => {
    const id = 'sc-' + Math.random().toString(36).slice(2, 10)
    const s: Shortcut = { id, enabled: true, ...input }
    set({ items: [...get().items, s] })
    void window.api.shortcutsSave(get().items)
    return id
  },

  update: (id, patch) => {
    set({ items: get().items.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
    void window.api.shortcutsSave(get().items)
  },

  toggle: (id) => {
    const s = get().items.find((x) => x.id === id)
    if (s) get().update(id, { enabled: !s.enabled })
  },

  remove: (id) => {
    set({ items: get().items.filter((s) => s.id !== id) })
    void window.api.shortcutsSave(get().items)
  },

  findConflict: (combo, ignoreId) =>
    get().items.find((s) => s.id !== ignoreId && s.enabled && combosEqual(s.keys, combo)),
}))
