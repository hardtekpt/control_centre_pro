import { useMemo, useCallback, useEffect, useRef } from 'react'
import { useSonarStore } from '../../stores/sonarStore'
import { ChannelStrip } from './ChannelStrip'
import { notifySonarPresetChange } from '../../lib/notifyFromEvent'
import type {
  SonarState,
  SonarChannel,
  SonarDeviceChannel,
  SonarConfig,
  SonarAudioSession,
  SonarStreamerMix,
} from '@shared/types'

// ─── Channel definitions ──────────────────────────────────────────────────────

const CHANNEL_DEFS: { channel: SonarChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'game', label: 'Game' },
  { channel: 'media', label: 'Media' },
  { channel: 'chatRender', label: 'Chat' },
  { channel: 'chatCapture', label: 'Mic' },
  { channel: 'aux', label: 'Aux' },
]

// ─── ChannelMixer ─────────────────────────────────────────────────────────────

interface ChannelMixerProps {
  sonarState: SonarState
}

export function ChannelMixer({ sonarState }: ChannelMixerProps): JSX.Element {
  const activePresetIds    = useSonarStore(s => s.activePresetIds)
  const visibleChannels    = useSonarStore(s => s.visibleChannels)
  const patchClassicVolume = useSonarStore(s => s.patchClassicVolume)
  const patchRedirection   = useSonarStore(s => s.patchRedirection)
  const patchRouting       = useSonarStore(s => s.patchRouting)
  const setActivePreset    = useSonarStore(s => s.setActivePreset)

  // Group presets by virtualAudioDevice (which is the channel name: game, chatRender, etc.)
  const presetsByChannel = useMemo(() => {
    const map: Record<string, SonarConfig[]> = {}
    for (const config of sonarState.configs) {
      const ch = config.virtualAudioDevice
      if (!map[ch]) map[ch] = []
      map[ch].push(config)
    }
    // Sort by isFavorite first, then name
    for (const ch in map) {
      map[ch].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }
    return map
  }, [sonarState.configs])

  // Group audio sessions by route role
  const sessionsByRole = useMemo(() => {
    const map: Record<string, SonarAudioSession[]> = {}
    for (const route of sonarState.routing) {
      if (route.role === 'none') continue
      if (!map[route.role]) map[route.role] = []
      map[route.role].push(...route.audioSessions)
    }
    return map
  }, [sonarState.routing])

  const volumes = useMemo(() => {
    const classic = sonarState.classic
    const map: Record<string, { volume: number; muted: boolean }> = {}
    for (const def of CHANNEL_DEFS) {
      if (def.channel === 'master') {
        map['master'] = classic?.masters.classic ?? { volume: 1, muted: false }
      } else {
        map[def.channel] = classic?.devices[def.channel as SonarDeviceChannel]?.classic ?? { volume: 1, muted: false }
      }
    }
    return map
  }, [sonarState.classic])

  const streamerMixes = useMemo(() => {
    const streamer = sonarState.streamer
    const map: Record<string, SonarStreamerMix | undefined> = {}
    for (const def of CHANNEL_DEFS) {
      if (def.channel === 'master') {
        map['master'] = streamer?.masters.stream
      } else {
        map[def.channel] = streamer?.devices[def.channel as SonarDeviceChannel]?.stream
      }
    }
    return map
  }, [sonarState.streamer])

  const handleVolume = useCallback((channel: SonarChannel, value: number): void => {
    patchClassicVolume(channel, { volume: value })
    window.api.sonarSetVolume(channel, value).catch(console.error)
  }, [patchClassicVolume])

  const handleMute = useCallback((channel: SonarChannel): void => {
    const vol = volumes[channel] ?? { volume: 1, muted: false }
    patchClassicVolume(channel, { muted: !vol.muted })
    window.api.sonarSetMute(channel, !vol.muted).catch(console.error)
  }, [patchClassicVolume, volumes])

  const handlePresetSelect = useCallback((channel: SonarChannel, presetId: string): void => {
    setActivePreset(channel, presetId)
    window.api.sonarSelectPreset(presetId).catch(console.error)
    const preset = sonarState.configs.find((c) => c.id === presetId)
    notifySonarPresetChange(preset?.name ?? 'Preset')
  }, [setActivePreset, sonarState.configs])

  const handleDeviceSelect = useCallback((channel: SonarChannel, deviceId: string): void => {
    if (channel === 'master') return
    const device = sonarState.audioDevices.find((d) => d.id === deviceId)
    if (device) patchRedirection(channel as SonarDeviceChannel, device)
    window.api.sonarSetRedirection(channel as SonarDeviceChannel, deviceId).catch(console.error)
  }, [patchRedirection, sonarState.audioDevices])

  // Stable per-channel drop handlers stored in a ref so ChannelStrip memo isn't busted
  const dropHandlersRef = useRef<Record<string, (pid: number) => void>>({})
  useEffect(() => {
    for (const { channel } of CHANNEL_DEFS) {
      dropHandlersRef.current[channel] = (pid: number) => {
        patchRouting(pid, channel)
        window.api.sonarRouteProcess(pid, channel).catch(console.error)
      }
    }
  }, [patchRouting])

  return (
    <div className="flex overflow-x-auto gap-3 items-stretch">
      {CHANNEL_DEFS.filter(({ channel }) => visibleChannels.has(channel)).map(({ channel, label }) => (
        <ChannelStrip
          key={channel}
          channel={channel}
          label={label}
          volume={volumes[channel]?.volume ?? 1}
          muted={volumes[channel]?.muted ?? false}
          streamerMix={streamerMixes[channel]}
          mode={sonarState.mode}
          presets={presetsByChannel[channel] ?? []}
          activePresetId={activePresetIds[channel]}
          routedSessions={sessionsByRole[channel] ?? []}
          audioDevices={sonarState.audioDevices}
          currentDevice={sonarState.redirections[channel]}
          onVolume={handleVolume}
          onMute={handleMute}
          onPresetSelect={handlePresetSelect}
          onDeviceSelect={handleDeviceSelect}
          onProcessDrop={dropHandlersRef.current[channel]}
        />
      ))}
    </div>
  )
}
