import { useState, useEffect, memo } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { useAppStore } from '../../stores/appStore'
import { SliderInput } from '../SliderInput'
import type { ArctisState } from '@shared/types'

// ─── Slider Wrapper ───────────────────────────────────────────────────────────

function Slider({
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}): JSX.Element {
  const normalized = (value - min) / (max - min)
  const handleChange = (v: number) => onChange(Math.round(min + v * (max - min)))

  return (
    <div className="flex items-center gap-2 py-1">
      <SliderInput value={normalized} onChange={handleChange} />
      <span
        className="text-xs shrink-0"
        style={{ color: 'var(--color-text-secondary)', width: 28 }}
      >
        {value}{unit}
      </span>
    </div>
  )
}

// ─── Control Row ──────────────────────────────────────────────────────────────

function ControlRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="card-row-label shrink-0" style={{ minWidth: '50px' }}>
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ─── Option Group ─────────────────────────────────────────────────────────────

interface Option<T extends string> {
  value: T
  label: string
}

function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div className="segment-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 segment-btn${value === opt.value ? ' active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Connectivity icons ───────────────────────────────────────────────────────

function WirelessIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  )
}

function BluetoothIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  )
}

function MicIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function ConnectivityIcon({
  icon,
  active,
  pairing,
  on,
  activeColor = 'var(--color-status-ok)',
  title,
}: {
  icon: React.ReactNode
  active: boolean
  pairing?: boolean
  /** Icon is powered on but not connected (always green) */
  on?: boolean
  /** Color when active/connected — defaults to green, pass blue for BT */
  activeColor?: string
  title: string
}): JSX.Element {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!pairing) { setVisible(true); return }
    const id = setInterval(() => setVisible((v) => !v), 600)
    return () => clearInterval(id)
  }, [pairing])

  const color = pairing
    ? 'var(--color-status-info)'
    : active
      ? activeColor
      : on
        ? 'var(--color-status-ok)'
        : 'var(--color-text-secondary)'

  const lit = active || on || pairing

  return (
    <span
      title={title}
      style={{
        color,
        opacity: pairing && !visible ? 0.15 : lit ? 1 : 0.45,
        transition: 'opacity 200ms ease',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {icon}
    </span>
  )
}

// ─── Battery indicator ────────────────────────────────────────────────────────

function BoltIcon(): JSX.Element {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function BatteryIndicator({ level, charging, title, hidePercent }: { level: number; charging: boolean; title: string; hidePercent?: boolean }): JSX.Element {
  const SEGMENTS = 4
  const filled   = Math.round((level / 100) * SEGMENTS)
  const color    = level <= 20 ? 'var(--color-status-error)' : level <= 50 ? 'var(--color-status-warn-fg)' : 'var(--color-status-ok)'
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

// ─── Headset icon ─────────────────────────────────────────────────────────────

function HeadphonesIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}

function ControllerIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 12c0-1.104.895-2 2-2s2 .896 2 2-.895 2-2 2-2-.896-2-2z" />
      <path d="M16 12c0-1.104.895-2 2-2s2 .896 2 2-.895 2-2 2-2-.896-2-2z" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
      <path d="M2 10c0-1.657 1.79-3 4-3h12c2.21 0 4 1.343 4 3v4c0 1.657-1.79 3-4 3H6c-2.21 0-4-1.343-4-3v-4z" />
    </svg>
  )
}

function ChatIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// ─── ANC mode control ─────────────────────────────────────────────────────────

function AncModeControl({
  value,
  transparencyLevel,
  onModeChange,
  onLevelChange,
}: {
  value: ArctisState['ancMode']
  transparencyLevel: number
  onModeChange: (v: ArctisState['ancMode']) => void
  onLevelChange: (v: number) => void
}): JSX.Element {
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 1 : -1
    const next = Math.max(1, Math.min(10, transparencyLevel + delta))
    if (next !== transparencyLevel) onLevelChange(next)
  }

  return (
    <div className="segment-group">
      {ANC_OPTIONS.map((opt) => {
        const isActive = value === opt.value
        const isTransparency = opt.value === 'TRANSPARENCY'
        return (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            onWheel={isTransparency ? handleWheel : undefined}
            className={`flex-1 segment-btn flex items-center justify-center gap-1${isActive ? ' active' : ''}`}
            style={isTransparency ? { cursor: 'ns-resize' } : undefined}
          >
            <span>{opt.label}</span>
            {isTransparency && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  opacity: 0.75,
                  background: 'var(--color-overlay-dim)',
                  borderRadius: 3,
                  padding: '0 3px',
                  lineHeight: '14px',
                }}
              >
                {transparencyLevel}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Options ──────────────────────────────────────────────────────────────────

const ANC_OPTIONS: Option<ArctisState['ancMode']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'TRANSPARENCY', label: 'Transparency' },
  { value: 'ANC', label: 'ANC' },
]

const SIDETONE_OPTIONS: Option<ArctisState['sidetone']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Med' },
  { value: 'HIGH', label: 'High' },
]

// ─── Compact Headset Card ─────────────────────────────────────────────────────

function CompactHeadsetCardComponent({ state }: { state: ArctisState }): JSX.Element {
  const { updateArctisState } = useServiceStore()
  const { setView } = useAppStore()

  function cmd<K extends keyof ArctisState>(
    cmdName: string,
    value: unknown,
    patch: Pick<ArctisState, K>,
  ): void {
    updateArctisState(patch)
    window.api.arctisCmd(cmdName, value).catch(console.error)
  }

  const batteryHeadset = Math.round(state.batteryHeadset)
  const batteryDock    = Math.round(state.batteryDock)
  const volume         = Math.round(state.volume)

  if (!state.baseStationConnected) {
    return (
      <div
        className="rounded-lg px-4 py-3 flex flex-col"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}><HeadphonesIcon /></span>
          <button
            onClick={() => setView('arctis')}
            className="card-title"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Arctis NPW
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="card card-surface"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ color: state.headsetPowered === true ? 'var(--color-status-ok)' : 'var(--color-accent)' }}>
            <HeadphonesIcon />
          </span>
          <button
            onClick={() => setView('arctis')}
            className="card-title"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Arctis NPW
          </button>
          <div className="flex flex-col gap-0.5">
            <ConnectivityIcon
              icon={<WirelessIcon />}
              active={state.wirelessConnected}
              title={`2.4 GHz Wireless — ${state.wirelessConnected ? 'Active' : 'Absent'}`}
            />
            <ConnectivityIcon
              icon={<BluetoothIcon />}
              active={state.btStatus === 'CONNECTED'}
              activeColor="var(--color-status-info)"
              pairing={state.btStatus === 'PAIRING'}
              on={state.btStatus === 'ON'}
              title={`Bluetooth — ${state.btStatus === 'CONNECTED' ? 'Connected' : state.btStatus === 'PAIRING' ? 'Pairing…' : state.btStatus === 'ON' ? 'On' : 'Off'}`}
            />
          </div>
          {state.micMuted && (
            <span
              title="Microphone muted"
              style={{ color: 'var(--color-status-error)', display: 'flex', alignItems: 'center' }}
            >
              <MicIcon />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state.headsetPowered !== false && (
            <BatteryIndicator level={batteryHeadset} charging={false} title={`Headset battery: ${batteryHeadset}%`} />
          )}
          <BatteryIndicator level={batteryDock} charging={true} title={`Dock battery: ${batteryDock}%`} hidePercent />
        </div>
      </div>

      {/* ── Main Controls ── */}
      <div className="flex flex-col gap-3">
        {/* Volume */}
        <ControlRow label="Volume">
          <Slider
            value={volume}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => cmd('setVolume', v, { volume: v })}
          />
        </ControlRow>

        {/* ChatMix */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => cmd('setChatmixEnabled', !state.chatmixEnabled, { chatmixEnabled: !state.chatmixEnabled })}
            className="card-row-label shrink-0 text-left"
            style={{
              textDecoration: state.chatmixEnabled ? 'none' : 'line-through',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              minWidth: '50px',
            }}
          >
            ChatMix
          </button>
          <div
            className="flex-1 flex items-center gap-2"
            style={{ opacity: state.chatmixEnabled ? 1 : 0.3, transition: 'opacity 150ms ease', pointerEvents: 'none' }}
          >
            <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              <ControllerIcon />
            </span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--color-border)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(state.chatmixChat - state.chatmixGame + 100) / 2}%`,
                  background: 'var(--color-accent)',
                  transition: 'width 150ms ease',
                }}
              />
            </div>
            <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              <ChatIcon />
            </span>
          </div>
        </div>

        {/* ANC */}
        <ControlRow label="ANC">
          <AncModeControl
            value={state.ancMode}
            transparencyLevel={state.transparencyLevel}
            onModeChange={(v) => cmd('setAncMode', v, { ancMode: v })}
            onLevelChange={(v) => cmd('setTransparencyLevel', v, { transparencyLevel: v })}
          />
        </ControlRow>

        {/* Sidetone */}
        <ControlRow label="Sidetone">
          <OptionGroup
            value={state.sidetone}
            options={SIDETONE_OPTIONS}
            onChange={(v) => cmd('setSidetone', v, { sidetone: v })}
          />
        </ControlRow>
      </div>
    </div>
  )
}

export const CompactHeadsetCard = memo(CompactHeadsetCardComponent)
