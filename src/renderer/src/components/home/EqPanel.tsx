import { useRef, useEffect } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import type { ArctisState, Option } from '@shared/types'

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

function EqIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="3" height="16" rx="1" />
      <rect x="10" y="8" width="3" height="12" rx="1" />
      <rect x="18" y="6" width="3" height="14" rx="1" />
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

export function EqPanel({ state, expandByDefault = false }: { state: ArctisState; expandByDefault?: boolean }): JSX.Element {
  const { updateArctisState } = useServiceStore()
  const containerRef = useRef<HTMLDivElement>(null)

  function cmd<K extends keyof ArctisState>(
    cmdName: string,
    value: unknown,
    patch: Pick<ArctisState, K>,
  ): void {
    updateArctisState(patch)
    window.api.arctisCmd(cmdName, value).catch(console.error)
  }

  const isCustom = state.eqPresetIndex === EQ_CUSTOM_INDEX
  const namedPreset = EQ_NAMED_PRESETS.find((p) => p.index === state.eqPresetIndex)
  const summary = isCustom ? 'Custom' : (namedPreset?.label ?? `Preset ${state.eqPresetIndex}`)
  const bands = state.eqBands?.length === 10 ? state.eqBands : Array(10).fill(20)


  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Section title="EQ" icon={<EqIcon />}>
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
            ref={containerRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: '0 4px',
              marginTop: '10px',
            }}
          >
            {EQ_BAND_FREQS.map((freq, i) => {
              const raw = bands[i] ?? 20   // 0–40, 20 = flat
              const db  = raw - 20          // display as –20…+20 dB
              const normalized = raw / 40   // normalize to 0-1
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
                        cmd('setEqBands', newBands, { eqBands: newBands })
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
      </Section>
    </div>
  )
}
