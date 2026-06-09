import { useRef, useState, memo } from 'react'
import { useServiceStore } from '../stores/serviceStore'
import { post } from '../api/http'
import { haptic } from '../utils/haptic'
import type { ArctisState, TimeoutStep } from '@shared/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMEOUT_OPTIONS: { value: TimeoutStep; label: string }[] = [
  { value: 'OFF',         label: 'Off' },
  { value: 'ONE_MIN',     label: '1m' },
  { value: 'FIVE_MIN',    label: '5m' },
  { value: 'TEN_MIN',     label: '10m' },
  { value: 'FIFTEEN_MIN', label: '15m' },
  { value: 'THIRTY_MIN',  label: '30m' },
  { value: 'SIXTY_MIN',   label: '60m' },
]

const EQ_CUSTOM_INDEX = 0x04
const EQ_NAMED_PRESETS: { index: number; label: string }[] = [
  { index: 0x00, label: 'Flat' },
  { index: 0x01, label: 'Bass Boost' },
  { index: 0x02, label: 'Focus' },
  { index: 0x03, label: 'Smiley' },
  { index: 0x05, label: 'Apex Legends' },
  { index: 0x06, label: "Baldur's Gate 3" },
  { index: 0x07, label: 'COD Modern Warfare II' },
  { index: 0x08, label: 'COD Warzone 2' },
  { index: 0x09, label: 'Destiny 2' },
  { index: 0x0A, label: 'Diablo IV' },
  { index: 0x0B, label: 'Fortnite' },
  { index: 0x0C, label: 'FPS Footsteps' },
  { index: 0x0D, label: 'GTA V' },
  { index: 0x0E, label: 'Minecraft' },
  { index: 0x0F, label: 'Overwatch 2' },
  { index: 0x10, label: 'Player Unknown Battleground' },
  { index: 0x11, label: 'Rainbow Six Siege' },
  { index: 0x12, label: 'Rocket League' },
]
const EQ_BAND_FREQS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K']

// ── SliderInput (pointer-events — works for mouse and touch) ───────────────────

function SliderInputComponent({
  value,
  onChange,
  orientation = 'horizontal',
}: {
  value: number
  onChange: (v: number) => void
  orientation?: 'horizontal' | 'vertical'
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const displayValue = dragValue !== null ? dragValue : value

  function valueFromPoint(clientX: number, clientY: number): number {
    const el = containerRef.current
    if (!el) return displayValue
    const rect = el.getBoundingClientRect()
    return orientation === 'vertical'
      ? Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height))
      : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function onPointerDown(e: React.PointerEvent): void {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    isDragging.current = true
    haptic()
    const v = valueFromPoint(e.clientX, e.clientY)
    setDragValue(v)
    onChange(v)
  }
  function onPointerMove(e: React.PointerEvent): void {
    if (!isDragging.current) return
    const v = valueFromPoint(e.clientX, e.clientY)
    setDragValue(v)
    onChange(v)
  }
  function onPointerUp(): void {
    isDragging.current = false
    setDragValue(null)
  }

  const thumbLeft = `calc(6px + ${displayValue} * (100% - 12px) - 5px)`

  if (orientation === 'vertical') {
    return (
      <div
        ref={containerRef}
        className="relative"
        style={{ height: '100%', width: '100%', cursor: 'ns-resize', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="absolute rounded-full" style={{ left: '50%', transform: 'translateX(-50%)', top: 6, bottom: 6, width: 6, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }} />
        <div className="absolute rounded-full pointer-events-none" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 6, width: 6, height: `calc(${displayValue} * (100% - 12px))`, background: 'var(--color-accent)' }} />
        <div className="absolute pointer-events-none rounded" style={{ left: '50%', transform: 'translateX(-50%)', bottom: `calc(6px + ${displayValue} * (100% - 12px) - 9px)`, width: 18, height: 10, background: 'var(--color-highlight)', boxShadow: 'var(--shadow-thumb)' }} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1"
      style={{ height: 24, cursor: 'ew-resize', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="absolute rounded-full" style={{ top: '50%', transform: 'translateY(-50%)', left: 6, right: 6, height: 6, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }} />
      <div className="absolute rounded-full pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)', left: 6, width: `calc(${displayValue} * (100% - 12px))`, height: 6, background: 'var(--color-accent)' }} />
      <div className="absolute pointer-events-none rounded" style={{ top: '50%', transform: 'translateY(-50%)', left: thumbLeft, width: 10, height: 20, background: 'var(--color-highlight)', boxShadow: 'var(--shadow-thumb)' }} />
    </div>
  )
}
const SliderInput = memo(SliderInputComponent)

// ── Primitives ─────────────────────────────────────────────────────────────────

interface Opt<T extends string> { value: T; label: string }

function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Opt<T>[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div className="segment-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => { haptic(); onChange(opt.value) }}
          className={`flex-1 segment-btn${value === opt.value ? ' active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function GridRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="card-field-label">{label}</span>
      {children}
    </div>
  )
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="card-row-label shrink-0 w-32">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Slider({
  value, min, max, unit = '', onChange,
}: {
  value: number; min: number; max: number; unit?: string; onChange: (v: number) => void
}): JSX.Element {
  const normalized = (value - min) / (max - min)
  return (
    <div className="flex items-center gap-2 py-1">
      <SliderInput
        value={normalized}
        onChange={(v) => onChange(Math.round(min + v * (max - min)))}
      />
      <span className="mono text-xs w-10 text-right shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
        {value}{unit}
      </span>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function HeadphonesIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}

function WirelessIcon({ size = 11 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  )
}

function BluetoothIcon({ size = 11 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  )
}

function SonarIcon(): JSX.Element {
  return <span className="mono" style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.5px' }}>GG</span>
}

function VolumeLimiterIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="1"  y="14" width="4" height="9"  rx="1" />
      <rect x="7"  y="10" width="4" height="13" rx="1" />
      <rect x="13" y="6"  width="4" height="17" rx="1" />
      <rect x="19" y="2"  width="4" height="21" rx="1" />
      <rect x="1"  y="1"  width="22" height="2" rx="1" />
    </svg>
  )
}

function MicIcon({ size = 10 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function BaseStationIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="12" rx="2" />
      <path d="M6 12h12M6 16h12" />
    </svg>
  )
}

function EqIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="3" height="16" rx="1" />
      <rect x="10" y="8" width="3" height="12" rx="1" />
      <rect x="18" y="6" width="3" height="14" rx="1" />
    </svg>
  )
}

function BoltIcon(): JSX.Element {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function AudioOptionsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

// ── Connectivity status indicators ─────────────────────────────────────────────

function ConnectivityIcon({
  icon, active, title,
}: {
  icon: React.ReactNode; active: boolean; title: string
}): JSX.Element {
  return (
    <span
      title={title}
      style={{
        color: active ? 'var(--color-status-ok)' : 'var(--color-text-secondary)',
        opacity: active ? 1 : 0.45,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {icon}
    </span>
  )
}

function SonarIndicator({ connected }: { connected: boolean }): JSX.Element {
  return (
    <div
      title={connected ? 'GG Sonar connected' : 'GG Sonar not detected'}
      className="w-5 h-5 rounded flex items-center justify-center"
      style={{
        background: connected ? 'var(--color-status-ok-bg)' : 'var(--color-status-inactive-bg)',
        border: `1px solid ${connected ? 'var(--color-status-ok)' : 'var(--color-border)'}`,
        color: connected ? 'var(--color-status-ok)' : 'var(--color-text-secondary)',
      }}
    >
      <SonarIcon />
    </div>
  )
}

function VolumeLimiterIndicator({ on }: { on: boolean }): JSX.Element {
  return (
    <div
      title={on ? 'Volume limiter on' : 'Volume limiter off'}
      className="w-5 h-5 rounded flex items-center justify-center"
      style={{
        background: on ? 'var(--color-status-ok-bg)' : 'var(--color-status-inactive-bg)',
        border: `1px solid ${on ? 'var(--color-status-ok)' : 'var(--color-border)'}`,
        color: on ? 'var(--color-status-ok)' : 'var(--color-text-secondary)',
      }}
    >
      <VolumeLimiterIcon />
    </div>
  )
}

function MicMuteIndicator({ muted }: { muted: boolean }): JSX.Element {
  return (
    <div
      title={muted ? 'Microphone muted' : 'Microphone active'}
      className="w-5 h-5 rounded flex items-center justify-center"
      style={{
        background: muted ? 'var(--color-status-error-bg)' : 'var(--color-status-ok-bg)',
        border: `1px solid ${muted ? 'var(--color-status-error)' : 'var(--color-status-ok)'}`,
        color: muted ? 'var(--color-status-error)' : 'var(--color-status-ok)',
      }}
    >
      <MicIcon size={10} />
    </div>
  )
}

function BatteryIndicator({
  level, charging, title, hidePercent,
}: {
  level: number; charging: boolean; title: string; hidePercent?: boolean
}): JSX.Element {
  const SEGMENTS = 4
  const filled = Math.round((level / 100) * SEGMENTS)
  const color = level <= 20 ? 'var(--color-status-error)' : level <= 50 ? 'var(--color-status-warn-fg)' : 'var(--color-status-ok)'
  return (
    <div title={title} className="flex items-center gap-1" style={{ height: 24 }}>
      {charging && (
        <span style={{ color: 'var(--color-status-warn-fg)' }}>
          <BoltIcon />
        </span>
      )}
      <div className="flex items-center gap-px">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 14,
              borderRadius: 2,
              background: i < filled ? color : 'transparent',
              border: `1px solid ${i < filled ? color : 'var(--color-text-primary)'}`,
              opacity: i < filled ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      {!hidePercent && (
        <span className="mono" style={{ color: 'var(--color-text-primary)', fontSize: 11, lineHeight: 1 }}>
          {level}%
        </span>
      )}
    </div>
  )
}

// ── HeadsetCard ────────────────────────────────────────────────────────────────

function HeadsetCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  const batteryHeadset = Math.round(s.batteryHeadset)
  const batteryDock = Math.round(s.batteryDock)
  const volume = Math.round(s.volume)

  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: s.baseStationConnected && s.headsetPowered !== false ? 'var(--color-status-ok)' : 'var(--color-accent)' }}>
            <HeadphonesIcon />
          </span>
          <span className="card-title">Arctis Nova Pro Wireless</span>
          {s.baseStationConnected && (
            <>
              <div className="flex flex-col gap-0.5">
                <ConnectivityIcon
                  icon={<WirelessIcon />}
                  active={s.wirelessConnected}
                  title={`2.4 GHz — ${s.wirelessConnected ? 'Active' : 'Absent'}`}
                />
                <ConnectivityIcon
                  icon={<BluetoothIcon />}
                  active={s.btStatus === 'CONNECTED'}
                  title={`Bluetooth — ${s.btStatus === 'CONNECTED' ? 'Connected' : s.btStatus === 'PAIRING' ? 'Pairing' : s.btStatus === 'ON' ? 'On' : 'Off'}`}
                />
              </div>
              <SonarIndicator connected={s.sonarConnected} />
              <VolumeLimiterIndicator on={s.volumeLimiterOn} />
              <MicMuteIndicator muted={s.micMuted} />
            </>
          )}
        </div>
        {s.baseStationConnected && (
          <div className="flex items-center gap-2">
            {s.headsetPowered !== false && (
              <BatteryIndicator level={batteryHeadset} charging={false} title={`Headset: ${batteryHeadset}%`} />
            )}
            <BatteryIndicator level={batteryDock} charging={true} title={`Dock: ${batteryDock}%`} hidePercent />
          </div>
        )}
      </div>

      {/* Volume */}
      <div
        className="mb-3"
        style={{ opacity: s.baseStationConnected ? 1 : 0.4, pointerEvents: s.baseStationConnected ? 'auto' : 'none' }}
      >
        <ControlRow label="Volume">
          <Slider
            value={volume}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => { update({ volume: v }); cmd('setVolume', v) }}
          />
        </ControlRow>
      </div>

      {/* ChatMix */}
      <div
        className="flex items-center gap-3"
        style={{ opacity: s.baseStationConnected ? 1 : 0.4, pointerEvents: s.baseStationConnected ? 'auto' : 'none' }}
      >
        <button
          onClick={() => { haptic(); update({ chatmixEnabled: !s.chatmixEnabled }); cmd('setChatmixEnabled', !s.chatmixEnabled) }}
          className="card-row-label shrink-0 w-32 text-left"
          style={{
            textDecoration: s.chatmixEnabled ? 'none' : 'line-through',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          ChatMix
        </button>
        <div
          className="flex-1 flex items-center gap-1.5"
          style={{ opacity: s.chatmixEnabled ? 1 : 0.3, transition: 'opacity 150ms ease', pointerEvents: 'none' }}
        >
          <span className="text-xs mono shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
            Game {s.chatmixGame}
          </span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(s.chatmixChat - s.chatmixGame + 100) / 2}%`,
                background: 'var(--color-accent)',
                transition: 'width 150ms ease',
              }}
            />
          </div>
          <span className="text-xs mono shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
            {s.chatmixChat} Chat
          </span>
        </div>
      </div>
    </div>
  )
}

// ── AudioOptionsCard ───────────────────────────────────────────────────────────

const ANC_OPTIONS: Opt<ArctisState['ancMode']>[] = [
  { value: 'OFF',          label: 'Off' },
  { value: 'TRANSPARENCY', label: 'Transparency' },
  { value: 'ANC',          label: 'ANC' },
]
const GAIN_OPTIONS: Opt<ArctisState['micGain']>[] = [
  { value: 'LOW',  label: 'Low' },
  { value: 'HIGH', label: 'High' },
]
const SIDETONE_OPTIONS: Opt<ArctisState['sidetone']>[] = [
  { value: 'OFF',    label: 'Off' },
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Med' },
  { value: 'HIGH',   label: 'High' },
]

function AudioOptionsCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}><AudioOptionsIcon /></span>
        <span className="card-title">Audio Options</span>
      </div>
      <div className="flex flex-col gap-3">
        <GridRow label="ANC">
          <OptionGroup
            value={s.ancMode}
            options={ANC_OPTIONS}
            onChange={(v) => { update({ ancMode: v }); cmd('setAncMode', v) }}
          />
          {s.ancMode === 'TRANSPARENCY' && (
            <div style={{ marginTop: 8 }}>
              <Slider
                value={s.transparencyLevel}
                min={1}
                max={10}
                onChange={(v) => { update({ transparencyLevel: v }); cmd('setTransparencyLevel', v) }}
              />
            </div>
          )}
        </GridRow>
        <GridRow label="Gain">
          <OptionGroup
            value={s.micGain}
            options={GAIN_OPTIONS}
            onChange={(v) => { update({ micGain: v }); cmd('setMicGain', v) }}
          />
        </GridRow>
        <GridRow label="Sidetone">
          <OptionGroup
            value={s.sidetone}
            options={SIDETONE_OPTIONS}
            onChange={(v) => { update({ sidetone: v }); cmd('setSidetone', v) }}
          />
        </GridRow>
        <GridRow label="Mic Volume">
          <Slider
            value={s.micVolume}
            min={1}
            max={10}
            onChange={(v) => { update({ micVolume: v }); cmd('setMicVolume', v) }}
          />
        </GridRow>
      </div>
    </div>
  )
}

// ── WirelessCard ───────────────────────────────────────────────────────────────

const WIRELESS_MODE_OPTIONS: Opt<ArctisState['wirelessMode']>[] = [
  { value: 'PERFORMANCE',    label: 'Performance' },
  { value: 'EXTENDED_RANGE', label: 'Range' },
]
const BT_AUTO_MUTE_OPTIONS: Opt<ArctisState['btAutoMute']>[] = [
  { value: 'OFF',         label: 'Off' },
  { value: 'DB_MINUS_12', label: '-12 dB' },
  { value: 'FULL',        label: 'Full' },
]
const BOOL_OPTIONS: Opt<'OFF' | 'ON'>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'ON',  label: 'On' },
]
const AUDIO_OUTPUT_OPTIONS: Opt<ArctisState['audioOutput']>[] = [
  { value: 'SPEAKERS', label: 'Speakers' },
  { value: 'STREAM',   label: 'Stream' },
]

function WirelessCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}><WirelessIcon size={14} /></span>
        <span className="card-title">Wireless &amp; Audio Output</span>
      </div>
      <div className="flex flex-col gap-3">
        <GridRow label="2.4 GHz Mode">
          <OptionGroup
            value={s.wirelessMode}
            options={WIRELESS_MODE_OPTIONS}
            onChange={(v) => { update({ wirelessMode: v }); cmd('setWirelessMode', v) }}
          />
        </GridRow>
        <GridRow label="BT Default">
          <OptionGroup
            value={s.btDefault ? 'ON' : 'OFF'}
            options={BOOL_OPTIONS}
            onChange={(v) => {
              const val = v === 'ON'
              update({ btDefault: val }); cmd('setBtDefault', val)
            }}
          />
        </GridRow>
        <GridRow label="BT Auto Mute">
          <OptionGroup
            value={s.btAutoMute}
            options={BT_AUTO_MUTE_OPTIONS}
            onChange={(v) => { update({ btAutoMute: v }); cmd('setBtAutoMute', v) }}
          />
        </GridRow>
        <GridRow label="Output">
          <OptionGroup
            value={s.audioOutput}
            options={AUDIO_OUTPUT_OPTIONS}
            onChange={(v) => { update({ audioOutput: v }); cmd('setAudioOutput', v) }}
          />
        </GridRow>
        {s.audioOutput === 'STREAM' && (
          <>
            {(
              [
                { label: 'Main', key: 'streamMain' as const, value: s.streamMain },
                { label: 'Aux',  key: 'streamAux'  as const, value: s.streamAux  },
                { label: 'Mic',  key: 'streamMic'  as const, value: s.streamMic  },
              ]
            ).map(({ label, key, value }) => (
              <div key={key} className="flex items-center gap-2 py-1">
                <span className="text-xs w-6 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <SliderInput
                  value={value / 100}
                  onChange={(v) => {
                    const rounded = Math.round(v * 100)
                    const patch = { [key]: rounded } as Partial<ArctisState>
                    update(patch)
                    void post('/api/arctis/cmd', {
                      cmd: 'setStreamVolumes',
                      value: {
                        main: key === 'streamMain' ? rounded : s.streamMain,
                        aux:  key === 'streamAux'  ? rounded : s.streamAux,
                        mic:  key === 'streamMic'  ? rounded : s.streamMic,
                      },
                    })
                  }}
                />
                <span className="text-xs mono w-10 text-right shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                  {value}%
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── BaseStationCard ────────────────────────────────────────────────────────────

function BaseStationCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}><BaseStationIcon /></span>
        <span className="card-title">Base Station</span>
      </div>
      <div className="flex flex-col gap-2.5">
        <ControlRow label="OLED Brightness">
          <Slider
            value={s.oledBrightness}
            min={1}
            max={10}
            onChange={(v) => { update({ oledBrightness: v }); cmd('setOledBrightness', v) }}
          />
        </ControlRow>
        <ControlRow label="Dim Screen">
          <OptionGroup
            value={s.dimTimeout}
            options={TIMEOUT_OPTIONS}
            onChange={(v) => { update({ dimTimeout: v }); cmd('setDimTimeout', v) }}
          />
        </ControlRow>
        <ControlRow label="Homescreen">
          <OptionGroup
            value={s.homescreenMode}
            options={[
              { value: 'DETAILED' as const, label: 'Detailed' },
              { value: 'SIMPLE'   as const, label: 'Simple' },
            ]}
            onChange={(v) => { update({ homescreenMode: v }); cmd('setHomeScreenMode', v) }}
          />
        </ControlRow>
        <ControlRow label="Mic LED">
          <Slider
            value={s.micLedBrightness}
            min={1}
            max={10}
            onChange={(v) => { update({ micLedBrightness: v }); cmd('setMicLedBrightness', v) }}
          />
        </ControlRow>
        <ControlRow label="Auto Off">
          <OptionGroup
            value={s.autoOffTimeout}
            options={TIMEOUT_OPTIONS}
            onChange={(v) => { update({ autoOffTimeout: v }); cmd('setAutoOffTimeout', v) }}
          />
        </ControlRow>
      </div>
    </div>
  )
}

// ── EqCard ─────────────────────────────────────────────────────────────────────

function EqCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  const isCustom = s.eqPresetIndex === EQ_CUSTOM_INDEX
  const bands = s.eqBands?.length === 10 ? s.eqBands : Array(10).fill(20)

  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}><EqIcon /></span>
        <span className="card-title">EQ</span>
      </div>
      <div className="flex flex-col gap-3">
        <ControlRow label="Mode">
          <OptionGroup
            value={isCustom ? 'CUSTOM' : 'PRESET'}
            options={[
              { value: 'CUSTOM' as const, label: 'Custom' },
              { value: 'PRESET' as const, label: 'Preset' },
            ]}
            onChange={(v) => {
              if (v === 'CUSTOM') {
                update({ eqPresetIndex: EQ_CUSTOM_INDEX }); cmd('setEqBands', bands)
              } else {
                const idx = EQ_NAMED_PRESETS[0].index
                update({ eqPresetIndex: idx }); cmd('setEqPreset', idx)
              }
            }}
          />
        </ControlRow>

        {!isCustom && (
          <ControlRow label="Preset">
            <select
              value={s.eqPresetIndex}
              onChange={(e) => {
                const idx = Number(e.target.value)
                if (idx === EQ_CUSTOM_INDEX) {
                  update({ eqPresetIndex: EQ_CUSTOM_INDEX }); cmd('setEqBands', bands)
                } else {
                  update({ eqPresetIndex: idx }); cmd('setEqPreset', idx)
                }
              }}
              className="flex-1 text-xs rounded px-2 py-1 w-full"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {EQ_NAMED_PRESETS.map((p) => (
                <option key={p.index} value={p.index}>{p.label}</option>
              ))}
              {!EQ_NAMED_PRESETS.some((p) => p.index === s.eqPresetIndex) && (
                <option value={s.eqPresetIndex}>Preset {s.eqPresetIndex}</option>
              )}
            </select>
          </ControlRow>
        )}

        {isCustom && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: '0 4px',
              marginTop: 10,
            }}
          >
            {EQ_BAND_FREQS.map((freq, i) => {
              const raw = bands[i] ?? 20
              const db = raw - 20
              const normalized = raw / 40
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 9, lineHeight: 1 }}>
                    {freq}
                  </span>
                  <div style={{ height: 144, width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SliderInput
                      value={normalized}
                      onChange={(v) => {
                        const newBands = [...bands]
                        newBands[i] = Math.round(v * 40)
                        update({ eqBands: newBands })
                        cmd('setEqBands', newBands)
                      }}
                      orientation="vertical"
                    />
                  </div>
                  <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 9, lineHeight: 1 }}>
                    {db > 0 ? `+${db}` : db}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function Arctis(): JSX.Element {
  const arctis = useServiceStore((s) => s.arctisState)
  const updateArctis = useServiceStore((s) => s.updateArctisState)

  if (!arctis) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', padding: 24 }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Arctis Nova Pro not connected</span>
      </div>
    )
  }

  const panelStyle: React.CSSProperties = !arctis.baseStationConnected
    ? { opacity: 0.4, pointerEvents: 'none' }
    : {}

  return (
    <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeadsetCard s={arctis} update={updateArctis} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, ...panelStyle }}>
        <AudioOptionsCard s={arctis} update={updateArctis} />
        <WirelessCard s={arctis} update={updateArctis} />
      </div>

      <div style={panelStyle}>
        <BaseStationCard s={arctis} update={updateArctis} />
      </div>

      <div style={panelStyle}>
        <EqCard s={arctis} update={updateArctis} />
      </div>
    </div>
  )
}
