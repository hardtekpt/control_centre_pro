import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore, sonarSetVolume, sonarSetMute, sonarSelectPreset } from '../stores/sonarStore'
import { useDiscordStore } from '../stores/discordStore'
import { useHaStore } from '../stores/haStore'
import { post } from '../api/http'
import { Card } from '../components/Card'
import { Select } from '../components/Select'
import {
  WifiIcon, BluetoothIcon, PowerIcon, AudioWaveIcon, LinkIcon, MicIcon, MicOffIcon,
  HeadsetIcon, HeadsetOffIcon, MuteIcon, HomeIcon, SleepIcon, LockIcon, MonitorOffIcon,
  PlayPauseIcon, SkipBackIcon, SkipForwardIcon,
} from '../components/icons'
import {
  PageHeader, Field, Slider, Toggle, IconButton, Button, SectionLabel, OptionGroup,
  BatteryIndicator, text, space, size,
} from '../theme'
import { haptic } from '../utils/haptic'
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
    <div className="page">
      <PageHeader title="Home" />

      {/* ── Arctis card ── */}
      <Card title="Arctis Nova Pro">
        {arctis ? (
          <ArctisCard arctis={arctis} />
        ) : (
          <span style={text.bodyMuted}>Not connected</span>
        )}
      </Card>

      {/* ── Sonar card ── */}
      <Card
        title="GG Sonar"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <AudioWaveIcon
              color={sonarState?.available ? 'var(--color-ok)' : 'var(--color-text-secondary)'}
              size={12}
              title={sonarState?.available ? 'Active' : 'Inactive'}
            />
            <span style={text.caption}>{sonarState?.available ? 'Active' : 'Inactive'}</span>
          </div>
        }
      >
        {sonarState?.available ? (
          <SonarCard
            sonarState={sonarState}
            activePresetIds={activePresetIds}
            beginDrag={beginDrag}
            endDrag={endDrag}
          />
        ) : (
          <span style={text.bodyMuted}>Not available</span>
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
        <Card title="Display" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: space.sectionGap }}>
          {[...ddcMonitors]
            .sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1))
            .map((m) => (
              <DisplayCard key={m.monitor_id} monitor={m} />
            ))}
        </Card>
      )}

      {/* ── Home Assistant card ── */}
      {showHa && <HaCard haState={haState} cardEntities={cardEntities} />}

      {/* ── PC Controls card ── */}
      <Card title="PC Controls">
        <PCControlsCard />
      </Card>
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
        <span style={text.bodyMuted}>{discordState?.error ?? 'Not connected'}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.rowGap }}>
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LinkIcon color="var(--color-ok)" size={14} title="Connected" />
        {channelName && <span style={text.caption}>{channelName}</span>}
      </div>

      {/* Self voice controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
        <SectionLabel>Voice</SectionLabel>

        <Field label="Controls">
          <div style={{ display: 'flex', gap: 6 }}>
            <IconButton
              size={30}
              active={selfMuted}
              title={selfMuted ? 'Unmute mic' : 'Mute mic'}
              onClick={() => void post('/api/discord/selfmute', { muted: !selfMuted })}
            >
              {selfMuted ? <MicOffIcon size={14} /> : <MicIcon size={14} />}
            </IconButton>
            <IconButton
              size={30}
              active={selfDeafened}
              title={selfDeafened ? 'Undeafen' : 'Deafen'}
              onClick={() => void post('/api/discord/selfdeaf', { deafened: !selfDeafened })}
            >
              {selfDeafened ? <HeadsetOffIcon size={14} /> : <HeadsetIcon size={14} />}
            </IconButton>
          </div>
        </Field>

        <Field label="Mic">
          <Slider
            value={discordState?.inputVolume ?? 100}
            unit="%"
            muted={selfMuted}
            onChange={(v) => void post('/api/discord/inputvolume', { volume: v })}
          />
        </Field>

        <Field label="Output">
          <Slider
            value={discordState?.outputVolume ?? 100}
            unit="%"
            muted={selfDeafened}
            onChange={(v) => void post('/api/discord/outputvolume', { volume: v })}
          />
        </Field>
      </div>

      {/* Participants */}
      {participants.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
          <SectionLabel>Voice Channel</SectionLabel>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          ...text.body,
          fontSize: 12,
          color: participant.muted || participant.deafened
            ? 'var(--color-text-secondary)'
            : 'var(--color-text-primary)',
          width: 64,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        title={displayName}
      >
        {displayName}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Slider
          value={participant.localVolume}
          max={200}
          unit="%"
          muted={participant.localMuted}
          onChange={(v) => onVolumeChange(participant.userId, v)}
        />
      </div>
      <IconButton
        size={28}
        active={participant.localMuted}
        title={participant.localMuted ? 'Unmute' : 'Mute'}
        onClick={() => onMuteToggle(participant.userId, !participant.localMuted)}
      >
        <MuteIcon muted={participant.localMuted} size={13} />
      </IconButton>
    </div>
  )
}

// ── Arctis card internals ─────────────────────────────────────────────────────

const ANC_OPTIONS: { value: ArctisState['ancMode']; label: string }[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'TRANSPARENCY', label: 'Transp.' },
  { value: 'ANC', label: 'ANC' },
]

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.rowGap }}>
      {/* Status row: batteries + connectivity icons (wraps on narrow screens) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <BatteryIndicator level={Math.round(arctis.batteryHeadset)} title={`Headset: ${Math.round(arctis.batteryHeadset)}%`} />
        {arctis.batteryDock > 0 && (
          <BatteryIndicator level={Math.round(arctis.batteryDock)} charging hidePercent title={`Dock: ${Math.round(arctis.batteryDock)}%`} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <WifiIcon color={arctis.wirelessConnected ? 'var(--color-ok)' : 'var(--color-text-secondary)'} title="2.4 GHz" />
          <BluetoothIcon color={btColor} title={`BT: ${arctis.btStatus}`} />
          <PowerIcon
            color={arctis.headsetPowered === true ? 'var(--color-ok)' : 'var(--color-text-secondary)'}
            title="Power"
          />
          <MicIcon
            color={arctis.micMuted ? 'var(--color-warn)' : 'var(--color-ok)'}
            title={arctis.micMuted ? 'Mic muted' : 'Mic active'}
          />
        </div>
      </div>

      {/* Volume */}
      <Field label="Volume">
        <Slider
          value={Math.round(arctis.volume)}
          unit="%"
          onChange={(v) => {
            updateArctis({ volume: v })
            void sendCmd('setVolume', v)
          }}
        />
      </Field>

      {/* ANC mode */}
      <Field label="ANC">
        <OptionGroup
          value={arctis.ancMode}
          options={ANC_OPTIONS}
          onChange={(m) => { updateArctis({ ancMode: m }); void sendCmd('setAncMode', m) }}
        />
      </Field>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
      {classic && CHANNEL_ORDER.map((ch) => {
        const vol = ch === 'master'
          ? classic.masters.classic
          : classic.devices[ch as keyof typeof classic.devices]?.classic
        if (!vol) return null

        const device = CHANNEL_TO_DEVICE[ch]
        const favorites = getFavoritesForChannel(configs, device)
        const activeId = activePresetIds[device] ?? configs.find(c => c.virtualAudioDevice === device && c.isSelected)?.id

        return (
          <div key={ch} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Field label={CHANNEL_LABELS[ch]}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Slider
                    value={Math.round(vol.volume * 100)}
                    unit="%"
                    muted={vol.muted}
                    onChange={(v) => void sonarSetVolume(ch, v / 100)}
                    onDragStart={beginDrag}
                    onDragEnd={endDrag}
                  />
                </div>
                <IconButton
                  size={30}
                  active={vol.muted}
                  title={vol.muted ? 'Unmute' : 'Mute'}
                  onClick={() => void sonarSetMute(ch, !vol.muted)}
                >
                  <MuteIcon muted={vol.muted} size={14} />
                </IconButton>
              </div>
            </Field>
            {ch !== 'master' && favorites.length > 0 && (
              <div style={{ paddingLeft: size.rowLabelWidth + space.fieldGap }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
      {/* Monitor name + primary tag + input selector on same row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            ...text.subtitle,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {monitor.name}
        </span>
        {monitor.is_primary && <span style={{ ...text.sectionLabel, flexShrink: 0 }}>Primary</span>}
        {supportsInput && (
          <div style={{ width: 120, flexShrink: 0 }}>
            <Select
              compact
              ariaLabel={`${monitor.name} input`}
              value={monitor.input_source}
              onChange={(v) => void post('/api/ddc/input', { monitorId: monitor.monitor_id, input: v })}
              options={monitor.available_inputs.map((inp) => ({ value: inp, label: DDC_INPUT_NAMES[inp] ?? inp }))}
            />
          </div>
        )}
      </div>
      {supportsBrightness && (
        <Field label="Brightness">
          <Slider
            value={monitor.brightness}
            unit="%"
            onChange={(v) => {
              void post('/api/ddc/brightness', { monitorId: monitor.monitor_id, brightness: v })
            }}
          />
        </Field>
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
    const onMove = (e: PointerEvent): void => {
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
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
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
      <div style={{ position: 'fixed', left, top, width: PICKER_W, zIndex: 9999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: 'var(--shadow-panel)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, userSelect: 'none' }}>
        <div ref={svRef} onPointerDown={e => { dragging.current = 'sv'; e.preventDefault() }} style={{ position: 'relative', height: SV_H, borderRadius: 4, cursor: 'crosshair', touchAction: 'none', background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hueHex})`, border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'absolute', left: `${sat * 100}%`, top: `${(1 - bri) * 100}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.6)', background: currentHex, pointerEvents: 'none' }} />
        </div>
        <div ref={hueRef} onPointerDown={e => { dragging.current = 'hue'; e.preventDefault() }} style={{ position: 'relative', height: 14, borderRadius: 4, cursor: 'ew-resize', touchAction: 'none', background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)', border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'absolute', left: `${hue * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 8, height: 18, borderRadius: 3, border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)', background: hueHex, pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0, background: currentHex, border: '1px solid var(--color-border)' }} />
          <span className="mono" style={{ ...text.value, letterSpacing: '0.05em' }}>{currentHex.toUpperCase()}</span>
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

/** Shared row container for HA entity rows. */
const haRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 0',
  borderBottom: '1px solid var(--color-border)',
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
          <IconButton
            key={cfg.entityId}
            onClick={handleClick}
            title={cfg.displayName ?? cfg.entityId}
            size={36}
            style={{ borderRadius: '50%', color: iconColor, transition: 'color 150ms' }}
          >
            <HaEntityIcon type={cfg.icon ?? cfg.type} color={iconColor} isOn={isOn} />
          </IconButton>
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
  const minCt = typeof attrs.min_color_temp_kelvin === 'number' ? attrs.min_color_temp_kelvin as number : 2000
  const maxCt = typeof attrs.max_color_temp_kelvin === 'number' ? attrs.max_color_temp_kelvin as number : 6500
  const rawCtK = typeof attrs.color_temp_kelvin === 'number' ? attrs.color_temp_kelvin as number : minCt
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

  const handleBrightness = useCallback((bright: number): void => {
    patchEntity(cfg.entityId, { state: 'on', attributes: { brightness: bright } })
    void callService({ domain: 'light', service: 'turn_on', serviceData: { entity_id: cfg.entityId, brightness: bright } })
  }, [cfg.entityId, patchEntity, callService])

  const handleColorTemp = useCallback((kelvin: number): void => {
    patchEntity(cfg.entityId, { attributes: { color_temp_kelvin: kelvin } })
    void callService({ domain: 'light', service: 'turn_on', serviceData: { entity_id: cfg.entityId, color_temp_kelvin: kelvin } })
  }, [cfg.entityId, patchEntity, callService])

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
    <div style={{ ...haRowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...text.body, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        {showColor && (
          <>
            <div ref={swatchRef} onClick={() => setPickerOpen(o => !o)} title="Pick colour" style={{ width: 16, height: 16, borderRadius: '50%', background: colorHex, border: '1px solid var(--color-border)', cursor: 'pointer', flexShrink: 0 }} />
            {pickerOpen && swatchRef.current && (
              <HaColorPicker value={colorHex} onChange={handleColor} onClose={() => setPickerOpen(false)} anchorRect={swatchRef.current.getBoundingClientRect()} />
            )}
          </>
        )}
        {isOn && effectList.length > 0 && (
          <div style={{ width: 110, flexShrink: 0 }}>
            <Select
              compact
              ariaLabel={`${name} effect`}
              value={currentEffect ?? 'None'}
              onChange={handleEffect}
              options={[{ value: 'None', label: 'No effect' }, ...effectList.map(ef => ({ value: ef, label: ef }))]}
            />
          </div>
        )}
        <Toggle checked={isOn} onChange={handleToggle} />
      </div>
      {isOn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Field label="Brightness">
            <Slider
              value={Math.round((rawBrightness / 255) * 100)}
              unit="%"
              onChange={(v) => handleBrightness(Math.round((v / 100) * 255))}
            />
          </Field>
          {showColorTemp && maxCt > minCt && (
            <Field label="Temp">
              <Slider
                value={rawCtK}
                min={minCt}
                max={maxCt}
                format={(v) => `${v}K`}
                onChange={handleColorTemp}
              />
            </Field>
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

  const handleTemp = useCallback((temp: number): void => {
    patchEntity(cfg.entityId, { attributes: { temperature: temp } })
    void callService({ domain: 'climate', service: 'set_temperature', serviceData: { entity_id: cfg.entityId, temperature: temp } })
  }, [cfg.entityId, patchEntity, callService])

  const handleMode = useCallback((mode: string): void => {
    patchEntity(cfg.entityId, { state: mode })
    void callService({ domain: 'climate', service: 'set_hvac_mode', serviceData: { entity_id: cfg.entityId, hvac_mode: mode } })
  }, [cfg.entityId, patchEntity, callService])

  return (
    <div style={{ ...haRowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...text.body, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ ...text.caption, fontSize: 12, flexShrink: 0 }}>{currentTemp}°</span>
        {hvacModes.length > 0 && (
          <div style={{ width: 104, flexShrink: 0 }}>
            <Select
              compact
              ariaLabel={`${name} mode`}
              value={hvacMode}
              onChange={handleMode}
              options={hvacModes.map(m => ({ value: m, label: m }))}
            />
          </div>
        )}
      </div>
      <Field label="Setpoint">
        <Slider
          value={setpointRaw}
          min={minTemp}
          max={maxTemp}
          step={0.5}
          format={(v) => `${v.toFixed(1)}°`}
          onChange={handleTemp}
        />
      </Field>
    </div>
  )
}

function HaSensorRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const unit = typeof attrs.unit_of_measurement === 'string' ? attrs.unit_of_measurement as string : ''
  return (
    <div style={haRowStyle}>
      <span style={{ ...text.body, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ ...text.caption, fontSize: 12 }}>{entity.state}{unit ? ` ${unit}` : ''}</span>
    </div>
  )
}

function HaSceneRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const callService = useHaStore((s) => s.callService)
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  return (
    <div style={haRowStyle}>
      <span style={{ ...text.body, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <Button small onClick={() => void callService({ domain: 'scene', service: 'turn_on', serviceData: { entity_id: cfg.entityId } })}>
        Activate
      </Button>
    </div>
  )
}

function HaServiceCallRow({ cfg }: { cfg: HaHomeCardEntity }): JSX.Element {
  const callService = useHaStore((s) => s.callService)
  const name = cfg.displayName ?? `${cfg.serviceDomain}.${cfg.serviceName}`
  return (
    <div style={haRowStyle}>
      <span style={{ ...text.body, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <Button small onClick={() => { if (cfg.serviceDomain && cfg.serviceName) void callService({ domain: cfg.serviceDomain, service: cfg.serviceName }) }}>
        Call
      </Button>
    </div>
  )
}

function HaEntityRow({ cfg, entities }: { cfg: HaHomeCardEntity; entities: HaEntity[] }): JSX.Element | null {
  if (cfg.type === 'service_call') return <HaServiceCallRow cfg={cfg} />
  const entity = entities.find(e => e.entity_id === cfg.entityId)
  if (!entity) return (
    <div style={{ ...haRowStyle, opacity: 0.5 }}>
      <span style={{ ...text.bodyMuted, fontSize: 12, flex: 1 }}>{cfg.displayName ?? cfg.entityId}</span>
      <span style={{ ...text.caption, fontSize: 12 }}>unavailable</span>
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
    <Card
      title="Home Assistant"
      icon={<HomeIcon size={14} />}
      right={
        <LinkIcon
          color={isConnected ? 'var(--color-ok)' : 'var(--color-text-secondary)'}
          size={14}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      }
    >
      {favourites.length > 0 && <HaFavouritesRow cfgs={favourites} entities={liveEntities} />}
      <div>
        {normal.map((cfg, i) => (
          <HaEntityRow key={cfg.entityId + i} cfg={cfg} entities={liveEntities} />
        ))}
      </div>
    </Card>
  )
}

// ── PC Controls card ─────────────────────────────────────────────────────────

function PCControlsCard(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sectionGap }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
        <SectionLabel>System</SectionLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          <ControlButton label="Power Off" icon={<PowerIcon size={14} />} onClick={() => void post('/api/system/poweroff', {})} danger />
          <ControlButton label="Sleep" icon={<SleepIcon size={14} />} onClick={() => void post('/api/system/sleep', {})} />
          <ControlButton label="Lock" icon={<LockIcon size={14} />} onClick={() => void post('/api/system/lock', {})} />
          <ControlButton label="Monitors Off" icon={<MonitorOffIcon size={14} />} onClick={() => void post('/api/system/monitorsoff', {})} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
        <SectionLabel>Media</SectionLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          <ControlButton label="Previous" icon={<SkipBackIcon size={14} />} onClick={() => void post('/api/media/prev', {})} />
          <ControlButton label="Play / Pause" icon={<PlayPauseIcon size={14} />} onClick={() => void post('/api/media/playpause', {})} wide />
          <ControlButton label="Next" icon={<SkipForwardIcon size={14} />} onClick={() => void post('/api/media/next', {})} />
        </div>
      </div>
    </div>
  )
}

function ControlButton({
  label,
  icon,
  onClick,
  danger,
  wide,
}: {
  label: string
  icon: JSX.Element
  onClick: () => void
  danger?: boolean
  wide?: boolean
}): JSX.Element {
  return (
    <button
      onClick={() => { haptic(); onClick() }}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '10px 6px',
        flex: wide ? 2 : 1,
        borderRadius: size.radiusMd,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-raised)',
        color: danger ? 'var(--color-status-error)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 10,
        lineHeight: 1,
        transition: 'all 150ms ease',
        minWidth: 0,
      }}
    >
      {icon}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span>
    </button>
  )
}
