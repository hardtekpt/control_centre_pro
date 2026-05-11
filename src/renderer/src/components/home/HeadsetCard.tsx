import { useState } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import type { ArctisState } from '@shared/types'

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
            borderRight:
              i < options.length - 1 ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
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
      <span
        className="text-xs shrink-0 w-32"
        style={{ color: 'var(--color-text-secondary)' }}
      >
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
        transition: 'transform 150ms ease',
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
        className="w-full flex items-center justify-between py-2.5"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
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

// ─── Status bar ───────────────────────────────────────────────────────────────

function StatBar({
  label,
  value,
  bar,
}: {
  label: string
  value: string
  bar: number
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs w-32 shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
      >
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
      <span
        className="text-xs mono w-9 text-right shrink-0"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Connectivity icons ───────────────────────────────────────────────────────

function UsbIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10" />
      <path d="M8 6H5v4h3" />
      <path d="M16 6h3v4h-3" />
      <path d="M6 18a3 3 0 0 0 6 0v-6H6v6z" />
      <path d="M18 18a3 3 0 0 0-6 0v-6h6v6z" />
    </svg>
  )
}

function WirelessIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  )
}

function BluetoothIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  )
}

function ConnectivityDot({
  icon,
  active,
  title,
}: {
  icon: React.ReactNode
  active: boolean
  title: string
}): JSX.Element {
  return (
    <div
      title={title}
      className="w-6 h-6 rounded-full flex items-center justify-center"
      style={{
        background: active ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'var(--color-surface-raised)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        opacity: active ? 1 : 0.45,
      }}
    >
      {icon}
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

const ANC_OPTIONS: Option<ArctisState['ancMode']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'TRANSPARENCY', label: 'Transparency' },
  { value: 'ANC', label: 'ANC' },
]

const SIDETONE_OPTIONS: Option<ArctisState['sidetone']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

const GAIN_OPTIONS: Option<ArctisState['micGain']>[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'HIGH', label: 'High' },
]

const WIRELESS_MODE_OPTIONS: Option<ArctisState['wirelessMode']>[] = [
  { value: 'SPEED', label: 'Speed' },
  { value: 'RANGE', label: 'Range' },
]

const AUTO_MUTE_OPTIONS: Option<ArctisState['autoMute']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'ON', label: 'On' },
  { value: 'DB12', label: '-12 dB' },
]

const BOOL_OPTIONS: Option<'ON' | 'OFF'>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'ON', label: 'On' },
]

const AUDIO_OUTPUT_OPTIONS: Option<ArctisState['audioOutput']>[] = [
  { value: 'SPEAKERS', label: 'Speakers' },
  { value: 'STREAM', label: 'Stream' },
]

const HOMESCREEN_OPTIONS: Option<ArctisState['homescreenMode']>[] = [
  { value: 'DEFAULT', label: 'Default' },
  { value: 'LOGO', label: 'Logo' },
  { value: 'CLOCK', label: 'Clock' },
]

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
  const batteryDock = Math.round(state.batteryDock)
  const volume = Math.round(state.volume)

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}>
            <HeadphonesIcon />
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Arctis Nova Pro Wireless
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ConnectivityDot icon={<UsbIcon />} active={true} title="USB / Dongle" />
          <ConnectivityDot icon={<WirelessIcon />} active={state.wirelessConnected} title="2.4 GHz" />
          <ConnectivityDot icon={<BluetoothIcon />} active={state.btActive} title="Bluetooth" />
        </div>
      </div>

      {/* ── Status bars ── */}
      <div className="flex flex-col gap-2 mb-1">
        <StatBar label="Headset battery" value={`${batteryHeadset}%`} bar={batteryHeadset} />
        <StatBar label="Dock battery" value={`${batteryDock}%`} bar={batteryDock} />
        <StatBar label="Volume" value={`${volume}%`} bar={volume} />
      </div>

      {/* ── ANC ── */}
      <Section
        title="ANC"
        summary={state.ancMode === 'OFF' ? 'Off' : state.ancMode === 'ANC' ? 'ANC' : `Transparency · ${state.transparencyLevel}`}
      >
        <ControlRow label="Mode">
          <OptionGroup
            value={state.ancMode}
            options={ANC_OPTIONS}
            onChange={(v) => cmd('setAncMode', v, { ancMode: v })}
          />
        </ControlRow>
        {state.ancMode !== 'OFF' && (
          <ControlRow label="Level">
            <Slider
              value={state.transparencyLevel}
              min={1}
              max={10}
              onChange={(v) => cmd('setTransparencyLevel', v, { transparencyLevel: v })}
            />
          </ControlRow>
        )}
      </Section>

      {/* ── Audio Options ── */}
      <Section
        title="Audio Options"
        summary={`Gain: ${state.micGain === 'LOW' ? 'Low' : 'High'} · Sidetone: ${state.sidetone === 'OFF' ? 'Off' : state.sidetone.charAt(0) + state.sidetone.slice(1).toLowerCase()}`}
      >
        <ControlRow label="Gain">
          <OptionGroup
            value={state.micGain}
            options={GAIN_OPTIONS}
            onChange={(v) => cmd('setMicGain', v, { micGain: v })}
          />
        </ControlRow>
        <ControlRow label="Sidetone">
          <OptionGroup
            value={state.sidetone}
            options={SIDETONE_OPTIONS}
            onChange={(v) => cmd('setSidetone', v, { sidetone: v })}
          />
        </ControlRow>
        <ControlRow label="Mic Volume">
          <Slider
            value={state.micVolume}
            min={1}
            max={10}
            onChange={(v) => cmd('setMicVolume', v, { micVolume: v })}
          />
        </ControlRow>
      </Section>

      {/* ── Wireless ── */}
      <Section
        title="Wireless"
        summary={`${state.wirelessMode === 'SPEED' ? 'Speed' : 'Range'} · BT ${state.btDefault ? 'On' : 'Off'}`}
      >
        <ControlRow label="2.4 GHz Mode">
          <OptionGroup
            value={state.wirelessMode}
            options={WIRELESS_MODE_OPTIONS}
            onChange={(v) => cmd('setWirelessMode', v, { wirelessMode: v })}
          />
        </ControlRow>
        <ControlRow label="BT Default">
          <OptionGroup
            value={state.btDefault ? 'ON' : 'OFF'}
            options={BOOL_OPTIONS}
            onChange={(v) => {
              const val = v === 'ON'
              cmd('setBtDefault', val, { btDefault: val })
            }}
          />
        </ControlRow>
        <ControlRow label="Auto Mute">
          <OptionGroup
            value={state.autoMute}
            options={AUTO_MUTE_OPTIONS}
            onChange={(v) => cmd('setAutoMute', v, { autoMute: v })}
          />
        </ControlRow>
      </Section>

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
                  window.api.arctisCmd('setStreamLevels', {
                    main: v,
                    aux: state.streamAux,
                    mic: state.streamMic,
                  }).catch(console.error)
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
                  window.api.arctisCmd('setStreamLevels', {
                    main: state.streamMain,
                    aux: v,
                    mic: state.streamMic,
                  }).catch(console.error)
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
                  window.api.arctisCmd('setStreamLevels', {
                    main: state.streamMain,
                    aux: state.streamAux,
                    mic: v,
                  }).catch(console.error)
                }}
              />
            </ControlRow>
          </>
        )}
      </Section>

      {/* ── Base Station ── */}
      <Section
        title="Base Station"
        summary={`OLED ${state.oledBrightness}% · ${state.homescreenMode.charAt(0) + state.homescreenMode.slice(1).toLowerCase()}`}
      >
        <ControlRow label="OLED Brightness">
          <Slider
            value={state.oledBrightness}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => cmd('setOledBrightness', v, { oledBrightness: v })}
          />
        </ControlRow>
        <ControlRow label="Dim Screen">
          <OptionGroup
            value={state.dimScreen ? 'ON' : 'OFF'}
            options={BOOL_OPTIONS}
            onChange={(v) => {
              const val = v === 'ON'
              cmd('setDimScreen', val, { dimScreen: val })
            }}
          />
        </ControlRow>
        <ControlRow label="Homescreen">
          <OptionGroup
            value={state.homescreenMode}
            options={HOMESCREEN_OPTIONS}
            onChange={(v) => cmd('setHomescreenMode', v, { homescreenMode: v })}
          />
        </ControlRow>
        <ControlRow label="Mic LED">
          <Slider
            value={state.micLedBrightness}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => cmd('setMicLedBrightness', v, { micLedBrightness: v })}
          />
        </ControlRow>
        <ControlRow label="Auto Off">
          <OptionGroup
            value={state.autoOff ? 'ON' : 'OFF'}
            options={BOOL_OPTIONS}
            onChange={(v) => {
              const val = v === 'ON'
              cmd('setAutoOff', val, { autoOff: val })
            }}
          />
        </ControlRow>
      </Section>
    </div>
  )
}
