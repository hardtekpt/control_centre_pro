import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import type { ArctisState, TimeoutStep } from '@shared/types'

// ─── Primitive controls ───────────────────────────────────────────────────────

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

function SelectControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="flex-1 text-xs rounded px-2 py-1 w-full"
      style={{
        background: 'var(--color-surface-raised)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function Slider({
  value,
  min,
  max,
  unit = '',
  onChange,
}: {
  value: number
  min: number
  max: number
  unit?: string
  onChange: (v: number) => void
}): JSX.Element {
  const normalized = (value - min) / (max - min)
  return (
    <div className="flex items-center gap-2 py-1">
      <SliderInput
        value={normalized}
        onChange={(v) => onChange(Math.round(min + v * (max - min)))}
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

function ControlRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="card-row-label shrink-0 w-32">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 80ms ease',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function Section({
  title,
  summary,
  children,
  expandByDefault = false,
}: {
  title: string
  summary?: string
  children: React.ReactNode
  expandByDefault?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(expandByDefault)
  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: '10px 0' }}
      >
        <span className="card-title">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {summary && !open && (
            <span className="text-xs mono" style={{ color: 'var(--color-text-secondary)' }}>
              {summary}
            </span>
          )}
          <span style={{ color: 'var(--color-text-secondary)' }}>
            <ChevronIcon open={open} />
          </span>
        </div>
      </button>
      {open && <div className="expand-in flex flex-col gap-2.5 pb-3">{children}</div>}
    </div>
  )
}

// ─── Read-only stat bar ───────────────────────────────────────────────────────

function StatBar({ label, value, bar }: { label: string; value: string; bar: number }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-32 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 4, background: 'var(--color-border)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, bar))}%`,
            background: 'var(--color-accent)',
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <span className="text-xs mono w-9 text-right shrink-0" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </span>
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

function SonarIcon(): JSX.Element {
  return (
    <span className="mono" style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.5px' }}>
      GG
    </span>
  )
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

function ConnectivityIcon({
  icon,
  active,
  pairing,
  title,
}: {
  icon: React.ReactNode
  active: boolean
  pairing?: boolean
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
      ? 'var(--color-status-ok)'
      : 'var(--color-text-secondary)'

  return (
    <span
      title={title}
      style={{
        color,
        opacity: pairing && !visible ? 0.15 : active ? 1 : 0.45,
        transition: 'opacity 200ms ease',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {icon}
    </span>
  )
}

// ─── GG Sonar indicator ───────────────────────────────────────────────────────

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

// ─── Volume limiter indicator ─────────────────────────────────────────────────

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

// ─── USB input selector ───────────────────────────────────────────────────────

const USB_INPUT_OPTIONS: { value: ArctisState['usbInput']; label: string }[] = [
  { value: 'INPUT_1', label: 'USB-1' },
  { value: 'INPUT_2', label: 'USB-2' },
]

function UsbInputTag({
  value,
  onChange,
}: {
  value: ArctisState['usbInput']
  onChange: (v: ArctisState['usbInput']) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label = value === 'INPUT_1' ? 'USB-1' : 'USB-2'

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        <ChevronIcon open={open} />
      </button>
      {open && pos && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="menu-in"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            overflow: 'hidden',
            minWidth: 100,
          }}
        >
          {USB_INPUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs"
              style={{
                background: opt.value === value ? 'var(--color-surface-raised)' : 'transparent',
                color: opt.value === value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                border: 'none',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 12, color: 'var(--color-accent)', flexShrink: 0 }}>
                {opt.value === value ? '✓' : ''}
              </span>
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
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


// ─── HeadsetCard ──────────────────────────────────────────────────────────────

export function HeadsetCard({ state, expandByDefault = false }: { state: ArctisState; expandByDefault?: boolean }): JSX.Element {
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
    <div className="card">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: state.baseStationConnected && state.headsetPowered === true ? 'var(--color-status-ok)' : 'var(--color-accent)' }}>
            <HeadphonesIcon />
          </span>
          <span className="card-title">
            Arctis Nova Pro Wireless
          </span>
          {state.baseStationConnected && (
            <>
              <div className="flex flex-col gap-0.5">
                <ConnectivityIcon
                  icon={<WirelessIcon />}
                  active={state.wirelessConnected}
                  title={`2.4 GHz Wireless — ${state.wirelessConnected ? 'Active' : 'Absent'}`}
                />
                <ConnectivityIcon
                  icon={<BluetoothIcon />}
                  active={state.btStatus === 'CONNECTED'}
                  pairing={state.btStatus === 'PAIRING'}
                  title={`Bluetooth — ${state.btStatus === 'CONNECTED' ? 'Connected' : state.btStatus === 'PAIRING' ? 'Pairing…' : state.btStatus === 'ON' ? 'On' : 'Off'}`}
                />
              </div>
              <SonarIndicator connected={state.sonarConnected} />
              <VolumeLimiterIndicator on={state.volumeLimiterOn} />
              <UsbInputTag
                value={state.usbInput}
                onChange={(v) => cmd('setUsbInput', v, { usbInput: v })}
              />
            </>
          )}
        </div>
        {state.baseStationConnected && (
          <div className="flex items-center gap-2">
            {state.headsetPowered !== false && (
              <BatteryIndicator level={batteryHeadset} charging={false} title={`Headset battery: ${batteryHeadset}%`} />
            )}
            <BatteryIndicator level={batteryDock} charging={true} title={`Dock battery: ${batteryDock}%`} hidePercent />
          </div>
        )}
      </div>

      {/* ── Volume (always visible, controllable) ── */}
      <div className="mb-3" style={{ opacity: state.baseStationConnected ? 1 : 0.4, pointerEvents: state.baseStationConnected ? 'auto' : 'none' }}>
        <ControlRow label="Volume">
          <Slider
            value={volume}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => cmd('setVolume', v, { volume: v })}
          />
        </ControlRow>
      </div>

      {/* ── ChatMix balance (hardware dial — display only) ── */}
      <div className="flex items-center gap-3" style={{ opacity: state.baseStationConnected ? 1 : 0.4, pointerEvents: state.baseStationConnected ? 'auto' : 'none' }}>
        <button
          onClick={() => cmd('setChatmixEnabled', !state.chatmixEnabled, { chatmixEnabled: !state.chatmixEnabled })}
          className="card-row-label shrink-0 w-32 text-left"
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

    </div>
  )
}
