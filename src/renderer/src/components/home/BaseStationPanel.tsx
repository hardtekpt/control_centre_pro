import { useServiceStore } from '../../stores/serviceStore'
import type { ArctisState, Option, TimeoutStep } from '@shared/types'

const TIMEOUT_OPTIONS: Option<TimeoutStep>[] = [
  { value: 'OFF',         label: 'Off' },
  { value: 'ONE_MIN',     label: '1m' },
  { value: 'FIVE_MIN',    label: '5m' },
  { value: 'TEN_MIN',     label: '10m' },
  { value: 'FIFTEEN_MIN', label: '15m' },
  { value: 'THIRTY_MIN',  label: '30m' },
  { value: 'SIXTY_MIN',   label: '60m' },
]

const HOMESCREEN_OPTIONS: Option<ArctisState['homescreenMode']>[] = [
  { value: 'DETAILED', label: 'Detailed' },
  { value: 'SIMPLE', label: 'Simple' },
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

function BaseStationIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="12" rx="2" />
      <path d="M6 12h12M6 16h12" />
    </svg>
  )
}

function Section({
  title,
  children,
  icon,
}: {
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {icon && <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}>{icon}</span>}
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
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
    <div className="flex items-center gap-2 py-1" style={{ border: '1px solid transparent' }}>
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

export function BaseStationPanel({ state, expandByDefault = false }: { state: ArctisState; expandByDefault?: boolean }): JSX.Element {
  const { updateArctisState } = useServiceStore()

  function cmd<K extends keyof ArctisState>(
    cmdName: string,
    value: unknown,
    patch: Pick<ArctisState, K>,
  ): void {
    updateArctisState(patch)
    window.api.arctisCmd(cmdName, value).catch(console.error)
  }

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Section
        title="Base Station"
        icon={<BaseStationIcon />}
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
    </div>
  )
}
