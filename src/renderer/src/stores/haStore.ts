import { create } from 'zustand'
import type { HaState, HaEntity } from '@shared/types'

// ─── Optimistic patching (mirrors the GG Sonar store strategy) ──────────────────
//
// Hardware/HA round-trips are slow: a toggle or slider change isn't reflected in
// `haState` until Home Assistant pushes a fresh HA_STATE_CHANGE snapshot. To keep
// the UI responsive we patch the central store immediately (so every component
// reading the entity re-renders at once) and hold that optimistic value for a
// short window, reapplying it on top of any incoming backend snapshot so a stale
// push can't flip the control back. Same idea as `patchRedirection`/`patchRouting`
// + the pending-window merge in `setSonarState`.

interface PendingPatch {
  state?: string
  attributes?: Record<string, unknown>
  expiry: number
}

// Module-level (not Zustand state) — no re-renders, survives across setHaState calls.
const _pendingPatches: Record<string, PendingPatch> = {}
const HOLD_MS = 1500

function applyEntityPatch(entity: HaEntity, patch: { state?: string; attributes?: Record<string, unknown> }): HaEntity {
  return {
    ...entity,
    state: patch.state ?? entity.state,
    attributes: patch.attributes ? { ...entity.attributes, ...patch.attributes } : entity.attributes,
  }
}

// Reapply any in-flight optimistic patches on top of a fresh backend snapshot,
// dropping ones whose hold window has elapsed.
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
  setHaState: (state: HaState) => void
  /** Optimistic patch for a single entity's state/attributes — avoids controls
   *  reverting while the HA service call round-trips. */
  patchEntity: (entityId: string, patch: { state?: string; attributes?: Record<string, unknown> }) => void
}

export const useHaStore = create<HaStoreState>((set) => ({
  haState: null,

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
}))
