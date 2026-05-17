import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  SonarState, SonarChannel, SonarDeviceChannel, SonarChannelVolume,
  SonarAudioDevice, SonarRedirections, SonarDeviceRoute, SonarAudioSession,
} from '@shared/types'

// Module-level drag tracking — not Zustand state, so no re-renders
let _activeDrags = 0
let _postDragHoldTimer: ReturnType<typeof setTimeout> | null = null

// Pending selections — user choices held for 5 s to survive API refreshes
let _pendingPresetSelections: Record<string, number> = {}
let _pendingRedirections: Record<string, number> = {}  // channel → expiry timestamp

// Per-session pending routing moves. Replaces the old single-expiry approach so
// that moving a session back immediately (before the backend confirms the first
// move) does not cause it to vanish.
let _pendingRoutingMoves = new Map<number, { toChannel: string; expiry: number }>()

/**
 * Apply any in-flight routing moves on top of `base` routing.
 * `fallback` (the previous optimistic routing) supplies session objects and
 * route metadata (deviceId/dataFlow) that may be absent from the backend
 * response when the target channel has no other sessions.
 */
function applyPendingMoves(
  base: SonarDeviceRoute[],
  moves: Map<number, { toChannel: string }>,
  fallback: SonarDeviceRoute[],
): SonarDeviceRoute[] {
  // Work on a shallow clone so we don't mutate the base array
  let result = base.map((r) => ({ ...r, audioSessions: [...r.audioSessions] }))

  for (const [processId, { toChannel }] of moves) {
    // Find the session — prefer the live backend data, fall back to previous optimistic state
    let session: SonarAudioSession | undefined
    for (const route of result) {
      session = route.audioSessions.find((s) => s.processId === processId)
      if (session) break
    }
    if (!session) {
      for (const route of fallback) {
        session = route.audioSessions.find((s) => s.processId === processId)
        if (session) break
      }
    }
    if (!session) continue

    // Remove the session from wherever it currently sits
    result = result.map((r) => ({
      ...r,
      audioSessions: r.audioSessions.filter((s) => s.processId !== processId),
    }))

    // Place the session in the target channel
    const targetIdx = result.findIndex((r) => r.role === toChannel)
    if (targetIdx >= 0) {
      result[targetIdx] = { ...result[targetIdx], audioSessions: [...result[targetIdx].audioSessions, session] }
    } else {
      // Target channel entry was absent from backend (empty channel may be omitted).
      // Reconstruct the route using metadata from the previous routing so the session
      // remains visible without waiting for the next periodic poll.
      const prevRoute = fallback.find((r) => r.role === toChannel)
      if (prevRoute) result.push({ ...prevRoute, audioSessions: [session] })
    }
  }

  return result
}

interface SonarStoreState {
  sonarState: SonarState | null
  /** Tracks which preset is active per virtualAudioDevice (local-only, not from API) */
  activePresetIds: Record<string, string>
  /** Tracks which channels are visible in the mixer */
  visibleChannels: Set<SonarChannel>

  setSonarState: (state: SonarState) => void
  /** Optimistic patch for a channel's classic volume/mute — avoids fader flicker during poll cycle */
  patchClassicVolume: (channel: SonarChannel, patch: Partial<SonarChannelVolume>) => void
  /** Optimistic patch for a channel's playback device — avoids selector reverting during poll cycle */
  patchRedirection: (channel: SonarDeviceChannel, device: SonarAudioDevice) => void
  /** Optimistic patch for a process routing move — avoids session jumping back during poll cycle */
  patchRouting: (processId: number, toChannel: string) => void
  setActivePreset: (virtualAudioDevice: string, presetId: string) => void
  setChannelVisibility: (channel: SonarChannel, visible: boolean) => void
  /** Called by VerticalFader on drag start/end to suppress poll updates during interaction */
  beginDrag: () => void
  endDrag: () => void
}

const DEFAULT_VISIBLE_CHANNELS: SonarChannel[] = ['master', 'game', 'chatRender', 'chatCapture', 'media', 'aux']

export const useSonarStore = create<SonarStoreState>()(
  persist(
    (set) => ({
      sonarState: null,
      activePresetIds: {},
      visibleChannels: new Set(DEFAULT_VISIBLE_CHANNELS),

      setSonarState: (state) =>
        set((s) => {
          // Suppress poll updates while a slider is being dragged or briefly after
          if (_activeDrags > 0 || _postDragHoldTimer !== null) return s
          const merged = { ...s.activePresetIds }
          const now = Date.now()

          // Clear expired pending preset selections and sync API state
          for (const channel in _pendingPresetSelections) {
            if (now >= _pendingPresetSelections[channel]) {
              delete _pendingPresetSelections[channel]
            }
          }
          // Update activePresetIds from API, but preserve pending user selections
          for (const config of state.configs) {
            const channel = config.virtualAudioDevice
            if (!(channel in _pendingPresetSelections) && config.isSelected) {
              merged[channel] = config.id
            }
          }

          // Build merged redirections — keep any channel whose write is still in flight
          for (const ch in _pendingRedirections) {
            if (now >= _pendingRedirections[ch]) delete _pendingRedirections[ch]
          }
          const mergedRedirections: SonarRedirections = { ...state.redirections }
          if (s.sonarState) {
            for (const ch in _pendingRedirections) {
              const pending = s.sonarState.redirections[ch]
              if (pending) mergedRedirections[ch] = pending
            }
          }

          // Merge routing: apply any still-pending session moves on top of backend data.
          // Expired moves are cleared first; remaining moves are applied per-session so
          // that a quick back-and-forth drag never loses a session from the visible routing.
          for (const [pid, move] of _pendingRoutingMoves) {
            if (now >= move.expiry) _pendingRoutingMoves.delete(pid)
          }
          const mergedRouting =
            _pendingRoutingMoves.size > 0 && s.sonarState
              ? applyPendingMoves(state.routing, _pendingRoutingMoves, s.sonarState.routing)
              : state.routing

          return {
            sonarState: { ...state, redirections: mergedRedirections, routing: mergedRouting },
            activePresetIds: merged,
          }
        }),

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

      patchRedirection: (channel, device) => {
        _pendingRedirections[channel] = Date.now() + 5000
        set((s) => {
          if (!s.sonarState) return s
          return {
            sonarState: {
              ...s.sonarState,
              redirections: { ...s.sonarState.redirections, [channel]: device },
            },
          }
        })
      },

      patchRouting: (processId, toChannel) => {
        _pendingRoutingMoves.set(processId, { toChannel, expiry: Date.now() + 5000 })
        set((s) => {
          if (!s.sonarState) return s
          return {
            sonarState: {
              ...s.sonarState,
              routing: applyPendingMoves(s.sonarState.routing, _pendingRoutingMoves, s.sonarState.routing),
            },
          }
        })
      },

      setActivePreset: (virtualAudioDevice, presetId) => {
        // Mark this preset selection as pending for 5 seconds
        // This keeps the user's selection on screen until the API confirms it
        _pendingPresetSelections[virtualAudioDevice] = Date.now() + 5000
        set((s) => ({ activePresetIds: { ...s.activePresetIds, [virtualAudioDevice]: presetId } }))
      },

      setChannelVisibility: (channel, visible) =>
        set((s) => {
          const newSet = new Set(s.visibleChannels)
          if (visible) {
            newSet.add(channel)
          } else {
            newSet.delete(channel)
          }
          return { visibleChannels: newSet }
        }),

      beginDrag: () => { _activeDrags++ },
      endDrag: () => {
        _activeDrags = Math.max(0, _activeDrags - 1)
        if (_activeDrags === 0) {
          if (_postDragHoldTimer !== null) clearTimeout(_postDragHoldTimer)
          // Hold off poll updates for 1.5 s — enough for the write to settle and
          // the next fast poll (1 s) to fetch the confirmed value from the API
          _postDragHoldTimer = setTimeout(() => { _postDragHoldTimer = null }, 1500)
        }
      },
    }),
    {
      name: 'sonar-store',
      partialize: (state) => ({
        visibleChannels: Array.from(state.visibleChannels),
        activePresetIds: state.activePresetIds,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        visibleChannels: new Set((persistedState as any).visibleChannels || DEFAULT_VISIBLE_CHANNELS),
        activePresetIds: (persistedState as any).activePresetIds ?? {},
      }),
    }
  )
)
