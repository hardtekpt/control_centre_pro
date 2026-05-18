import { useRef, useEffect } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import type { ArctisState, Option } from '@shared/types'

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

function MicIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
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
  const containerRef = useRef<HTMLDivElement>(null)

  const ANC_OPTIONS: Option<ArctisState['ancMode']>[] = [
    { value: 'OFF', label: 'Off' },
    { value: 'TRANSPARENCY', label: 'Transparency' },
    { value: 'ANC', label: 'ANC' },
  ]

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      const button = (e.target as HTMLElement).closest('button')
      if (button && button.textContent?.includes('Transparency')) {
        e.preventDefault()
        const delta = e.deltaY < 0 ? 1 : -1
        const next = Math.max(1, Math.min(10, transparencyLevel + delta))
        if (next !== transparencyLevel) onLevelChange(next)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [transparencyLevel, onLevelChange])

  return (
    <div
      ref={containerRef}
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

export function AudioOptionsPanel({ state, expandByDefault = false }: { state: ArctisState; expandByDefault?: boolean }): JSX.Element {
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
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}><MicIcon /></span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Audio Options
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <GridRow label="ANC">
          <AncModeControl
            value={state.ancMode}
            transparencyLevel={state.transparencyLevel}
            onModeChange={(v) => cmd('setAncMode', v, { ancMode: v })}
            onLevelChange={(v) => cmd('setTransparencyLevel', v, { transparencyLevel: v })}
          />
        </GridRow>
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
      </div>
    </div>
  )
}
