import { useState, useEffect } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
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
    <div className="flex items-center gap-2">
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

function ControlRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs shrink-0 w-32" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ─── Grid panel (always-visible column) ──────────────────────────────────────

function GridPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className="text-xs font-semibold"
        style={{ color: 'var(--color-text-primary)', paddingBottom: 2 }}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

function GridRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      {children}
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
        transition: 'transform 150ms ease',
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
}: {
  title: string
  summary?: string
  children: React.ReactNode
}): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: '10px 0' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </span>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="text-xs mono" style={{ color: 'var(--color-text-secondary)' }}>
              {summary}
            </span>
          )}
          <span style={{ color: 'var(--color-text-secondary)' }}>
            <ChevronIcon open={open} />
          </span>
        </div>
      </button>
      {open && <div className="flex flex-col gap-2.5 pb-3">{children}</div>}
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

// ─── Option sets ──────────────────────────────────────────────────────────────

const ANC_OPTIONS: Option<ArctisState['ancMode']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'TRANSPARENCY', label: 'Transparency' },
  { value: 'ANC', label: 'ANC' },
]

const GAIN_OPTIONS: Option<ArctisState['micGain']>[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'HIGH', label: 'High' },
]

const SIDETONE_OPTIONS: Option<ArctisState['sidetone']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Med' },
  { value: 'HIGH', label: 'High' },
]

const WIRELESS_MODE_OPTIONS: Option<ArctisState['wirelessMode']>[] = [
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'EXTENDED_RANGE', label: 'Range' },
]

const BT_AUTO_MUTE_OPTIONS: Option<ArctisState['btAutoMute']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'DB_MINUS_12', label: '-12 dB' },
  { value: 'FULL', label: 'Full' },
]

const BOOL_OPTIONS: Option<'OFF' | 'ON'>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'ON', label: 'On' },
]

const AUDIO_OUTPUT_OPTIONS: Option<ArctisState['audioOutput']>[] = [
  { value: 'SPEAKERS', label: 'Speakers' },
  { value: 'STREAM', label: 'Stream' },
]

const HOMESCREEN_OPTIONS: Option<ArctisState['homescreenMode']>[] = [
  { value: 'DETAILED', label: 'Detailed' },
  { value: 'SIMPLE', label: 'Simple' },
]

const EQ_CUSTOM_INDEX = 0x04

// Factory preset index → label mapping (index 0x04 is custom, excluded from selector)
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

const TIMEOUT_OPTIONS: Option<TimeoutStep>[] = [
  { value: 'OFF',         label: 'Off' },
  { value: 'ONE_MIN',     label: '1m' },
  { value: 'FIVE_MIN',    label: '5m' },
  { value: 'TEN_MIN',     label: '10m' },
  { value: 'FIFTEEN_MIN', label: '15m' },
  { value: 'THIRTY_MIN',  label: '30m' },
  { value: 'SIXTY_MIN',   label: '60m' },
]

const TIMEOUT_LABELS: Record<TimeoutStep, string> = {
  OFF: 'Off',
  ONE_MIN: '1 min',
  FIVE_MIN: '5 min',
  TEN_MIN: '10 min',
  FIFTEEN_MIN: '15 min',
  THIRTY_MIN: '30 min',
  SIXTY_MIN: '60 min',
}

// ─── HeadsetCard ──────────────────────────────────────────────────────────────

export function HeadsetCard({ state }: { state: ArctisState }): JSX.Element {
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
      <div className="flex items-center justify-between mb-3">
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
            <ConnectivityDot icon={<WirelessIcon />}  dotState={state.wirelessConnected ? 'on' : 'off'}                                           title="2.4 GHz Wireless" />
            <ConnectivityDot icon={<BluetoothIcon />} dotState={!state.btActive ? 'off' : state.btPairing ? 'pairing' : state.btConnected ? 'connected' : 'on'} title="Bluetooth" />
          </div>
        </div>
      </div>

      {/* ── Volume (always visible, controllable) ── */}
      <div className="mb-3">
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => cmd('setChatmixEnabled', !state.chatmixEnabled, { chatmixEnabled: !state.chatmixEnabled })}
          className="text-xs shrink-0 w-32 text-left"
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

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0' }} />

      {/* ── ANC · Audio Options · Wireless (3-column adaptive grid) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px 20px',
          marginBottom: 4,
        }}
      >
        {/* ANC */}
        <GridPanel title="ANC">
          <GridRow label="Mode">
            <OptionGroup
              value={state.ancMode}
              options={ANC_OPTIONS}
              onChange={(v) => cmd('setAncMode', v, { ancMode: v })}
            />
          </GridRow>
          {state.ancMode !== 'OFF' && (
            <GridRow label="Level">
              <Slider
                value={state.transparencyLevel}
                min={1}
                max={10}
                onChange={(v) => cmd('setTransparencyLevel', v, { transparencyLevel: v })}
              />
            </GridRow>
          )}
        </GridPanel>

        {/* Audio Options */}
        <GridPanel title="Audio Options">
          <GridRow label="Gain">
            <OptionGroup
              value={state.micGain}
              options={GAIN_OPTIONS}
              onChange={(v) => cmd('setMicGain', v, { micGain: v })}
            />
          </GridRow>
          <GridRow label="Sidetone">
            <OptionGroup
              value={state.sidetone}
              options={SIDETONE_OPTIONS}
              onChange={(v) => cmd('setSidetone', v, { sidetone: v })}
            />
          </GridRow>
          <GridRow label="Mic Volume">
            <Slider
              value={state.micVolume}
              min={1}
              max={10}
              onChange={(v) => cmd('setMicVolume', v, { micVolume: v })}
            />
          </GridRow>
        </GridPanel>

        {/* Wireless */}
        <GridPanel title="Wireless">
          <GridRow label="2.4 GHz Mode">
            <OptionGroup
              value={state.wirelessMode}
              options={WIRELESS_MODE_OPTIONS}
              onChange={(v) => cmd('setWirelessMode', v, { wirelessMode: v })}
            />
          </GridRow>
          <GridRow label="BT Default">
            <OptionGroup
              value={state.btDefault ? 'ON' : 'OFF'}
              options={BOOL_OPTIONS}
              onChange={(v) => {
                const val = v === 'ON'
                cmd('setBtDefault', val, { btDefault: val })
              }}
            />
          </GridRow>
          <GridRow label="BT Auto Mute">
            <OptionGroup
              value={state.btAutoMute}
              options={BT_AUTO_MUTE_OPTIONS}
              onChange={(v) => cmd('setBtAutoMute', v, { btAutoMute: v })}
            />
          </GridRow>
        </GridPanel>
      </div>

      {/* ── Audio Output ── */}
      <Section
        title="Audio Output"
        summary={state.audioOutput === 'SPEAKERS' ? 'Speakers' : 'Stream'}
      >
        <ControlRow label="Output">
          <OptionGroup
            value={state.audioOutput}
            options={AUDIO_OUTPUT_OPTIONS}
            onChange={(v) => cmd('setAudioOutput', v, { audioOutput: v })}
          />
        </ControlRow>
        {state.audioOutput === 'STREAM' && (
          <>
            <ControlRow label="Main">
              <Slider
                value={state.streamMain}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => {
                  updateArctisState({ streamMain: v })
                  window.api.arctisCmd('setStreamVolumes', { main: v, aux: state.streamAux, mic: state.streamMic }).catch(console.error)
                }}
              />
            </ControlRow>
            <ControlRow label="Aux">
              <Slider
                value={state.streamAux}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => {
                  updateArctisState({ streamAux: v })
                  window.api.arctisCmd('setStreamVolumes', { main: state.streamMain, aux: v, mic: state.streamMic }).catch(console.error)
                }}
              />
            </ControlRow>
            <ControlRow label="Mic">
              <Slider
                value={state.streamMic}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => {
                  updateArctisState({ streamMic: v })
                  window.api.arctisCmd('setStreamVolumes', { main: state.streamMain, aux: state.streamAux, mic: v }).catch(console.error)
                }}
              />
            </ControlRow>
          </>
        )}
      </Section>

      {/* ── Base Station ── */}
      <Section
        title="Base Station"
        summary={`OLED ${state.oledBrightness} · Dim-Screen ${TIMEOUT_LABELS[state.dimTimeout]} · Homescreen ${state.homescreenMode === 'DETAILED' ? 'Detailed' : 'Simple'} · Mic-LED ${state.micLedBrightness} · Auto-Off ${TIMEOUT_LABELS[state.autoOffTimeout]}`}
      >
        <ControlRow label="OLED Brightness">
          <Slider
            value={state.oledBrightness}
            min={1}
            max={10}
            onChange={(v) => cmd('setOledBrightness', v, { oledBrightness: v })}
          />
        </ControlRow>
        <ControlRow label="Dim Screen">
          <OptionGroup
            value={state.dimTimeout}
            options={TIMEOUT_OPTIONS}
            onChange={(v) => cmd('setDimTimeout', v, { dimTimeout: v })}
          />
        </ControlRow>
        <ControlRow label="Homescreen">
          <OptionGroup
            value={state.homescreenMode}
            options={HOMESCREEN_OPTIONS}
            onChange={(v) => cmd('setHomeScreenMode', v, { homescreenMode: v })}
          />
        </ControlRow>
        <ControlRow label="Mic LED">
          <Slider
            value={state.micLedBrightness}
            min={1}
            max={10}
            onChange={(v) => cmd('setMicLedBrightness', v, { micLedBrightness: v })}
          />
        </ControlRow>
        <ControlRow label="Auto Off">
          <OptionGroup
            value={state.autoOffTimeout}
            options={TIMEOUT_OPTIONS}
            onChange={(v) => cmd('setAutoOffTimeout', v, { autoOffTimeout: v })}
          />
        </ControlRow>
      </Section>

      {/* ── EQ ── */}
      {(() => {
        const isCustom = state.eqPresetIndex === EQ_CUSTOM_INDEX
        const namedPreset = EQ_NAMED_PRESETS.find((p) => p.index === state.eqPresetIndex)
        const summary = isCustom ? 'Custom' : (namedPreset?.label ?? `Preset ${state.eqPresetIndex}`)
        const bands = state.eqBands?.length === 10 ? state.eqBands : Array(10).fill(20)
        return (
          <Section title="EQ" summary={summary}>
            {/* Mode toggle — Custom first, then Preset */}
            <ControlRow label="Mode">
              <OptionGroup
                value={isCustom ? 'CUSTOM' : 'PRESET'}
                options={[
                  { value: 'CUSTOM', label: 'Custom' },
                  { value: 'PRESET', label: 'Preset' },
                ] as Option<'PRESET' | 'CUSTOM'>[]}
                onChange={(v) => {
                  if (v === 'CUSTOM') {
                    cmd('setEqBands', bands, { eqPresetIndex: EQ_CUSTOM_INDEX })
                  } else {
                    const defaultIndex = EQ_NAMED_PRESETS[0].index
                    cmd('setEqPreset', defaultIndex, { eqPresetIndex: defaultIndex })
                  }
                }}
              />
            </ControlRow>

            {/* Preset selector — custom index is hidden; selecting it switches to custom mode */}
            {!isCustom && (
              <ControlRow label="Preset">
                <select
                  value={state.eqPresetIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value)
                    if (idx === EQ_CUSTOM_INDEX) {
                      cmd('setEqBands', bands, { eqPresetIndex: EQ_CUSTOM_INDEX })
                    } else {
                      cmd('setEqPreset', idx, { eqPresetIndex: idx })
                    }
                  }}
                  className="flex-1 text-xs rounded px-2 py-1 w-full"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {EQ_NAMED_PRESETS.map((p) => (
                    <option key={p.index} value={p.index}>{p.label}</option>
                  ))}
                  {/* Fallback for unknown indices reported by the device */}
                  {!EQ_NAMED_PRESETS.some((p) => p.index === state.eqPresetIndex) && (
                    <option value={state.eqPresetIndex}>Preset {state.eqPresetIndex}</option>
                  )}
                </select>
              </ControlRow>
            )}

            {/* Custom EQ band levels */}
            {isCustom && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, 1fr)',
                  gap: '0 4px',
                }}
              >
                {EQ_BAND_FREQS.map((freq, i) => {
                  const raw = bands[i] ?? 20   // 0–40, 20 = flat
                  const db  = raw - 20          // display as –20…+20 dB
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 9, lineHeight: 1 }}>
                        {freq}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={raw}
                        onChange={(e) => {
                          const newBands = [...bands]
                          newBands[i] = Number(e.target.value)
                          cmd('setEqBands', newBands, { eqBands: newBands })
                        }}
                        style={{
                          accentColor: 'var(--color-accent)',
                          cursor: 'pointer',
                          width: '100%',
                          writingMode: 'vertical-lr',
                          direction: 'rtl',
                          height: 72,
                          // @ts-expect-error — non-standard but supported in Chromium (Electron)
                          appearance: 'slider-vertical',
                        }}
                      />
                      <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 9, lineHeight: 1 }}>
                        {db > 0 ? `+${db}` : db}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        )
      })()}
    </div>
  )
}
