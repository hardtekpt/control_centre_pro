import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore, sonarSetVolume, sonarSetMute, sonarSelectPreset } from '../stores/sonarStore'
import { useDiscordStore } from '../stores/discordStore'
import { useHaStore } from '../stores/haStore'
import { post } from '../api/http'
import { Card } from '../components/Card'
import { Select } from '../components/Select'
import { WifiIcon, BluetoothIcon, PowerIcon, AudioWaveIcon, LinkIcon } from '../components/icons'
import type { ArctisState, SonarChannel, SonarConfig, DdcMonitor, DiscordParticipant, HaHomeCardEntity, HaEntity } from '@shared/types'
import { DDC_INPUT_NAMES } from '@shared/types'

const CHANNEL_ORDER: SonarChannel[] = ['master', 'game', 'media', 'chatRender', 'chatCapture']
const CHANNEL_LABELS: Record<SonarChannel, string> = {
  master: 'Master',
  game: 'Game',
  media: 'Media',
  chatRender: 'Chat',
  chatCapture: 'Mic',
  aux: 'Aux',
}
// Map SonarChannel to the virtualAudioDevice key used in configs
const CHANNEL_TO_DEVICE: Record<SonarChannel, string> = {
  master: 'master',
  game: 'game',
  media: 'media',
  chatRender: 'chatRender',
  chatCapture: 'chatCapture',
  aux: 'aux',
}

export function Home(): JSX.Element {
  const arctis = useServiceStore((s) => s.arctisState)
  const ddcMonitors = useServiceStore((s) => s.ddcMonitors)
  const sonarState = useSonarStore((s) => s.sonarState)
  const activePresetIds = useSonarStore((s) => s.activePresetIds)
  const { beginDrag, endDrag } = useSonarStore()
  const discordState = useDiscordStore((s) => s.discordState)
  const haState = useHaStore((s) => s.haState)
  const cardEntities = useHaStore((s) => s.cardEntities)
  const cardEnabled = useHaStore((s) => s.cardEnabled)

  const showHa = cardEnabled && cardEntities.length > 0

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        Home
      </h1>

      {/* ── Arctis card ── */}
      <Card title="Arctis Nova Pro">
        {arctis ? (
          <ArctisCard arctis={arctis} />
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Not connected</span>
        )}
      </Card>

      {/* ── Sonar card ── */}
      <Card title="GG Sonar">
        {sonarState?.available ? (
          <SonarCard
            sonarState={sonarState}
            activePresetIds={activePresetIds}
            beginDrag={beginDrag}
            endDrag={endDrag}
          />
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Not available</span>
        )}
      </Card>

      {/* ── Discord card (hidden unless Discord is running) ── */}
      {discordState?.available && (
        <Card title="Discord">
          <DiscordCard discordState={discordState} />
        </Card>
      )}

      {/* ── Display card (all monitors combined) ── */}
      {ddcMonitors.length > 0 && (
        <Card title="Display" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[...ddcMonitors]
            .sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1))
            .map((m) => (
              <DisplayCard key={m.monitor_id} monitor={m} />
            ))}
        </Card>
      )}

      {/* ── Home Assistant card ── */}
      {showHa && <HaCard haState={haState} cardEntities={cardEntities} />}
    </div>
  )
}

// ── Discord card internals ────────────────────────────────────────────────────

function DiscordCard({ discordState }: { discordState: ReturnType<typeof useDiscordStore.getState>['discordState'] }): JSX.Element {
  const { patchParticipantVolume, patchParticipantMute } = useDiscordStore()
  const connected = !!(discordState?.available && discordState?.authenticated)

  if (!connected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LinkIcon color="var(--color-text-secondary)" size={14} title="Not connected" />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          {discordState?.error ?? 'Not connected'}
        </span>
      </div>
    )
  }

  const selfMuted = discordState?.selfMuted ?? false
  const selfDeafened = discordState?.selfDeafened ?? false
  const participants = discordState?.participants ?? []
  const channelName = discordState?.voiceChannel
    ? `${discordState.voiceChannel.guildName} · ${discordState.voiceChannel.name}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LinkIcon color="var(--color-ok)" size={14} title="Connected" />
        {channelName && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{channelName}</span>
        )}
      </div>

      {/* Self voice controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
          Voice
        </span>

        {/* Mute / Deafen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>Controls</span>
          <button
            onClick={() => void post('/api/discord/selfmute', { muted: !selfMuted })}
            title={selfMuted ? 'Unmute mic' : 'Mute mic'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: selfMuted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: selfMuted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 150ms ease',
            }}
          >
            {selfMuted ? '🎙' : 'M'}
          </button>
          <button
            onClick={() => void post('/api/discord/selfdeaf', { deafened: !selfDeafened })}
            title={selfDeafened ? 'Undeafen' : 'Deafen'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: selfDeafened ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: selfDeafened ? 'var(--color-bg)' : 'var(--color-text-secondary)',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 150ms ease',
            }}
          >
            {selfDeafened ? '🔇' : 'D'}
          </button>
        </div>

        {/* Mic input volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>Mic</span>
          <input
            type="range"
            min={0}
            max={100}
            value={discordState?.inputVolume ?? 100}
            onChange={(e) => void post('/api/discord/inputvolume', { volume: Number(e.target.value) })}
            style={{
              flex: 1,
              accentColor: selfMuted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              cursor: 'pointer',
              opacity: selfMuted ? 0.5 : 1,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 32, textAlign: 'right' }}>
            {discordState?.inputVolume ?? 100}%
          </span>
        </div>

        {/* Output volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>Output</span>
          <input
            type="range"
            min={0}
            max={100}
            value={discordState?.outputVolume ?? 100}
            onChange={(e) => void post('/api/discord/outputvolume', { volume: Number(e.target.value) })}
            style={{
              flex: 1,
              accentColor: selfDeafened ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              cursor: 'pointer',
              opacity: selfDeafened ? 0.5 : 1,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 32, textAlign: 'right' }}>
            {discordState?.outputVolume ?? 100}%
          </span>
        </div>
      </div>

      {/* Participants */}
      {participants.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
            Voice Channel
          </span>
          {participants.map((p) => (
            <ParticipantRow
              key={p.userId}
              participant={p}
              onVolumeChange={(userId, volume) => {
                patchParticipantVolume(userId, volume)
                void post('/api/discord/localvolume', { userId, volume })
              }}
              onMuteToggle={(userId, muted) => {
                patchParticipantMute(userId, muted)
                void post('/api/discord/localmute', { userId, muted })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ParticipantRow({
  participant,
  onVolumeChange,
  onMuteToggle,
}: {
  participant: DiscordParticipant
  onVolumeChange: (userId: string, volume: number) => void
  onMuteToggle: (userId: string, muted: boolean) => void
}): JSX.Element {
  const displayName = participant.nick || participant.username
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Speaking dot */}
      <div
        title={participant.speaking ? 'Speaking' : ''}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: participant.speaking ? 'var(--color-ok)' : 'var(--color-border)',
          flexShrink: 0,
          transition: 'background 150ms ease',
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: participant.muted || participant.deafened
            ? 'var(--color-text-secondary)'
            : 'var(--color-text-primary)',
          minWidth: 72,
          maxWidth: 72,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        title={displayName}
      >
        {displayName}
      </span>
      <input
        type="range"
        min={0}
        max={200}
        value={participant.localVolume}
        onChange={(e) => onVolumeChange(participant.userId, Number(e.target.value))}
        style={{
          flex: 1,
          accentColor: participant.localMuted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
          cursor: 'pointer',
          opacity: participant.localMuted ? 0.5 : 1,
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 32, textAlign: 'right' }}>
        {participant.localVolume}%
      </span>
      <button
        onClick={() => onMuteToggle(participant.userId, !participant.localMuted)}
        title={participant.localMuted ? 'Unmute' : 'Mute'}
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          border: '1px solid var(--color-border)',
          background: participant.localMuted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
          color: participant.localMuted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          fontSize: 10,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        M
      </button>
    </div>
  )
}

// ── Arctis card internals ─────────────────────────────────────────────────────

function ArctisCard({ arctis }: { arctis: ArctisState }): JSX.Element {
  const updateArctis = useServiceStore((s) => s.updateArctisState)

  async function sendCmd(cmd: string, value: unknown): Promise<void> {
    await post('/api/arctis/cmd', { cmd, value })
  }

  const btColor =
    arctis.btStatus === 'CONNECTED' ? 'var(--color-ok)'
    : arctis.btStatus === 'PAIRING' ? 'var(--color-warn)'
    : 'var(--color-text-secondary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header: battery + status dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <BatterySegments value={arctis.batteryHeadset} />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {Math.round(arctis.batteryHeadset)}%
        </span>
        {arctis.batteryDock > 0 && (
          <>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Dock</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
              {Math.round(arctis.batteryDock)}%
            </span>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <WifiIcon color={arctis.wirelessConnected ? 'var(--color-ok)' : 'var(--color-text-secondary)'} title="2.4 GHz" />
          <BluetoothIcon color={btColor} title={`BT: ${arctis.btStatus}`} />
          <PowerIcon
            color={arctis.headsetPowered === true ? 'var(--color-ok)' : 'var(--color-text-secondary)'}
            title="Power"
          />
        </div>
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={arctis.volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            updateArctis({ volume: v })
            void sendCmd('setVolume', v)
          }}
          style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-primary)', minWidth: 32, textAlign: 'right' }}>
          {Math.round(arctis.volume)}%
        </span>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Chip label={`ANC: ${formatAnc(arctis)}`} />
        <Chip label={`Sidetone: ${capitalize(arctis.sidetone)}`} />
        {arctis.chatmixEnabled && (
          <Chip label={`ChatMix: G${arctis.chatmixGame} / C${arctis.chatmixChat}`} />
        )}
        <Chip
          label={`Mic: ${arctis.micMuted ? 'Muted' : 'Active'}`}
          color={arctis.micMuted ? 'var(--color-warn)' : undefined}
        />
      </div>
    </div>
  )
}

// ── Sonar card internals ──────────────────────────────────────────────────────

function SonarCard({
  sonarState,
  activePresetIds,
  beginDrag,
  endDrag,
}: {
  sonarState: NonNullable<ReturnType<typeof useSonarStore.getState>['sonarState']>
  activePresetIds: Record<string, string>
  beginDrag: () => void
  endDrag: () => void
}): JSX.Element {
  const classic = sonarState.classic
  const configs = sonarState.configs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header: active indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <AudioWaveIcon color="var(--color-ok)" size={14} title="Active" />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Active</span>
      </div>

      {/* Channel blocks — slider on its own row, controls below */}
      {classic && CHANNEL_ORDER.map((ch) => {
        const vol = ch === 'master'
          ? classic.masters.classic
          : classic.devices[ch as keyof typeof classic.devices]?.classic
        if (!vol) return null

        const device = CHANNEL_TO_DEVICE[ch]
        const favorites = getFavoritesForChannel(configs, device)
        const activeId = activePresetIds[device] ?? configs.find(c => c.virtualAudioDevice === device && c.isSelected)?.id

        return (
          <div key={ch} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Row 1: volume slider only */}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(vol.volume * 100)}
              onChange={(e) => void sonarSetVolume(ch, Number(e.target.value) / 100)}
              onMouseDown={beginDrag}
              onTouchStart={beginDrag}
              onMouseUp={endDrag}
              onTouchEnd={endDrag}
              style={{
                width: '100%',
                accentColor: vol.muted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                cursor: 'pointer',
                opacity: vol.muted ? 0.5 : 1,
              }}
            />
            {/* Row 2: label · % · mute · preset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>
                {CHANNEL_LABELS[ch]}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 34 }}>
                {Math.round(vol.volume * 100)}%
              </span>
              <button
                onClick={() => void sonarSetMute(ch, !vol.muted)}
                title={vol.muted ? 'Unmute' : 'Mute'}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: vol.muted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                  color: vol.muted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                M
              </button>
              {favorites.length > 0 && (
                <div style={{ marginLeft: 'auto', maxWidth: 160, flex: 1 }}>
                  <Select
                    compact
                    ariaLabel={`${CHANNEL_LABELS[ch]} preset`}
                    value={activeId ?? ''}
                    placeholder="Preset"
                    onChange={(v) => void sonarSelectPreset(v, device)}
                    options={favorites.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Display card internals ────────────────────────────────────────────────────

function DisplayCard({ monitor }: { monitor: DdcMonitor }): JSX.Element {
  const supportsInput = monitor.supports.includes('input_source') && monitor.available_inputs.length > 0
  const supportsBrightness = monitor.supports.includes('brightness')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Monitor name + primary tag */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{monitor.name}</span>
        {monitor.is_primary && (
          <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary</span>
        )}
      </div>
      {supportsBrightness && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 72 }}>Brightness</span>
          <input
            type="range"
            min={0}
            max={100}
            value={monitor.brightness}
            onChange={(e) => {
              void post('/api/ddc/brightness', { monitorId: monitor.monitor_id, brightness: Number(e.target.value) })
            }}
            style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-primary)', minWidth: 32, textAlign: 'right' }}>
            {monitor.brightness}%
          </span>
        </div>
      )}
      {supportsInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 72 }}>Input</span>
          <div style={{ flex: 1 }}>
            <Select
              compact
              ariaLabel={`${monitor.name} input`}
              value={monitor.input_source}
              onChange={(v) => void post('/api/ddc/input', { monitorId: monitor.monitor_id, input: v })}
              options={monitor.available_inputs.map((inp) => ({ value: inp, label: DDC_INPUT_NAMES[inp] ?? inp }))}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function getFavoritesForChannel(configs: SonarConfig[], device: string): SonarConfig[] {
  return configs
    .filter((c) => c.virtualAudioDevice === device && c.isFavorite)
    .sort((a, b) => (a.favoritePosition ?? 0) - (b.favoritePosition ?? 0))
}

function formatAnc(arctis: ArctisState): string {
  if (arctis.ancMode === 'TRANSPARENCY') return `Transparency ${arctis.transparencyLevel}`
  return arctis.ancMode === 'ANC' ? 'ANC' : 'Off'
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

// ── Reusable primitives ───────────────────────────────────────────────────────

function BatterySegments({ value }: { value: number }): JSX.Element {
  const segments = 4
  const filled = Math.round((value / 100) * segments)
  const color = value > 20 ? 'var(--color-ok)' : 'var(--color-warn)'
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 14,
            borderRadius: 2,
            border: '1px solid var(--color-border)',
            background: i < filled ? color : 'var(--color-surface-raised)',
          }}
        />
      ))}
    </div>
  )
}

function Chip({ label, color }: { label: string; color?: string }): JSX.Element {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 7px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-raised)',
        color: color ?? 'var(--color-text-secondary)',
      }}
    >
      {label}
    </span>
  )
}

// ── Home Assistant card ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max, v = max
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h, s, v]
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6), f = h * 6 - i
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
  const c: [number, number, number][] = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]]
  const [r, g, b] = c[i % 6]
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

const PICKER_W = 200
const PICKER_H = 218
const SV_H = 140

function HaColorPicker({ value, onChange, onClose, anchorRect }: { value: string; onChange: (hex: string) => void; onClose: () => void; anchorRect: DOMRect }): JSX.Element {
  const [initH, initS, initV] = rgbToHsv(...hexToRgb(value))
  const [hue, setHue] = useState(initH)
  const [sat, setSat] = useState(initS)
  const [bri, setBri] = useState(initV)

  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'sv' | 'hue' | null>(null)
  const hsvRef = useRef([initH, initS, initV])

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (dragging.current === 'sv' && svRef.current) {
        const r = svRef.current.getBoundingClientRect()
        const s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
        const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))
        hsvRef.current[1] = s; hsvRef.current[2] = v
        setSat(s); setBri(v)
        onChange(rgbToHex(...hsvToRgb(hsvRef.current[0], s, v)))
      } else if (dragging.current === 'hue' && hueRef.current) {
        const r = hueRef.current.getBoundingClientRect()
        const h = Math.max(0, Math.min(0.9999, (e.clientX - r.left) / r.width))
        hsvRef.current[0] = h
        setHue(h)
        onChange(rgbToHex(...hsvToRgb(h, hsvRef.current[1], hsvRef.current[2])))
      }
    }
    const onUp = (): void => { dragging.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [onChange])

  const hueHex = rgbToHex(...hsvToRgb(hue, 1, 1))
  const currentHex = rgbToHex(...hsvToRgb(hue, sat, bri))

  const winW = window.innerWidth, winH = window.innerHeight
  let left = anchorRect.left
  let top = anchorRect.bottom + 6
  if (left + PICKER_W > winW - 8) left = winW - PICKER_W - 8
  if (top + PICKER_H > winH - 8) top = anchorRect.top - PICKER_H - 6
  if (left < 8) left = 8
  if (top < 8) top = 8

  return ReactDOM.createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div style={{ position: 'fixed', left, top, width: PICKER_W, zIndex: 9999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, userSelect: 'none' }}>
        <div ref={svRef} onMouseDown={e => { dragging.current = 'sv'; e.preventDefault() }} style={{ position: 'relative', height: SV_H, borderRadius: 4, cursor: 'crosshair', background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hueHex})`, border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'absolute', left: `${sat * 100}%`, top: `${(1 - bri) * 100}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.6)', background: currentHex, pointerEvents: 'none' }} />
        </div>
        <div ref={hueRef} onMouseDown={e => { dragging.current = 'hue'; e.preventDefault() }} style={{ position: 'relative', height: 14, borderRadius: 4, cursor: 'ew-resize', background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)', border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'absolute', left: `${hue * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 8, height: 18, borderRadius: 3, border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)', background: hueHex, pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0, background: currentHex, border: '1px solid var(--color-border)' }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{currentHex.toUpperCase()}</span>
        </div>
      </div>
    </>,
    document.body
  )
}

function HaEntityIcon({ type, color, isOn }: { type: string; color?: string; isOn: boolean }): JSX.Element {
  const P = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: color ?? (isOn ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'), strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (type) {
    case 'light': return <svg {...P}><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>
    case 'climate': return <svg {...P}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
    case 'scene': return <svg {...P}><polygon points="5 3 19 12 5 21 5 3"/></svg>
    case 'service_call': return <svg {...P}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    default: return <svg {...P}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
  }
}

function HaToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{ width: 32, height: 18, borderRadius: 9, background: on ? 'var(--color-text-primary)' : 'var(--color-border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 150ms' }}
    >
      <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: on ? 'var(--color-bg)' : 'var(--color-text-secondary)', transition: 'left 150ms' }} />
    </div>
  )
}

function HaFavouritesRow({ cfgs, entities }: { cfgs: HaHomeCardEntity[]; entities: HaEntity[] }): JSX.Element {
  const patchEntity = useHaStore((s) => s.patchEntity)
  const callService = useHaStore((s) => s.callService)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 8, marginBottom: 4, borderBottom: '1px solid var(--color-border)' }}>
      {cfgs.map((cfg) => {
        const entity = entities.find(e => e.entity_id === cfg.entityId)
        const isOn = entity?.state === 'on'
        const handleClick = (): void => {
          if (cfg.type === 'service_call') {
            if (cfg.serviceDomain && cfg.serviceName)
              void callService({ domain: cfg.serviceDomain, service: cfg.serviceName })
          } else if (cfg.type === 'scene') {
            void callService({ domain: 'scene', service: 'turn_on', serviceData: { entity_id: cfg.entityId } })
          } else if (cfg.type === 'light') {
            const on = entity?.state === 'on'
            patchEntity(cfg.entityId, { state: on ? 'off' : 'on' })
            void callService({ domain: 'light', service: on ? 'turn_off' : 'turn_on', serviceData: { entity_id: cfg.entityId } })
          }
        }
        const iconColor = cfg.iconColor
          ? (isOn ? cfg.iconColor : cfg.iconColor + '60')
          : (isOn ? 'var(--color-text-primary)' : 'var(--color-text-secondary)')
        return (
          <button key={cfg.entityId} onClick={handleClick} title={cfg.displayName ?? cfg.entityId} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-raised)', flexShrink: 0, color: iconColor, transition: 'color 150ms', padding: 0 }}>
            <HaEntityIcon type={cfg.icon ?? cfg.type} color={iconColor} isOn={isOn} />
          </button>
        )
      })}
    </div>
  )
}

function HaLightRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const patchEntity = useHaStore((s) => s.patchEntity)
  const callService = useHaStore((s) => s.callService)
  const attrs = entity.attributes as Record<string, unknown>
  const isOn = entity.state === 'on'
  const [pickerOpen, setPickerOpen] = useState(false)
  const swatchRef = useRef<HTMLDivElement>(null)

  const rawBrightness = typeof attrs.brightness === 'number' ? attrs.brightness as number : 0
  const brightness = rawBrightness / 255
  const minCt = typeof attrs.min_color_temp_kelvin === 'number' ? attrs.min_color_temp_kelvin as number : 2000
  const maxCt = typeof attrs.max_color_temp_kelvin === 'number' ? attrs.max_color_temp_kelvin as number : 6500
  const rawCtK = typeof attrs.color_temp_kelvin === 'number' ? attrs.color_temp_kelvin as number : minCt
  const ctNorm = (rawCtK - minCt) / (maxCt - minCt)
  const colorMode = String(attrs.color_mode ?? '')
  const showColorTemp = colorMode === 'color_temp' || typeof attrs.color_temp_kelvin === 'number'
  const showColor = ['hs', 'rgb', 'xy'].includes(colorMode)
  const effectList = Array.isArray(attrs.effect_list) ? attrs.effect_list as string[] : []
  const currentEffect = typeof attrs.effect === 'string' ? attrs.effect as string : null
  const rgbArr = Array.isArray(attrs.rgb_color) ? attrs.rgb_color as number[] : null
  const colorHex = rgbArr ? rgbToHex(rgbArr[0], rgbArr[1], rgbArr[2]) : '#ffffff'
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)

  const handleToggle = useCallback((): void => {
    patchEntity(cfg.entityId, { state: isOn ? 'off' : 'on' })
    void callService({ domain: 'light', service: isOn ? 'turn_off' : 'turn_on', serviceData: { entity_id: cfg.entityId } })
  }, [cfg.entityId, isOn, patchEntity, callService])

  const handleBrightness = useCallback((v: number): void => {
    const bright = Math.round(v * 255)
    patchEntity(cfg.entityId, { state: 'on', attributes: { brightness: bright } })
    void callService({ domain: 'light', service: 'turn_on', serviceData: { entity_id: cfg.entityId, brightness: bright } })
  }, [cfg.entityId, patchEntity, callService])

  const handleColorTemp = useCallback((v: number): void => {
    const kelvin = Math.round(minCt + v * (maxCt - minCt))
    patchEntity(cfg.entityId, { attributes: { color_temp_kelvin: kelvin } })
    void callService({ domain: 'light', service: 'turn_on', serviceData: { entity_id: cfg.entityId, color_temp_kelvin: kelvin } })
  }, [cfg.entityId, minCt, maxCt, patchEntity, callService])

  const handleColor = useCallback((hex: string): void => {
    const [r, g, b] = hexToRgb(hex)
    patchEntity(cfg.entityId, { attributes: { rgb_color: [r, g, b] } })
    void callService({ domain: 'light', service: 'turn_on', serviceData: { entity_id: cfg.entityId, rgb_color: [r, g, b] } })
  }, [cfg.entityId, patchEntity, callService])

  const handleEffect = useCallback((val: string): void => {
    patchEntity(cfg.entityId, { attributes: { effect: val } })
    void callService({ domain: 'light', service: 'turn_on', serviceData: { entity_id: cfg.entityId, effect: val } })
  }, [cfg.entityId, patchEntity, callService])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
        {showColor && (
          <>
            <div ref={swatchRef} onClick={() => setPickerOpen(o => !o)} title="Pick colour" style={{ width: 16, height: 16, borderRadius: '50%', background: colorHex, border: '1px solid var(--color-border)', cursor: 'pointer', flexShrink: 0 }} />
            {pickerOpen && swatchRef.current && (
              <HaColorPicker value={colorHex} onChange={handleColor} onClose={() => setPickerOpen(false)} anchorRect={swatchRef.current.getBoundingClientRect()} />
            )}
          </>
        )}
        {isOn && effectList.length > 0 && (
          <select value={currentEffect ?? 'None'} onChange={e => handleEffect(e.target.value)} style={{ fontSize: 11, background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="None">No effect</option>
            {effectList.map(ef => <option key={ef} value={ef}>{ef}</option>)}
          </select>
        )}
        <HaToggle on={isOn} onChange={handleToggle} />
      </div>
      {isOn && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>☀</span>
            <input type="range" min={0} max={255} value={rawBrightness} onChange={(e) => handleBrightness(Number(e.target.value) / 255)} style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 28, textAlign: 'right', flexShrink: 0 }}>{Math.round(brightness * 100)}%</span>
          </div>
          {showColorTemp && maxCt > minCt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>K</span>
              <input type="range" min={minCt} max={maxCt} value={rawCtK} onChange={(e) => handleColorTemp((Number(e.target.value) - minCt) / (maxCt - minCt))} style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 36, textAlign: 'right', flexShrink: 0 }}>{rawCtK}K</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HaClimateRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const patchEntity = useHaStore((s) => s.patchEntity)
  const callService = useHaStore((s) => s.callService)
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const currentTemp = typeof attrs.current_temperature === 'number' ? (attrs.current_temperature as number).toFixed(1) : '—'
  const minTemp = typeof attrs.min_temp === 'number' ? attrs.min_temp as number : 10
  const maxTemp = typeof attrs.max_temp === 'number' ? attrs.max_temp as number : 35
  const setpointRaw = typeof attrs.temperature === 'number' ? attrs.temperature as number : minTemp
  const hvacModes = Array.isArray(attrs.hvac_modes) ? attrs.hvac_modes as string[] : []
  const hvacMode = String(entity.state)

  const handleTemp = useCallback((v: number): void => {
    const temp = Math.round((minTemp + v * (maxTemp - minTemp)) * 2) / 2
    patchEntity(cfg.entityId, { attributes: { temperature: temp } })
    void callService({ domain: 'climate', service: 'set_temperature', serviceData: { entity_id: cfg.entityId, temperature: temp } })
  }, [cfg.entityId, minTemp, maxTemp, patchEntity, callService])

  const handleMode = useCallback((mode: string): void => {
    patchEntity(cfg.entityId, { state: mode })
    void callService({ domain: 'climate', service: 'set_hvac_mode', serviceData: { entity_id: cfg.entityId, hvac_mode: mode } })
  }, [cfg.entityId, patchEntity, callService])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{currentTemp}°</span>
        {hvacModes.length > 0 && (
          <select value={hvacMode} onChange={e => handleMode(e.target.value)} style={{ fontSize: 11, background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {hvacModes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: 56 }}>Setpoint</span>
        <input type="range" min={minTemp} max={maxTemp} step={0.5} value={setpointRaw} onChange={(e) => handleTemp((Number(e.target.value) - minTemp) / (maxTemp - minTemp))} style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }} />
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 36, textAlign: 'right' }}>{setpointRaw.toFixed(1)}°</span>
      </div>
    </div>
  )
}

function HaSensorRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const unit = typeof attrs.unit_of_measurement === 'string' ? attrs.unit_of_measurement as string : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{entity.state}{unit ? ` ${unit}` : ''}</span>
    </div>
  )
}

function HaSceneRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const callService = useHaStore((s) => s.callService)
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
      <button onClick={() => void callService({ domain: 'scene', service: 'turn_on', serviceData: { entity_id: cfg.entityId } })} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
        Activate
      </button>
    </div>
  )
}

function HaServiceCallRow({ cfg }: { cfg: HaHomeCardEntity }): JSX.Element {
  const callService = useHaStore((s) => s.callService)
  const name = cfg.displayName ?? `${cfg.serviceDomain}.${cfg.serviceName}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
      <button onClick={() => { if (cfg.serviceDomain && cfg.serviceName) void callService({ domain: cfg.serviceDomain, service: cfg.serviceName }) }} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
        Call
      </button>
    </div>
  )
}

function HaEntityRow({ cfg, entities }: { cfg: HaHomeCardEntity; entities: HaEntity[] }): JSX.Element | null {
  if (cfg.type === 'service_call') return <HaServiceCallRow cfg={cfg} />
  const entity = entities.find(e => e.entity_id === cfg.entityId)
  if (!entity) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', opacity: 0.5 }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)' }}>{cfg.displayName ?? cfg.entityId}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>unavailable</span>
    </div>
  )
  if (cfg.type === 'light') return <HaLightRow cfg={cfg} entity={entity} />
  if (cfg.type === 'climate') return <HaClimateRow cfg={cfg} entity={entity} />
  if (cfg.type === 'scene') return <HaSceneRow cfg={cfg} entity={entity} />
  return <HaSensorRow cfg={cfg} entity={entity} />
}

function HaCard({ haState, cardEntities }: { haState: ReturnType<typeof useHaStore.getState>['haState']; cardEntities: HaHomeCardEntity[] }): JSX.Element {
  const isConnected = haState?.status === 'connected'
  const liveEntities = haState?.entities ?? []
  const favourites = cardEntities.filter(cfg => cfg.favorite)
  const normal = cardEntities.filter(cfg => !cfg.favorite)

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Home Assistant</span>
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          <LinkIcon color={isConnected ? 'var(--color-ok)' : 'var(--color-text-secondary)'} size={14} title={isConnected ? 'Connected' : 'Disconnected'} />
        </span>
      </div>
      {favourites.length > 0 && <HaFavouritesRow cfgs={favourites} entities={liveEntities} />}
      <div>
        {normal.map((cfg, i) => (
          <HaEntityRow key={cfg.entityId + i} cfg={cfg} entities={liveEntities} />
        ))}
      </div>
    </div>
  )
}
