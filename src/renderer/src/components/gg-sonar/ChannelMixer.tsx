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
  const { activePresetIds, patchClassicVolume, patchRedirection, patchRouting, setActivePreset, visibleChannels } = useSonarStore()

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
    setActivePreset(channel, presetId)
    window.api.sonarSelectPreset(presetId).catch(console.error)

    // Emit notification if enabled
    window.api.getSettings().then((settings) => {
      const notifCfg = settings.notifications?.sonar?.presetChange
      if (notifCfg?.enabled) {
        const preset = sonarState.configs.find((c) => c.id === presetId)
        const presetName = preset?.name ?? 'Preset'
        const ttl = settings.notifications?.durationMs ?? 2400
        if (notifCfg.shape === 'circle') {
          window.api.notifPush({ kind: 'circle', key: 'sonar-preset', iconId: 'sonar', ttl })
        } else {
          window.api.notifPush({
            kind: 'rect',
            key: 'sonar-preset',
            iconId: 'sonar',
            title: 'GG Sonar',
            subtitle: `Preset: ${presetName}`,
            ttl,
          })
        }
      }
    }).catch(console.error)
  }

  function handleDeviceSelect(channel: SonarChannel, deviceId: string): void {
    if (channel === 'master') return
    const device = sonarState.audioDevices.find((d) => d.id === deviceId)
    if (device) patchRedirection(channel as SonarDeviceChannel, device)
    window.api.sonarSetRedirection(channel as SonarDeviceChannel, deviceId).catch(console.error)
  }

  function handleProcessDrop(targetChannel: SonarChannel, processId: number): void {
    patchRouting(processId, targetChannel)
    window.api.sonarRouteProcess(processId, targetChannel).catch(console.error)
  }

  return (
    <div className="flex overflow-x-auto gap-3 items-stretch">
      {CHANNEL_DEFS.filter(({ channel }) => visibleChannels.has(channel)).map(({ channel, label }) => {
        const { volume, muted } = getVolume(channel)
        return (
          <ChannelStrip
            key={channel}
            channel={channel}
            label={label}
            volume={volume}
            muted={muted}
            streamerMix={getStreamerMix(channel)}
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
            onProcessDrop={(processId, _sourceRole) => handleProcessDrop(channel, processId)}
          />
        )
      })}
    </div>
  )
}
