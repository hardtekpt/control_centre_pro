import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  SonarState, SonarChannel, SonarDeviceChannel, SonarChannelVolume,
  SonarAudioDevice, SonarRedirections, SonarDeviceRoute, SonarAudioSession,
} from '@shared/types'
import { DEFAULT_PRESET_CHIPS, type UserPresetChip } from '../features/sonar/data/catalogues'

// Module-level drag tracking — not Zustand state, so no re-renders
// Tracks which channels have an active fader drag; setSonarState preserves
// their volumes from the previous state rather than overwriting with backend data.
const _draggingChannels: Set<string> = new Set()

// Pending selections — user choices held for 5 s to survive API refreshes
let _pendingPresetSelections: Record<string, number> = {}
let _pendingRedirections: Record<string, number> = {}  // channel → expiry timestamp

// Pending routing moves — session processId → target channel + expiry timestamp
// Reapplied on top of API state until expiry, matching the playback device pattern
let _pendingRoutingMoves: Record<number, { toChannel: string; expiry: number }> = {}

interface SonarStoreState {
  sonarState: SonarState | null
  /** Tracks which preset is active per virtualAudioDevice (local-only, not from API) */
  activePresetIds: Record<string, string>
  /** Tracks which channels are visible in the mixer */
  visibleChannels: Set<SonarChannel>
  /** User-configured preset chips (ordered list, fully editable) */
  presetChips: UserPresetChip[]

  setSonarState: (state: SonarState) => void
  /** Optimistic patch for a channel's classic volume/mute — avoids fader flicker during poll cycle */
  patchClassicVolume: (channel: SonarChannel, patch: Partial<SonarChannelVolume>) => void
  /** Optimistic patch for a channel's playback device — avoids selector reverting during poll cycle */
  patchRedirection: (channel: SonarDeviceChannel, device: SonarAudioDevice) => void
  /** Optimistic patch for a process routing move — avoids session jumping back during poll cycle */
  patchRouting: (processId: number, toChannel: string) => void
  setActivePreset: (virtualAudioDevice: string, presetId: string) => void
  setChannelVisibility: (channel: SonarChannel, visible: boolean) => void
  setPresetChips: (chips: UserPresetChip[]) => void
  /** Lock/unlock a channel against backend volume updates while the fader is being dragged */
  beginDrag: (channel: string) => void
  endDrag: (channel: string) => void
}

const DEFAULT_VISIBLE_CHANNELS: SonarChannel[] = ['master', 'game', 'chatRender', 'chatCapture', 'media', 'aux']

export const useSonarStore = create<SonarStoreState>()(
  persist(
    (set) => ({
      sonarState: null,
      activePresetIds: {},
      visibleChannels: new Set(DEFAULT_VISIBLE_CHANNELS),
      presetChips: DEFAULT_PRESET_CHIPS,

      setSonarState: (state) =>
        set((s) => {
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

          // Merge routing: reapply any pending session moves on top of fresh API data.
          // Clear expired moves; then reapply all remaining pending moves.
          for (const pid in _pendingRoutingMoves) {
            if (now >= _pendingRoutingMoves[pid].expiry) {
              delete _pendingRoutingMoves[pid]
            }
          }
          let mergedRouting = state.routing.map((r) => ({ ...r, audioSessions: [...r.audioSessions] }))
          if (Object.keys(_pendingRoutingMoves).length > 0) {
            for (const pidStr in _pendingRoutingMoves) {
              const pid = Number(pidStr)
              const { toChannel } = _pendingRoutingMoves[pid]
              // Find the session in the merged routing
              let session: SonarAudioSession | undefined
              for (const route of mergedRouting) {
                session = route.audioSessions.find((s) => s.processId === pid)
                if (session) break
              }
              // Also check the API state as fallback
              if (!session) {
                for (const route of state.routing) {
                  session = route.audioSessions.find((s) => s.processId === pid)
                  if (session) break
                }
              }
              if (!session) continue

              // Remove session from all routes, then add to target
              mergedRouting = mergedRouting.map((r) => ({
                ...r,
                audioSessions: r.audioSessions.filter((s) => s.processId !== pid),
              }))
              const targetRoute = mergedRouting.find((r) => r.role === toChannel)
              if (targetRoute) {
                targetRoute.audioSessions = [...targetRoute.audioSessions, session]
              }
            }
          }

          // Preserve classic volumes for channels currently being dragged so
          // a background poll cannot overwrite the user's in-progress adjustment.
          let classic = state.classic
          if (classic && _draggingChannels.size > 0 && s.sonarState?.classic) {
            const prev = s.sonarState.classic
            let newMasters = classic.masters
            const newDevices = { ...classic.devices }
            for (const ch of _draggingChannels) {
              if (ch === 'master') {
                newMasters = { ...newMasters, classic: prev.masters.classic }
              } else {
                const prevDev = prev.devices[ch as SonarDeviceChannel]
                const currDev = newDevices[ch as SonarDeviceChannel]
                if (prevDev && currDev) {
                  newDevices[ch as SonarDeviceChannel] = { ...currDev, classic: prevDev.classic }
                }
              }
            }
            classic = { ...classic, masters: newMasters, devices: newDevices }
          }

          return {
            sonarState: { ...state, classic, redirections: mergedRedirections, routing: mergedRouting },
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
        _pendingRoutingMoves[processId] = { toChannel, expiry: Date.now() + 5000 }
        set((s) => {
          if (!s.sonarState) return s
          // Find the session to move
          let session: SonarAudioSession | undefined
          for (const route of s.sonarState.routing) {
            session = route.audioSessions.find((ss) => ss.processId === processId)
            if (session) break
          }
          if (!session) return s
          // Move the session: remove from all routes, add to target
          let newRouting = s.sonarState.routing.map((r) => ({
            ...r,
            audioSessions: r.audioSessions.filter((ss) => ss.processId !== processId),
          }))
          const targetIdx = newRouting.findIndex((r) => r.role === toChannel)
          if (targetIdx >= 0) {
            newRouting[targetIdx] = {
              ...newRouting[targetIdx],
              audioSessions: [...newRouting[targetIdx].audioSessions, session],
            }
          }
          return {
            sonarState: {
              ...s.sonarState,
              routing: newRouting,
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
          if (visible) newSet.add(channel)
          else newSet.delete(channel)
          return { visibleChannels: newSet }
        }),

      setPresetChips: (chips) => set({ presetChips: chips }),

      beginDrag: (channel) => { _draggingChannels.add(channel) },
      endDrag: (channel) => { _draggingChannels.delete(channel) },
    }),
    {
      name: 'sonar-store',
      partialize: (state) => ({
        visibleChannels: Array.from(state.visibleChannels),
        presetChips: state.presetChips,
        activePresetIds: state.activePresetIds,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        visibleChannels: new Set((persistedState as any).visibleChannels || DEFAULT_VISIBLE_CHANNELS),
        presetChips: ((persistedState as any).presetChips ?? DEFAULT_PRESET_CHIPS).filter(
          (c: any) => c.uid && c.configName && c.virtualAudioDevice && c.label && c.iconKey
        ),
        activePresetIds: (persistedState as any).activePresetIds ?? {},
      }),
    }
  )
)
