import { useState } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import type { ArctisState, Option, TimeoutStep } from '@shared/types'
import { ConfirmDialog } from '../common/ConfirmDialog'

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
        <span className="card-title">{title}</span>
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
      <span className="card-row-label shrink-0 w-32">
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

export function BaseStationPanel({ state, expandByDefault = false }: { state: ArctisState; expandByDefault?: boolean }): JSX.Element {
  const { updateArctisState } = useServiceStore()
  const [showResetDialog, setShowResetDialog] = useState(false)

  function cmd<K extends keyof ArctisState>(
    cmdName: string,
    value: unknown,
    patch: Pick<ArctisState, K>,
  ): void {
    updateArctisState(patch)
    window.api.arctisCmd(cmdName, value).catch(console.error)
  }

  function handleFactoryReset(): void {
    window.api.arctisCmd('factoryReset', null).catch(console.error)
    setShowResetDialog(false)
  }

  return (
    <div className="card">
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
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={() => setShowResetDialog(true)}
          className="text-xs px-3 py-1.5 rounded transition-colors"
          style={{
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement
            target.style.background = 'var(--color-border)'
            target.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement
            target.style.background = 'var(--color-surface-raised)'
            target.style.color = 'var(--color-text-secondary)'
          }}
        >
          Factory Reset
        </button>
      </div>
      {showResetDialog && (
        <ConfirmDialog
          title="Factory Reset"
          message="Reset headset and base station to factory defaults?\n\nAll custom settings will be lost."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          isDangerous={true}
          onConfirm={handleFactoryReset}
          onCancel={() => setShowResetDialog(false)}
        />
      )}
    </div>
  )
}
