import { useMemo } from 'react'
import { useSonarStore } from '../../stores/sonarStore'
import { ChannelStrip } from './ChannelStrip'
import type {
  SonarState,
  SonarChannel,
  SonarDeviceChannel,
  SonarConfig,
  SonarAudioSession,
} from '@shared/types'

// ─── Channel definitions ──────────────────────────────────────────────────────

const CHANNEL_DEFS: { channel: SonarChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'game', label: 'Game' },
  { channel: 'chatRender', label: 'Chat' },
  { channel: 'chatCapture', label: 'Mic' },
  { channel: 'media', label: 'Media' },
  { channel: 'aux', label: 'Aux' },
]

// ─── ChannelMixer ─────────────────────────────────────────────────────────────

interface ChannelMixerProps {
  sonarState: SonarState
  onPresetEdit: (config: SonarConfig) => void
}

export function ChannelMixer({ sonarState, onPresetEdit }: ChannelMixerProps): JSX.Element {
  const { activePresetIds, patchClassicVolume, setActivePreset, visibleChannels } = useSonarStore()

  // Group presets by virtualAudioDevice and track which device maps to which channel
  const { presetsByChannel, channelToDevice } = useMemo(() => {
    const presets: Record<string, SonarConfig[]> = {}
    const deviceMap: Record<string, string> = {}

    for (const config of sonarState.configs) {
      const device = config.virtualAudioDevice
      if (!presets[device]) presets[device] = []
      presets[device].push(config)

      // Map channel names to virtualAudioDevice based on device name heuristic
      // Assume device contains channel info (e.g., "Sonar Game Audio" → 'game')
      const deviceLower = device.toLowerCase()
      if (deviceLower.includes('game')) deviceMap['game'] = device
      else if (deviceLower.includes('capture') || deviceLower.includes('input')) deviceMap['chatCapture'] = device
      else if (deviceLower.includes('render') || deviceLower.includes('output') || deviceLower.includes('chat')) {
        // Only set chatRender if not already set or if this is more specific
        if (!deviceMap['chatRender'] || deviceLower.includes('render')) deviceMap['chatRender'] = device
      } else if (deviceLower.includes('media')) deviceMap['media'] = device
      else if (deviceLower.includes('aux')) deviceMap['aux'] = device
      else if (deviceLower.includes('master')) deviceMap['master'] = device
    }
    // Sort by isFavorite first, then name
    for (const ch in presets) {
      presets[ch].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }
    return { presetsByChannel: presets, channelToDevice: deviceMap }
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

  function getVolume(channel: SonarChannel): { volume: number; muted: boolean } {
    const classic = sonarState.classic
    if (!classic) return { volume: 1, muted: false }
    if (channel === 'master') return classic.masters.classic
    return classic.devices[channel as SonarDeviceChannel].classic
  }

  function getStreamerMix(channel: SonarChannel) {
    const streamer = sonarState.streamer
    if (!streamer) return undefined
    if (channel === 'master') return streamer.masters.stream
    return streamer.devices[channel as SonarDeviceChannel].stream
  }

  function handleVolume(channel: SonarChannel, value: number): void {
    patchClassicVolume(channel, { volume: value })
    window.api.sonarSetVolume(channel, value).catch(console.error)
  }

  function handleMute(channel: SonarChannel): void {
    const { muted } = getVolume(channel)
    patchClassicVolume(channel, { muted: !muted })
    window.api.sonarSetMute(channel, !muted).catch(console.error)
  }

  function handlePresetSelect(channel: SonarChannel, presetId: string): void {
    const device = channelToDevice[channel]
    setActivePreset(device ?? channel, presetId)
    window.api.sonarSelectPreset(presetId).catch(console.error)
  }

  return (
    <div className="flex overflow-x-auto gap-3 items-stretch">
      {CHANNEL_DEFS.filter(({ channel }) => visibleChannels.has(channel)).map(({ channel, label }) => {
        const { volume, muted } = getVolume(channel)
        const device = channelToDevice[channel]
        return (
          <ChannelStrip
            key={channel}
            channel={channel}
            label={label}
            volume={volume}
            muted={muted}
            streamerMix={getStreamerMix(channel)}
            mode={sonarState.mode}
            presets={presetsByChannel[device] ?? presetsByChannel[channel] ?? []}
            activePresetId={activePresetIds[device] ?? activePresetIds[channel]}
            routedSessions={sessionsByRole[channel] ?? []}
            onVolume={handleVolume}
            onMute={handleMute}
            onPresetSelect={handlePresetSelect}
            onPresetEdit={onPresetEdit}
          />
        )
      })}
    </div>
  )
}
