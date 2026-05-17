import { create } from 'zustand'
import type { ReactNode } from 'react'

export type NotificationKind = 'rect' | 'volume' | 'circle' | 'ring' | 'glyph'

interface BaseNotification {
  id: number
  key?: string       // dedupe key — replaces existing item with same key
  kind: NotificationKind
  ttl?: number       // ms; omit = default 2400; Infinity = sticky
}

export interface RectNotification extends BaseNotification {
  kind: 'rect'
  icon: ReactNode
  title: string
  subtitle?: string
  tail?: string
  wide?: boolean
}

export interface VolumeNotification extends BaseNotification {
  kind: 'volume'
  icon: ReactNode
  label?: string
  value: number   // 0–100
}

export interface CircleNotification extends BaseNotification {
  kind: 'circle'
  icon: ReactNode
  dot?: boolean
}

export interface RingNotification extends BaseNotification {
  kind: 'ring'
  icon: ReactNode
  value: number   // 0–100
}

export interface GlyphNotification extends BaseNotification {
  kind: 'glyph'
  glyph: string
  sub?: string
}

export type Notification =
  | RectNotification
  | VolumeNotification
  | CircleNotification
  | RingNotification
  | GlyphNotification

// Distributive omit — applies Omit to each union member individually,
// preserving all variant-specific fields (icon, title, glyph, value, …)
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
export type NotificationInput = DistributiveOmit<Notification, 'id'>

interface NotificationStoreState {
  items: Notification[]
  push: (n: NotificationInput) => number
  dismiss: (id: number) => void
  clear: () => void
}

const MAX_VISIBLE = 3
let _nextId = 1

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  items: [],

  push: (n) => {
    let id = _nextId++
    set((s) => {
      let next = s.items

      // Dedupe: replace existing notification with same key in place, keep same id to reset TTL
      if (n.key) {
        const ix = next.findIndex((i) => i.key === n.key)
        if (ix >= 0) {
          id = next[ix].id  // Reuse existing id so TTL timer resets
          next = [...next]
          next[ix] = { ...n, id } as Notification
          return { items: next }
        }
      }

      next = [...next, { ...n, id } as Notification]
      if (next.length > MAX_VISIBLE) next = next.slice(-MAX_VISIBLE)
      return { items: next }
    })
    return id
  },

  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  clear: () => set({ items: [] }),
}))
