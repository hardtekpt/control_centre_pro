import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type {
  SonarConfig,
  SonarConfigData,
  SonarParametricEQ,
  SonarEQFilter,
  SonarDeviceChannel,
} from '@shared/types'
import { SliderInput } from '../SliderInput'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  master: 'Master',
  game: 'Game',
  chatRender: 'Chat Output',
  chatCapture: 'Mic Input',
  media: 'Media',
  aux: 'Aux',
}

type EQFilterKey = Exclude<keyof SonarParametricEQ, 'enabled'>
const FILTER_KEYS: EQFilterKey[] = [
  'filter1', 'filter2', 'filter3', 'filter4', 'filter5',
  'filter6', 'filter7', 'filter8', 'filter9', 'filter10',
]

const EQ_TYPES: SonarEQFilter['type'][] = ['peakingEQ', 'lowShelving', 'highShelving']
const EQ_TYPE_LABELS: Record<SonarEQFilter['type'], string> = {
  peakingEQ: 'Peak',
  lowShelving: 'Low Shelf',
  highShelving: 'High Shelf',
}

const OUTPUT_EQ_FREQS = [35, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 16000]
const MIC_EQ_FREQS = [80, 200, 400, 800, 1600, 3200, 6400, 8000, 12000, 16000]

function makeEQ(freqs: number[], types: SonarEQFilter['type'][]): SonarParametricEQ {
  const f = (i: number): SonarEQFilter => ({
    enabled: true, qFactor: 0.7071, frequency: freqs[i], gain: 0, type: types[i],
  })
  return {
    enabled: true,
    filter1: f(0), filter2: f(1), filter3: f(2), filter4: f(3), filter5: f(4),
    filter6: f(5), filter7: f(6), filter8: f(7), filter9: f(8), filter10: f(9),
  }
}

function makeOutputEQ(): SonarParametricEQ {
  return makeEQ(OUTPUT_EQ_FREQS, OUTPUT_EQ_FREQS.map(() => 'peakingEQ'))
}

function makeMicEQ(): SonarParametricEQ {
  const types = MIC_EQ_FREQS.map((_, i): SonarEQFilter['type'] =>
    i === 0 ? 'lowShelving' : i === 9 ? 'highShelving' : 'peakingEQ')
  return makeEQ(MIC_EQ_FREQS, types)
}

const DEFAULT_OUTPUT_DATA: SonarConfigData = {
  bassBoostState: { enabled: false, value: 0 },
  trebleBoostState: { enabled: false, value: 0 },
  voiceClarityState: { enabled: false, value: 0 },
  smartVolume: { enabled: false, volumeLevel: 0, loudness: 'balanced' },
  generalGain: 0,
  parametricEQ: makeOutputEQ(),
  virtualSurroundState: false,
  virtualSurroundChannels: {
    frontLeft: { position: 30, gain: 0 },
    frontRight: { position: -30, gain: 0 },
    center: { position: 0, gain: 0 },
    subWoofer: { position: 0, gain: 0 },
    rearLeft: { position: 150, gain: 0 },
    rearRight: { position: -150, gain: 0 },
    sideLeft: { position: 90, gain: 0 },
    sideRight: { position: -90, gain: 0 },
  },
  reverbGainDB: -6,
  formFactor: 'headphones',
  globalEnableState: true,
}

const DEFAULT_MIC_DATA: SonarConfigData = {
  noiseReductionState: { enabled: false, value: 0 },
  volumeStabilizerState: { enabled: false, value: 0 },
  noiseGateState: { enabled: false, value: -38.8 },
  automaticNoiseGateState: { enabled: false, value: 0 },
  impactNoiseReductionState: { enabled: false, value: 0 },
  noiseCancelingState: { enabled: false, value: 0 },
  acousticEchoCancelingState: false,
  parametricEQ: makeMicEQ(),
  globalEnableState: true,
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function isMicChannel(channel: string): boolean {
  return channel === 'chatCapture'
}

function fmtDb(v: number): string {
  return `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} dB`
}

function buildNewConfig(channel: SonarDeviceChannel): SonarConfig {
  const now = new Date().toISOString()
  const mic = isMicChannel(channel)
  return {
    id: crypto.randomUUID(),
    name: 'New Preset',
    virtualAudioDevice: channel,
    data: clone(mic ? DEFAULT_MIC_DATA : DEFAULT_OUTPUT_DATA),
    isPreset: false,
    isFavorite: false,
    favoritePosition: -1,
    image: '8.svg',
    createdAt: now,
    updatedAt: now,
    schemaVersion: mic ? 6 : 5,
    releaseVersion: null,
  }
}

// ─── Inline primitives ──────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled = false }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }): JSX.Element {
  return (
    <button
      onClick={() => { if (!disabled) onChange(!value) }}
      disabled={disabled}
      style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0,
        background: value ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 12 : 2,
        width: 10, height: 10, borderRadius: '50%',
        background: value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
        transition: 'left 0.15s',
      }} />
    </button>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--color-text-secondary)' }}>
          {title}
        </h3>
        {right}
      </div>
      <div
        className="rounded-md overflow-hidden"
        style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        <div className="px-3">{children}</div>
      </div>
    </div>
  )
}

function RowShell({ children, last = false }: { children: React.ReactNode; last?: boolean }): JSX.Element {
  return (
    <div className="py-2" style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      {children}
    </div>
  )
}

function NumberField({
  value, min, max, step = 1, onChange, width = 56, disabled = false,
}: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; width?: number; disabled?: boolean
}): JSX.Element {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
      }}
      className="mono"
      style={{
        width, fontSize: 11, padding: '2px 4px', textAlign: 'right',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: 4, color: 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'text', opacity: disabled ? 0.5 : 1,
      }}
    />
  )
}

function Select<T extends string>({
  value, options, onChange, width = 'auto', disabled = false,
}: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; width?: number | string; disabled?: boolean
}): JSX.Element {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        width, fontSize: 11, padding: '2px 4px',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: 4, color: 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function RangeSlider({
  value, min, max, step = 1, onChange, format, disabled = false,
}: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean
}): JSX.Element {
  const norm = (value - min) / (max - min)
  return (
    <div className="flex items-center gap-2" style={{ flex: 1 }}>
      <SliderInput
        disabled={disabled}
        value={Math.max(0, Math.min(1, norm))}
        onChange={(v) => {
          const raw = min + v * (max - min)
          const snapped = Math.round(raw / step) * step
          onChange(Number(snapped.toFixed(4)))
        }}
      />
      <span className="mono text-xs" style={{ minWidth: 44, textAlign: 'right', color: 'var(--color-text-primary)', opacity: disabled ? 0.6 : 1 }}>
        {format ? format(value) : value}
      </span>
    </div>
  )
}

type ValueState = { enabled: boolean; value: number }

function ToggleSliderRow({
  label, state, min, max, step = 1, format, onChange, last = false, disabled = false,
}: {
  label: string
  state: ValueState | undefined
  min: number; max: number; step?: number
  format?: (v: number) => string
  onChange: (next: ValueState) => void
  last?: boolean
  disabled?: boolean
}): JSX.Element {
  const s = state ?? { enabled: false, value: 0 }
  return (
    <RowShell last={last}>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <Toggle value={s.enabled} disabled={disabled} onChange={(en) => onChange({ ...s, enabled: en })} />
      </div>
      {s.enabled && (
        <div className="mt-2">
          <RangeSlider
            value={s.value}
            min={min}
            max={max}
            step={step}
            format={format}
            disabled={disabled}
            onChange={(v) => onChange({ ...s, value: v })}
          />
        </div>
      )}
    </RowShell>
  )
}

function ToggleRow({
  label, value, onChange, last = false, disabled = false,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean; disabled?: boolean
}): JSX.Element {
  return (
    <RowShell last={last}>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <Toggle value={value} disabled={disabled} onChange={onChange} />
      </div>
    </RowShell>
  )
}

// ─── EQ editor table ──────────────────────────────────────────────────────────

function EQEditor({
  eq, onChange, disabled = false,
}: {
  eq: SonarParametricEQ | undefined
  onChange: (eq: SonarParametricEQ) => void
  disabled?: boolean
}): JSX.Element {
  const safe = eq ?? makeOutputEQ()
  const setFilter = (k: EQFilterKey, patch: Partial<SonarEQFilter>): void => {
    onChange({ ...safe, [k]: { ...safe[k], ...patch } })
  }
  return (
    <Section
      title="Parametric EQ"
      right={<Toggle value={safe.enabled} disabled={disabled} onChange={(en) => onChange({ ...safe, enabled: en })} />}
    >
      {FILTER_KEYS.map((k, i) => {
        const flt = safe[k]
        return (
          <RowShell key={k} last={i === FILTER_KEYS.length - 1}>
            <div className="flex items-center gap-2 flex-wrap">
              <Toggle value={flt.enabled} disabled={disabled} onChange={(en) => setFilter(k, { enabled: en })} />
              <NumberField
                value={flt.frequency}
                min={20}
                max={20000}
                step={1}
                width={62}
                disabled={disabled}
                onChange={(v) => setFilter(k, { frequency: v })}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Hz</span>
              <Select
                value={flt.type}
                options={EQ_TYPES.map((t) => ({ value: t, label: EQ_TYPE_LABELS[t] }))}
                onChange={(v) => setFilter(k, { type: v })}
                width={88}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <RangeSlider
                value={flt.gain}
                min={-12}
                max={12}
                step={0.5}
                format={fmtDb}
                disabled={disabled}
                onChange={(v) => setFilter(k, { gain: v })}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Q</span>
              <NumberField
                value={flt.qFactor}
                min={0.1}
                max={10}
                step={0.01}
                width={52}
                disabled={disabled}
                onChange={(v) => setFilter(k, { qFactor: v })}
              />
            </div>
          </RowShell>
        )
      })}
    </Section>
  )
}

// ─── Output edit form (schemaVersion 5) ─────────────────────────────────────────

const SURROUND_CHANNELS: { key: keyof NonNullable<SonarConfigData['virtualSurroundChannels']>; label: string }[] = [
  { key: 'frontLeft', label: 'Front L' },
  { key: 'frontRight', label: 'Front R' },
  { key: 'center', label: 'Center' },
  { key: 'subWoofer', label: 'Sub' },
  { key: 'rearLeft', label: 'Rear L' },
  { key: 'rearRight', label: 'Rear R' },
  { key: 'sideLeft', label: 'Side L' },
  { key: 'sideRight', label: 'Side R' },
]

function OutputEditForm({
  draft, onChange, disabled = false,
}: {
  draft: SonarConfigData
  onChange: (patch: Partial<SonarConfigData>) => void
  disabled?: boolean
}): JSX.Element {
  const surround = draft.virtualSurroundChannels
  return (
    <>
      <Section title="Processing">
        <ToggleRow label="Global Enable" value={draft.globalEnableState ?? false} disabled={disabled} onChange={(v) => onChange({ globalEnableState: v })} last />
      </Section>

      <Section title="Volume Boost">
        <ToggleSliderRow
          label="Bass Boost"
          state={draft.bassBoostState}
          min={0}
          max={12}
          disabled={disabled}
          onChange={(next) => onChange({ bassBoostState: next })}
        />
        <ToggleSliderRow
          label="Treble Boost"
          state={draft.trebleBoostState}
          min={0}
          max={12}
          disabled={disabled}
          onChange={(next) => onChange({ trebleBoostState: next })}
        />
        <ToggleSliderRow
          label="Voice Clarity"
          state={draft.voiceClarityState}
          min={0}
          max={12}
          disabled={disabled}
          onChange={(next) => onChange({ voiceClarityState: next })}
        />
        <RowShell last>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>General Gain</span>
          </div>
          <div className="mt-2">
            <RangeSlider
              value={draft.generalGain ?? 0}
              min={-12}
              max={12}
              format={fmtDb}
              disabled={disabled}
              onChange={(v) => onChange({ generalGain: v })}
            />
          </div>
        </RowShell>
      </Section>

      <Section
        title="Smart Volume"
        right={<Toggle value={draft.smartVolume?.enabled ?? false} disabled={disabled} onChange={(en) => onChange({ smartVolume: { ...(draft.smartVolume ?? { volumeLevel: 0, loudness: 'balanced' }), enabled: en } })} />}
      >
        {draft.smartVolume?.enabled ? (
          <>
            <RowShell>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Loudness</span>
                <Select
                  value={draft.smartVolume.loudness}
                  options={[
                    { value: 'soft', label: 'Soft' },
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'loud', label: 'Loud' },
                  ]}
                  onChange={(v) => onChange({ smartVolume: { ...draft.smartVolume!, loudness: v } })}
                  width={100}
                  disabled={disabled}
                />
              </div>
            </RowShell>
            <RowShell last>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Volume Level</span>
              <div className="mt-2">
                <RangeSlider
                  value={draft.smartVolume.volumeLevel}
                  min={0}
                  max={100}
                  disabled={disabled}
                  onChange={(v) => onChange({ smartVolume: { ...draft.smartVolume!, volumeLevel: v } })}
                />
              </div>
            </RowShell>
          </>
        ) : (
          <RowShell last>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Off</span>
          </RowShell>
        )}
      </Section>

      <Section
        title="Spatial Audio"
        right={<Toggle value={draft.virtualSurroundState ?? false} disabled={disabled} onChange={(en) => onChange({ virtualSurroundState: en })} />}
      >
        <RowShell>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Form Factor</span>
            <Select
              value={draft.formFactor ?? 'headphones'}
              options={[
                { value: 'headphones', label: 'Headphones' },
                { value: 'speakers', label: 'Speakers' },
              ]}
              onChange={(v) => onChange({ formFactor: v })}
              width={110}
              disabled={disabled}
            />
          </div>
        </RowShell>
        <RowShell last={!draft.virtualSurroundState}>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Reverb Gain</span>
          <div className="mt-2">
            <RangeSlider
              value={draft.reverbGainDB ?? -6}
              min={-40}
              max={0}
              format={fmtDb}
              disabled={disabled}
              onChange={(v) => onChange({ reverbGainDB: v })}
            />
          </div>
        </RowShell>
        {draft.virtualSurroundState && surround && (
          <RowShell last>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span style={{ width: 52 }} />
                <span style={{ width: 62, textAlign: 'center' }}>Pos</span>
                <span style={{ width: 56, textAlign: 'center' }}>Gain</span>
              </div>
              {SURROUND_CHANNELS.map(({ key, label }) => {
                const ch = surround[key]
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs" style={{ width: 52, color: 'var(--color-text-primary)' }}>{label}</span>
                    <NumberField
                      value={ch.position}
                      min={-180}
                      max={180}
                      width={62}
                      disabled={disabled}
                      onChange={(v) => onChange({ virtualSurroundChannels: { ...surround, [key]: { ...ch, position: v } } })}
                    />
                    <NumberField
                      value={ch.gain}
                      min={-12}
                      max={12}
                      width={56}
                      disabled={disabled}
                      onChange={(v) => onChange({ virtualSurroundChannels: { ...surround, [key]: { ...ch, gain: v } } })}
                    />
                  </div>
                )
              })}
            </div>
          </RowShell>
        )}
      </Section>

      <EQEditor eq={draft.parametricEQ} disabled={disabled} onChange={(eq) => onChange({ parametricEQ: eq })} />
    </>
  )
}

// ─── Voice edit form (schemaVersion 6) ──────────────────────────────────────────

function VoiceEditForm({
  draft, onChange, disabled = false,
}: {
  draft: SonarConfigData
  onChange: (patch: Partial<SonarConfigData>) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <>
      <Section title="Processing">
        <ToggleRow label="Global Enable" value={draft.globalEnableState ?? false} disabled={disabled} onChange={(v) => onChange({ globalEnableState: v })} last />
      </Section>

      <Section title="Noise Processing">
        <ToggleSliderRow
          label="Noise Reduction"
          state={draft.noiseReductionState}
          min={0}
          max={3}
          step={0.1}
          disabled={disabled}
          onChange={(next) => onChange({ noiseReductionState: next })}
        />
        <ToggleSliderRow
          label="Noise Gate"
          state={draft.noiseGateState}
          min={-60}
          max={0}
          step={0.1}
          format={fmtDb}
          disabled={disabled}
          onChange={(next) => onChange({ noiseGateState: next })}
        />
        <ToggleSliderRow
          label="Volume Stabilizer"
          state={draft.volumeStabilizerState}
          min={0}
          max={3}
          step={0.1}
          disabled={disabled}
          onChange={(next) => onChange({ volumeStabilizerState: next })}
        />
        <ToggleSliderRow
          label="Impact Noise Reduction"
          state={draft.impactNoiseReductionState}
          min={0}
          max={3}
          step={0.1}
          disabled={disabled}
          onChange={(next) => onChange({ impactNoiseReductionState: next })}
        />
        <ToggleSliderRow
          label="Noise Canceling"
          state={draft.noiseCancelingState}
          min={0}
          max={3}
          step={0.1}
          disabled={disabled}
          onChange={(next) => onChange({ noiseCancelingState: next })}
        />
        <ToggleRow
          label="Auto Noise Gate"
          value={draft.automaticNoiseGateState?.enabled ?? false}
          disabled={disabled}
          onChange={(en) => onChange({ automaticNoiseGateState: { ...(draft.automaticNoiseGateState ?? { value: 0 }), enabled: en } })}
        />
        <ToggleRow
          label="Echo Canceling"
          value={draft.acousticEchoCancelingState ?? false}
          disabled={disabled}
          onChange={(v) => onChange({ acousticEchoCancelingState: v })}
          last
        />
      </Section>

      <EQEditor eq={draft.parametricEQ} disabled={disabled} onChange={(eq) => onChange({ parametricEQ: eq })} />
    </>
  )
}

// ─── PresetEditor ─────────────────────────────────────────────────────────────

interface PresetEditorProps {
  channel: SonarDeviceChannel
  configs: SonarConfig[]
  activePresetId: string | undefined
  onClose: () => void
  onPresetSelect: (configId: string) => void
  onUpsert: (config: SonarConfig) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (sourceId: string) => Promise<void>
  onReset: (id: string) => Promise<void>
  onToggleFavorite: (id: string, fav: boolean) => Promise<void>
}

export function PresetEditor({
  channel,
  configs,
  activePresetId,
  onClose,
  onPresetSelect,
  onUpsert,
  onDelete,
  onDuplicate,
  onReset,
  onToggleFavorite,
}: PresetEditorProps): JSX.Element {
  const mic = isMicChannel(channel)
  const channelConfigs = configs.filter((c) => c.virtualAudioDevice === channel)
  const resolvedActiveId = activePresetId ?? channelConfigs.find((c) => c.isSelected)?.id
  const activeConfig = channelConfigs.find((c) => c.id === resolvedActiveId) ?? channelConfigs[0]

  const [draft, setDraft] = useState<SonarConfig | null>(null)
  // True while composing a brand-new preset that isn't in `configs` yet — suppresses
  // the active-config sync so the new draft isn't overwritten.
  const [composing, setComposing] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const ddBtnRef = useRef<HTMLButtonElement>(null)
  const ddMenuRef = useRef<HTMLDivElement>(null)

  const activeId = activeConfig?.id
  const editable = !!draft && !draft.isPreset
  // Compare only the editable surface (name + data) so poll-driven timestamp/favourite
  // churn doesn't spuriously re-enable Save.
  const dirty = !!draft && (composing || !activeConfig ||
    draft.name !== activeConfig.name ||
    JSON.stringify(draft.data) !== JSON.stringify(activeConfig.data))

  // Mirror the active preset into the editable draft. Re-runs only when the active
  // preset id changes (selection) or we stop composing — never on background polls,
  // so in-progress edits survive the 1 s refresh cycle.
  useEffect(() => {
    if (composing) return
    setDraft(activeConfig ? clone(activeConfig) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, composing])

  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent): void {
      const t = e.target as Node
      if (!ddBtnRef.current?.contains(t) && !ddMenuRef.current?.contains(t)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [dropdownOpen])

  // Escape closes the dropdown first, then discards unsaved changes, then closes the
  // panel — never dismisses a panel with unsaved edits in a single keystroke.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      if (dropdownOpen) setDropdownOpen(false)
      else if (dirty) discardChanges()
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownOpen, dirty, onClose])

  function toggleDropdown(): void {
    if (!dropdownOpen && ddBtnRef.current) {
      const r = ddBtnRef.current.getBoundingClientRect()
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setDropdownOpen((o) => !o)
  }

  function startNew(): void {
    setDropdownOpen(false)
    setComposing(true)
    setDraft(buildNewConfig(channel))
  }

  function discardChanges(): void {
    if (composing) setComposing(false)          // sync effect resyncs to the active preset
    else if (activeConfig) setDraft(clone(activeConfig))
  }

  function selectPreset(id: string): void {
    setComposing(false)
    onPresetSelect(id)
    setDropdownOpen(false)
  }

  async function save(): Promise<void> {
    if (!draft || !editable || !dirty) return
    const wasComposing = composing
    const now = new Date().toISOString()
    const final: SonarConfig = {
      ...draft,
      isPreset: false,
      updatedAt: now,
      createdAt: wasComposing ? now : draft.createdAt,
    }
    await onUpsert(final)
    if (wasComposing) setComposing(false)  // snap back to the channel's active preset
    else setDraft(final)                   // keep editing the just-saved preset
  }

  const patchData = (patch: Partial<SonarConfigData>): void => {
    setDraft((d) => (d ? { ...d, data: { ...d.data, ...patch } } : d))
  }

  const channelLabel = CHANNEL_LABELS[channel] ?? channel

  return (
    <div className="sn-preset-editor" role="dialog" aria-label="Preset editor">
      {/* Header */}
      <div className="sn-pe-head">
        <span className="sn-pe-ic">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </span>
        <div className="sn-pe-title">
          <span className="sn-pe-title-name">{channelLabel}</span>
          <span className="sn-pe-title-sub mono">{draft?.name ?? activeConfig?.name ?? 'No presets'}</span>
        </div>
        <button
          className={`sn-pe-hbtn${activeConfig?.isFavorite ? ' fav-on' : ''}`}
          onClick={() => activeConfig && onToggleFavorite(activeConfig.id, !activeConfig.isFavorite)}
          disabled={!activeConfig}
          title={activeConfig?.isFavorite ? 'Unfavourite' : 'Favourite'}
          aria-label="Toggle favourite"
        >
          {activeConfig?.isFavorite ? '★' : '☆'}
        </button>
        <button className="sn-pe-hbtn" onClick={onClose} title="Close" aria-label="Close">
          ✕
        </button>
      </div>

      {/* Preset dropdown row */}
      <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <button
          ref={ddBtnRef}
          onClick={toggleDropdown}
          className="flex items-center justify-between w-full"
          style={{
            padding: '6px 10px', borderRadius: 5,
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)', fontSize: 12, cursor: 'pointer',
          }}
        >
          <span className="truncate">{activeConfig?.name ?? 'No presets'}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {dropdownOpen && dropdownPos && ReactDOM.createPortal(
        <div
          ref={ddMenuRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: '60vh',
            overflowY: 'auto',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            zIndex: 9999,
            boxShadow: 'var(--shadow-thumb, 0 4px 12px rgba(0,0,0,0.3))',
          }}
        >
          {channelConfigs.map((c) => {
            const selected = c.id === resolvedActiveId
            return (
              <div
                key={c.id}
                className="sn-preset-row flex items-center justify-between"
                style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}
              >
                <button
                  onClick={() => selectPreset(c.id)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
                >
                  {selected && <span style={{ color: 'var(--color-accent)' }}>✓</span>}
                  <span className="truncate" style={{ fontSize: 12, fontWeight: selected ? 600 : 400 }}>{c.name}</span>
                  {c.isFavorite && <span style={{ color: 'var(--color-warn, var(--color-accent))', fontSize: 11 }}>★</span>}
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <DropAction label="Dup" onClick={() => onDuplicate(c.id)} />
                  {!c.isPreset && <DropAction label="Reset" onClick={() => onReset(c.id)} />}
                  {!c.isPreset && <DropAction label="Del" danger onClick={() => { onDelete(c.id); setDropdownOpen(false) }} />}
                </div>
              </div>
            )
          })}
          <button
            onClick={startNew}
            className="w-full text-left"
            style={{ padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: 12, fontWeight: 600 }}
          >
            + New Preset
          </button>
        </div>,
        document.body,
      )}

      {/* Scrollable body — always the form; inputs disabled for non-editable presets */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 selectable">
        {draft ? (
          <>
            {!editable && (
              <div
                className="flex items-center justify-between gap-2 px-3 py-2 mb-3 text-xs rounded"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <span>Built-in preset — read-only.</span>
                <button
                  onClick={() => activeConfig && onDuplicate(activeConfig.id)}
                  style={{
                    padding: '3px 8px', borderRadius: 4, flexShrink: 0,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: 11,
                  }}
                >
                  Duplicate
                </button>
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-semibold tracking-wide uppercase block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Name
              </label>
              <input
                type="text"
                value={draft.name}
                disabled={!editable}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                style={{
                  width: '100%', fontSize: 13, padding: '6px 10px',
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 5, color: 'var(--color-text-primary)',
                  cursor: editable ? 'text' : 'not-allowed', opacity: editable ? 1 : 0.5,
                }}
              />
            </div>
            {mic
              ? <VoiceEditForm draft={draft.data} onChange={patchData} disabled={!editable} />
              : <OutputEditForm draft={draft.data} onChange={patchData} disabled={!editable} />}
          </>
        ) : (
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No preset selected.</div>
        )}
      </div>

      {/* Footer — only for editable presets */}
      {editable && (
        <div
          className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={() => void save()}
            disabled={!dirty}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 5,
              background: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-bg)', fontSize: 12, fontWeight: 600,
              cursor: dirty ? 'pointer' : 'not-allowed', opacity: dirty ? 1 : 0.45,
            }}
          >
            Save
          </button>
          {dirty && (
            <button
              onClick={discardChanges}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 5,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)', fontSize: 12, cursor: 'pointer',
              }}
            >
              {composing ? 'Cancel' : 'Revert'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DropAction({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="sn-preset-action"
      style={{
        padding: '2px 6px', borderRadius: 4, fontSize: 10,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: danger ? 'var(--color-danger, var(--color-text-secondary))' : 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
