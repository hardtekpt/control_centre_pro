import { useState, useEffect } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import type { ArctisState } from '@shared/types'

// ─── Slider ───────────────────────────────────────────────────────────────────

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
  return (
    <div className="flex items-center gap-2 py-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
      />
      <span
        className="text-xs mono w-10 text-right shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
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
      <span className="text-xs shrink-0 w-24" style={{ color: 'var(--color-text-secondary)' }}>
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
    <div
      className="flex overflow-hidden rounded"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 text-xs py-1 px-2 transition-colors"
          style={{
            background: value === opt.value ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: value === opt.value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            borderRight: i < options.length - 1 ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
          }}
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

function UsbIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v12" />
      <path d="M9 8l3-6 3 6" />
      <path d="M9 14v3a3 3 0 0 0 6 0v-3" />
      <circle cx="7.5" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="14" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

const GREEN = '#22c55e'
const RED   = '#ef4444'
const BLUE  = '#3b82f6'

type DotState = 'off' | 'on' | 'connected' | 'pairing'

const DOT_COLOR: Record<DotState, string> = {
  off:     RED,
  on:      GREEN,
  connected: BLUE,
  pairing: BLUE,
}
const DOT_BG: Record<DotState, string> = {
  off:     'rgba(239,68,68,0.12)',
  on:      'rgba(34,197,94,0.14)',
  connected: 'rgba(59,130,246,0.14)',
  pairing: 'rgba(59,130,246,0.14)',
}

function ConnectivityDot({ icon, dotState, title }: { icon: React.ReactNode; dotState: DotState; title: string }): JSX.Element {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (dotState !== 'pairing') { setVisible(true); return }
    const id = setInterval(() => setVisible((v) => !v), 600)
    return () => clearInterval(id)
  }, [dotState])

  const color = DOT_COLOR[dotState]
  return (
    <div
      title={title}
      className="w-6 h-6 rounded-full flex items-center justify-center"
      style={{
        background: DOT_BG[dotState],
        border: `1px solid ${color}`,
        color,
        opacity: visible ? 1 : 0.15,
        transition: 'opacity 200ms ease',
      }}
    >
      {icon}
    </div>
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

function BatteryIndicator({ level, charging, title }: { level: number; charging: boolean; title: string }): JSX.Element {
  const SEGMENTS = 4
  const filled   = Math.round((level / 100) * SEGMENTS)
  const color    = level <= 20 ? RED : level <= 50 ? '#f59e0b' : GREEN
  return (
    <div title={title} className="flex items-center gap-1" style={{ height: 24 }}>
      {charging && (
        <span style={{ color: '#f59e0b' }}>
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
      <span
        className="mono"
        style={{ color: 'var(--color-text-primary)', fontSize: 11, lineHeight: 1 }}
      >
        {level}%
      </span>
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
    <div
      className="flex overflow-hidden rounded"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {ANC_OPTIONS.map((opt, i) => {
        const isActive = value === opt.value
        const isTransparency = opt.value === 'TRANSPARENCY'
        return (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            onWheel={isTransparency ? handleWheel : undefined}
            className="flex-1 text-xs py-1 px-2 transition-colors flex items-center justify-center gap-1"
            style={{
              background: isActive ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: isActive ? 'var(--color-bg)' : 'var(--color-text-secondary)',
              borderRight: i < ANC_OPTIONS.length - 1 ? '1px solid var(--color-border)' : 'none',
              cursor: isTransparency ? 'ns-resize' : 'pointer',
            }}
          >
            <span>{opt.label}</span>
            {isTransparency && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  opacity: 0.75,
                  background: 'rgba(0,0,0,0.18)',
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

export function CompactHeadsetCard({ state }: { state: ArctisState }): JSX.Element {
  const { updateArctisState } = useServiceStore()

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

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}><HeadphonesIcon /></span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Arctis Nova Pro Wireless
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BatteryIndicator level={batteryHeadset} charging={false} title={`Headset battery: ${batteryHeadset}%`} />
          <BatteryIndicator level={batteryDock}    charging={true}  title={`Dock battery: ${batteryDock}%`} />
          <div style={{ width: 1, height: 14, background: 'var(--color-border)' }} />
          <div className="flex items-center gap-1.5">
            <ConnectivityDot
              icon={<UsbIcon />}
              dotState={state.baseStationConnected ? 'on' : 'off'}
              title={`Base station USB — ${state.baseStationConnected ? 'Connected' : 'Disconnected'}`}
            />
            <ConnectivityDot
              icon={<WirelessIcon />}
              dotState={state.wirelessLinkState === 'ACTIVE' ? 'on' : state.wirelessLinkState === 'SEARCHING' ? 'pairing' : 'off'}
              title={`2.4 GHz Wireless — ${state.wirelessLinkState === 'ACTIVE' ? 'Connected' : state.wirelessLinkState === 'SEARCHING' ? 'Searching…' : 'Absent'}`}
            />
            <ConnectivityDot icon={<BluetoothIcon />} dotState={!state.btActive ? 'off' : state.btPairing ? 'pairing' : state.btConnected ? 'connected' : 'on'} title="Bluetooth" />
          </div>
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
            className="text-xs shrink-0 w-24 text-left"
            style={{
              textDecoration: state.chatmixEnabled ? 'none' : 'line-through',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            ChatMix
          </button>
          <div
            className="flex-1 flex items-center gap-1.5"
            style={{ opacity: state.chatmixEnabled ? 1 : 0.3, transition: 'opacity 150ms ease', pointerEvents: 'none' }}
          >
            <span className="text-xs mono shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              Game {state.chatmixGame}
            </span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 4, background: 'var(--color-border)' }}
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
            <span className="text-xs mono shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {state.chatmixChat} Chat
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

        {/* Mic Volume */}
        <ControlRow label="Mic Volume">
          <Slider
            value={state.micVolume}
            min={1}
            max={10}
            onChange={(v) => cmd('setMicVolume', v, { micVolume: v })}
          />
        </ControlRow>
      </div>
    </div>
  )
}
