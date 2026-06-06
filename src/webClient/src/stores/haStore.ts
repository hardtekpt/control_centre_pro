import { create } from 'zustand'
import { get, post } from '../api/http'
import type { HaState, HaEntity, HaHomeCardEntity, HaServiceCall } from '@shared/types'

// Optimistic patching — same strategy as renderer haStore
interface PendingPatch {
  state?: string
  attributes?: Record<string, unknown>
  expiry: number
}

const _pendingPatches: Record<string, PendingPatch> = {}
const HOLD_MS = 1500

function applyEntityPatch(entity: HaEntity, patch: { state?: string; attributes?: Record<string, unknown> }): HaEntity {
  return {
    ...entity,
    state: patch.state ?? entity.state,
    attributes: patch.attributes ? { ...entity.attributes, ...patch.attributes } : entity.attributes,
  }
}

function reapplyPending(entities: HaEntity[]): HaEntity[] {
  const now = Date.now()
  for (const id in _pendingPatches) {
    if (now >= _pendingPatches[id].expiry) delete _pendingPatches[id]
  }
  if (Object.keys(_pendingPatches).length === 0) return entities
  return entities.map((e) => {
    const p = _pendingPatches[e.entity_id]
    return p ? applyEntityPatch(e, p) : e
  })
}

interface HaStoreState {
  haState: HaState | null
  cardEntities: HaHomeCardEntity[]
  cardEnabled: boolean
  setHaData: (state: HaState, cardEntities: HaHomeCardEntity[], cardEnabled: boolean) => void
  setHaState: (state: HaState) => void
  patchEntity: (entityId: string, patch: { state?: string; attributes?: Record<string, unknown> }) => void
  callService: (call: HaServiceCall) => Promise<void>
  fetchHaState: () => Promise<void>
}

export const useHaStore = create<HaStoreState>((set) => ({
  haState: null,
  cardEntities: [],
  cardEnabled: false,

  setHaData: (state, cardEntities, cardEnabled) =>
    set(() => ({
      haState: { ...state, entities: reapplyPending(state.entities) },
      cardEntities,
      cardEnabled,
    })),

  setHaState: (state) =>
    set(() => ({ haState: { ...state, entities: reapplyPending(state.entities) } })),

  patchEntity: (entityId, patch) => {
    const prev = _pendingPatches[entityId]
    _pendingPatches[entityId] = {
      state: patch.state ?? prev?.state,
      attributes: { ...prev?.attributes, ...patch.attributes },
      expiry: Date.now() + HOLD_MS,
    }
    set((s) => {
      if (!s.haState) return s
      return {
        haState: {
          ...s.haState,
          entities: s.haState.entities.map((e) =>
            e.entity_id === entityId ? applyEntityPatch(e, patch) : e,
          ),
        },
      }
    })
  },

  callService: async (call) => {
    await post('/api/ha/call', { domain: call.domain, service: call.service, serviceData: call.serviceData })
  },

  fetchHaState: async () => {
    try {
      const data = await get<{ state: HaState; cardEntities: HaHomeCardEntity[]; cardEnabled: boolean }>('/api/ha/state')
      if (data) {
        useHaStore.getState().setHaData(data.state, data.cardEntities, data.cardEnabled)
      }
    } catch {
      // Server unreachable — keep current state
    }
  },
}))
