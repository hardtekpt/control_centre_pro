import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { useSonarStore } from '../../../stores/sonarStore'
import { ChannelStrip } from './ChannelStrip'
import { MasterStrip } from './MasterStrip'
import type {
  SonarState,
  SonarChannel,
  SonarDeviceChannel,
  SonarAudioSession,
} from '@shared/types'

// ── Channel definitions ───────────────────────────────────────────────────────

type ChannelDef = { channel: SonarChannel; label: string; icon: React.ReactNode }

function GameIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="18" y2="12" /><line x1="12" y1="6" x2="12" y2="18" />
      <rect x="2" y="6" width="20" height="12" rx="2" />
    </svg>
  )
}
function ChatIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function MediaIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  )
}
function AuxIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}
function MicIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

const CHANNEL_DEFS: ChannelDef[] = [
  { channel: 'game',        label: 'Game',  icon: <GameIcon /> },
  { channel: 'chatRender',  label: 'Chat',  icon: <ChatIcon /> },
  { channel: 'media',       label: 'Media', icon: <MediaIcon /> },
  { channel: 'aux',         label: 'Aux',   icon: <AuxIcon /> },
  { channel: 'chatCapture', label: 'Mic',   icon: <MicIcon /> },
]

// ── Peak simulation ───────────────────────────────────────────────────────────

type PeakMap = Record<string, number>

function initPeaks(sonarState: SonarState): PeakMap {
  const peaks: PeakMap = {}
  const classic = sonarState.classic
  for (const def of CHANNEL_DEFS) {
    const vol =
      def.channel === 'master'
        ? (classic?.masters.classic.volume ?? 0.7)
        : (classic?.devices[def.channel as SonarDeviceChannel]?.classic.volume ?? 0.7)
    peaks[def.channel] = Math.round(vol * 80)
  }
  peaks['master'] = Math.round((classic?.masters.classic.volume ?? 0.8) * 80)
  return peaks
}

// ── ChannelMixer ──────────────────────────────────────────────────────────────

interface ChannelMixerProps {
  sonarState: SonarState
}

export function ChannelMixer({ sonarState }: ChannelMixerProps): JSX.Element {
  const visibleChannels    = useSonarStore((s) => s.visibleChannels)
  const patchClassicVolume = useSonarStore((s) => s.patchClassicVolume)
  const patchRedirection   = useSonarStore((s) => s.patchRedirection)
  const patchRouting       = useSonarStore((s) => s.patchRouting)

  // Simulated peak meters — driven by a 100ms interval
  const [peaks, setPeaks] = useState<PeakMap>(() => initPeaks(sonarState))
  const volumesRef = useRef<Record<string, number>>({})

  // Keep a ref of current volumes so the interval closure doesn't stale
  useEffect(() => {
    const classic = sonarState.classic
    for (const def of CHANNEL_DEFS) {
      volumesRef.current[def.channel] =
        def.channel === 'chatCapture'
          ? (classic?.devices.chatCapture?.classic.volume ?? 0)
          : def.channel === 'chatRender'
            ? (classic?.devices.chatRender?.classic.volume ?? 0)
            : def.channel === 'game'
              ? (classic?.devices.game?.classic.volume ?? 0)
              : def.channel === 'media'
                ? (classic?.devices.media?.classic.volume ?? 0)
                : def.channel === 'aux'
                  ? (classic?.devices.aux?.classic.volume ?? 0)
                  : (classic?.masters.classic.volume ?? 0)
    }
    volumesRef.current['master'] = classic?.masters.classic.volume ?? 0
  }, [sonarState])

  useEffect(() => {
    const id = setInterval(() => {
      setPeaks((prev) => {
        const next = { ...prev }
        const allChannels = [...CHANNEL_DEFS.map((d) => d.channel), 'master' as SonarChannel]
        for (const ch of allChannels) {
          const vol = volumesRef.current[ch] ?? 0
          const base = vol * 85
          const jitter = (Math.random() - 0.45) * 18
          const target = Math.max(4, Math.min(100, base + jitter))
          next[ch] = (prev[ch] ?? 0) + (target - (prev[ch] ?? 0)) * 0.35
        }
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [])

  // Group sessions by role
  const sessionsByRole = useMemo(() => {
    const map: Record<string, SonarAudioSession[]> = {}
    for (const route of sonarState.routing) {
      if (route.role === 'none') continue
      if (!map[route.role]) map[route.role] = []
      map[route.role].push(...route.audioSessions)
    }
    return map
  }, [sonarState.routing])

  // Volumes / mutes
  const volumes = useMemo(() => {
    const classic = sonarState.classic
    const map: Record<string, { volume: number; muted: boolean }> = {}
    for (const def of CHANNEL_DEFS) {
      if (def.channel === 'chatCapture') {
        map[def.channel] = classic?.devices.chatCapture?.classic ?? { volume: 1, muted: false }
      } else if (def.channel === 'chatRender') {
        map[def.channel] = classic?.devices.chatRender?.classic ?? { volume: 1, muted: false }
      } else if (def.channel === 'game') {
        map[def.channel] = classic?.devices.game?.classic ?? { volume: 1, muted: false }
      } else if (def.channel === 'media') {
        map[def.channel] = classic?.devices.media?.classic ?? { volume: 1, muted: false }
      } else if (def.channel === 'aux') {
        map[def.channel] = classic?.devices.aux?.classic ?? { volume: 1, muted: false }
      }
    }
    map['master'] = classic?.masters.classic ?? { volume: 1, muted: false }
    return map
  }, [sonarState.classic])

  // Handlers
  const handleVolume = useCallback((channel: SonarChannel, value: number): void => {
    patchClassicVolume(channel, { volume: value })
    window.api.sonarSetVolume(channel, value).catch(console.error)
  }, [patchClassicVolume])

  const handleMute = useCallback((channel: SonarChannel): void => {
    const vol = volumes[channel] ?? { volume: 1, muted: false }
    patchClassicVolume(channel, { muted: !vol.muted })
    window.api.sonarSetMute(channel, !vol.muted).catch(console.error)
  }, [patchClassicVolume, volumes])

  const handleDeviceSelect = useCallback((channel: SonarChannel, deviceId: string): void => {
    if (channel === 'master') return
    const device = sonarState.audioDevices.find((d) => d.id === deviceId)
    if (device) patchRedirection(channel as SonarDeviceChannel, device)
    window.api.sonarSetRedirection(channel as SonarDeviceChannel, deviceId).catch(console.error)
  }, [patchRedirection, sonarState.audioDevices])

  const dropHandlersRef = useRef<Record<string, (pid: number) => void>>({})
  useEffect(() => {
    for (const { channel } of CHANNEL_DEFS) {
      dropHandlersRef.current[channel] = (pid: number) => {
        patchRouting(pid, channel)
        window.api.sonarRouteProcess(pid, channel).catch(console.error)
      }
    }
  }, [patchRouting])

  const visibleDefs = CHANNEL_DEFS.filter(({ channel }) => visibleChannels.has(channel))
  const masterVol = volumes['master'] ?? { volume: 1, muted: false }

  return (
    <div className="sn-mixer-section">
      <div className="sn-mixer-rail">
        {visibleDefs.map(({ channel, label, icon }) => {
          const vol = volumes[channel] ?? { volume: 1, muted: false }
          return (
            <ChannelStrip
              key={channel}
              channel={channel}
              label={label}
              icon={icon}
              volume={vol.volume}
              muted={vol.muted}
              peak={peaks[channel] ?? 0}
              routedSessions={sessionsByRole[channel] ?? []}
              audioDevices={sonarState.audioDevices}
              currentDevice={sonarState.redirections[channel]}
              onVolume={handleVolume}
              onMute={handleMute}
              onDeviceSelect={handleDeviceSelect}
              onProcessDrop={dropHandlersRef.current[channel] ?? (() => {})}
            />
          )
        })}

        <div className="sn-mixer-divider" />

        <MasterStrip
          volume={masterVol.volume}
          muted={masterVol.muted}
          peak={peaks['master'] ?? 0}
          audioDevices={sonarState.audioDevices}
          currentDevice={sonarState.redirections['master']}
          onVolume={handleVolume}
          onMute={handleMute}
          onDeviceSelect={handleDeviceSelect}
        />
      </div>
    </div>
  )
}
