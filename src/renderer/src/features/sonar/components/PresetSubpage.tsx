// PresetSubpage — inline replacement for the floating PresetEditor panel.
// Renders in the normal document flow below the channel mixer rail so the
// page scrolls around it rather than a fixed overlay blocking the mixer.

import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type {
  SonarConfig,
  SonarConfigData,
  SonarParametricEQ,
  SonarEQFilter,
  SonarDeviceChannel,
  SonarAudioSample,
} from '@shared/types'
import { SliderInput } from '../../../components/SliderInput'
import { EQCurveEditor, fmtHz, fmtGainDb } from './EQCurveEditor'

// ── Shared constants ───────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  master:      'Master',
  game:        'Game',
  chatRender:  'Chat Output',
  chatCapture: 'Mic Input',
  media:       'Media',
  aux:         'Aux',
}

type FilterKey = Exclude<keyof SonarParametricEQ, 'enabled'>
const FILTER_KEYS: FilterKey[] = [
  'filter1', 'filter2', 'filter3', 'filter4', 'filter5',
  'filter6', 'filter7', 'filter8', 'filter9', 'filter10',
]

const EQ_TYPES: SonarEQFilter['type'][] = ['peakingEQ', 'lowShelving', 'highShelving']
const EQ_TYPE_LABELS: Record<SonarEQFilter['type'], string> = {
  peakingEQ:    'Peak',
  lowShelving:  'Low Shelf',
  highShelving: 'High Shelf',
}

const OUTPUT_EQ_FREQS = [35, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 16000]
const MIC_EQ_FREQS    = [80, 200, 400, 800, 1600, 3200, 6400, 8000, 12000, 16000]

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
    frontLeft:  { position: 30,   gain: 0 },
    frontRight: { position: -30,  gain: 0 },
    center:     { position: 0,    gain: 0 },
    subWoofer:  { position: 0,    gain: 0 },
    rearLeft:   { position: 150,  gain: 0 },
    rearRight:  { position: -150, gain: 0 },
    sideLeft:   { position: 90,   gain: 0 },
    sideRight:  { position: -90,  gain: 0 },
  },
  reverbGainDB: -6,
  formFactor: 'headphones',
  globalEnableState: true,
}

const DEFAULT_MIC_DATA: SonarConfigData = {
  noiseReductionState:         { enabled: false, value: 0 },
  volumeStabilizerState:       { enabled: false, value: 0 },
  noiseGateState:              { enabled: false, value: -38.8 },
  automaticNoiseGateState:     { enabled: false, value: 0 },
  impactNoiseReductionState:   { enabled: false, value: 0 },
  noiseCancelingState:         { enabled: false, value: 0 },
  acousticEchoCancelingState:  false,
  parametricEQ:                makeMicEQ(),
  globalEnableState:           true,
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function isMicChannel(ch: string): boolean {
  return ch === 'chatCapture'
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

// ── Primitive UI helpers ───────────────────────────────────────────────────────

function Toggle({
  value, onChange, disabled = false,
}: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }): JSX.Element {
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

// Horizontal slider with label and formatted value
function SliderRow({
  label, value, min, max, step = 1, format, onChange, disabled = false, last = false,
}: {
  label: string; value: number; min: number; max: number; step?: number
  format?: (v: number) => string; onChange: (v: number) => void
  disabled?: boolean; last?: boolean
}): JSX.Element {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return (
    <div className="sn-sp-row" style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <span className="sn-sp-row-label">{label}</span>
      <div className="sn-sp-row-right">
        <SliderInput
          value={norm}
          disabled={disabled}
          onChange={(v) => {
            const raw     = min + v * (max - min)
            const snapped = Math.round(raw / step) * step
            onChange(Number(snapped.toFixed(4)))
          }}
        />
        <span className="sn-sp-row-val mono">
          {format ? format(value) : value}
        </span>
      </div>
    </div>
  )
}

// Row with toggle + label, optional slider when enabled
function ToggleSliderRow({
  label, state, min, max, step = 1, format, onChange, disabled = false, last = false,
}: {
  label: string; state: { enabled: boolean; value: number } | undefined
  min: number; max: number; step?: number; format?: (v: number) => string
  onChange: (next: { enabled: boolean; value: number }) => void
  disabled?: boolean; last?: boolean
}): JSX.Element {
  const s = state ?? { enabled: false, value: 0 }
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <div className="sn-sp-row" style={{ borderBottom: 'none' }}>
        <span className="sn-sp-row-label">{label}</span>
        <Toggle value={s.enabled} disabled={disabled} onChange={(en) => onChange({ ...s, enabled: en })} />
      </div>
      {s.enabled && (
        <div style={{ padding: '0 12px 10px' }}>
          <SliderRow
            label="" value={s.value} min={min} max={max} step={step}
            format={format} disabled={disabled} last
            onChange={(v) => onChange({ ...s, value: v })}
          />
        </div>
      )}
    </div>
  )
}

// Row with toggle + label only (no slider)
function ToggleRow({
  label, value, onChange, disabled = false, last = false,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean
}): JSX.Element {
  return (
    <div className="sn-sp-row" style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <span className="sn-sp-row-label">{label}</span>
      <Toggle value={value} disabled={disabled} onChange={onChange} />
    </div>
  )
}

// Section card wrapper
function Section({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }): JSX.Element {
  return (
    <div className="sn-sp-section">
      <div className="sn-sp-section-h">
        <span className="sn-sp-section-title">{title}</span>
        {right && <div>{right}</div>}
      </div>
      <div className="sn-sp-section-body">{children}</div>
    </div>
  )
}

// Compact number input
function NumberField({
  value, min, max, step = 1, onChange, width = 56, disabled = false,
}: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; width?: number; disabled?: boolean
}): JSX.Element {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step} disabled={disabled}
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

function SelectField<T extends string>({
  value, options, onChange, width = 'auto', disabled = false,
}: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
  width?: number | string; disabled?: boolean
}): JSX.Element {
  return (
    <select
      value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        width, fontSize: 11, padding: '2px 4px',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: 4, color: 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── EQ section ─────────────────────────────────────────────────────────────────

function EQSection({
  eq, onChange, disabled = false,
}: {
  eq: SonarParametricEQ | undefined
  onChange: (eq: SonarParametricEQ) => void
  disabled?: boolean
}): JSX.Element {
  const safe = eq ?? makeOutputEQ()
  const [showBands, setShowBands] = useState(false)

  const setFilter = (k: FilterKey, patch: Partial<SonarEQFilter>): void => {
    onChange({ ...safe, [k]: { ...safe[k], ...patch } })
  }

  return (
    <Section
      title="EQ"
      right={
        <Toggle
          value={safe.enabled} disabled={disabled}
          onChange={(en) => onChange({ ...safe, enabled: en })}
        />
      }
    >
      {/* Interactive curve */}
      <div style={{ padding: '0 0 8px' }}>
        <EQCurveEditor
          eq={safe}
          onChange={onChange}
          disabled={disabled || !safe.enabled}
        />
      </div>

      {/* Band detail toggle */}
      <button
        className="sn-sp-bands-toggle"
        onClick={() => setShowBands((v) => !v)}
        style={{ opacity: (!safe.enabled || disabled) ? 0.45 : 1 }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: showBands ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {showBands ? 'Hide bands' : 'Show bands'}
      </button>

      {/* Per-band filter table */}
      {showBands && (
        <div className="sn-sp-bands">
          {FILTER_KEYS.map((k, i) => {
            const flt = safe[k]
            return (
              <div key={k} className="sn-sp-band-row" style={{ borderBottom: i < FILTER_KEYS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <Toggle
                  value={flt.enabled} disabled={disabled || !safe.enabled}
                  onChange={(en) => setFilter(k, { enabled: en })}
                />
                <span className="mono sn-sp-band-label">{fmtHz(flt.frequency)}</span>
                <NumberField
                  value={flt.frequency} min={20} max={20000} step={1}
                  width={60} disabled={disabled || !safe.enabled || !flt.enabled}
                  onChange={(v) => setFilter(k, { frequency: v })}
                />
                <span className="sn-sp-band-hz">Hz</span>
                <SelectField
                  value={flt.type}
                  options={EQ_TYPES.map((t) => ({ value: t, label: EQ_TYPE_LABELS[t] }))}
                  width={86}
                  disabled={disabled || !safe.enabled || !flt.enabled}
                  onChange={(v) => setFilter(k, { type: v })}
                />
                <span
                  className="mono sn-sp-band-gain"
                  style={{ color: Math.abs(flt.gain) > 0.05 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
                >
                  {fmtGainDb(flt.gain)}
                </span>
                <NumberField
                  value={flt.qFactor} min={0.1} max={10} step={0.01}
                  width={44} disabled={disabled || !safe.enabled || !flt.enabled}
                  onChange={(v) => setFilter(k, { qFactor: v })}
                />
                <span className="sn-sp-band-qlabel">Q</span>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ── Test Sounds (sample preview) ───────────────────────────────────────────────

function SamplePreview({ channel }: { channel: SonarDeviceChannel }): JSX.Element | null {
  const [samples, setSamples] = useState<SonarAudioSample[]>([])

  useEffect(() => {
    let cancelled = false
    window.api.sonarGetAudioSamples(channel)
      .then((s) => { if (!cancelled) setSamples(s) })
      .catch(() => { if (!cancelled) setSamples([]) })
    return () => { cancelled = true }
  }, [channel])

  if (samples.length === 0) return null

  function sampleLabel(id: string): string {
    const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
  }

  async function play(id: string): Promise<void> {
    try {
      const updated = await window.api.sonarPlayAudioSample(channel, id)
      setSamples(updated)
    } catch {
      // best-effort
    }
  }

  return (
    <Section title="Test Sounds">
      <div className="sn-sp-samples">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => void play(s.id)}
            className="sn-sp-sample-btn"
            style={{
              background: s.isPlaying ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color:      s.isPlaying ? 'var(--color-bg)'     : 'var(--color-text-primary)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {s.isPlaying
                ? <rect x="6" y="5" width="12" height="14" rx="1" />
                : <polygon points="6 4 20 12 6 20 6 4" />}
            </svg>
            {sampleLabel(s.id)}
          </button>
        ))}
      </div>
    </Section>
  )
}

// ── Output-channel sections ─────────────────────────────────────────────────────

const SURROUND_CHANNELS: { key: keyof NonNullable<SonarConfigData['virtualSurroundChannels']>; label: string }[] = [
  { key: 'frontLeft',  label: 'Front L' },
  { key: 'frontRight', label: 'Front R' },
  { key: 'center',     label: 'Center'  },
  { key: 'subWoofer',  label: 'Sub'     },
  { key: 'rearLeft',   label: 'Rear L'  },
  { key: 'rearRight',  label: 'Rear R'  },
  { key: 'sideLeft',   label: 'Side L'  },
  { key: 'sideRight',  label: 'Side R'  },
]

function OutputEditForm({
  draft, onChange, disabled = false,
}: {
  draft: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled?: boolean
}): JSX.Element {
  const sv      = draft.smartVolume
  const surround = draft.virtualSurroundChannels

  return (
    <>
      {/* Tone */}
      <Section title="Tone">
        <ToggleSliderRow
          label="Bass Boost" state={draft.bassBoostState}
          min={0} max={12} disabled={disabled}
          onChange={(v) => onChange({ bassBoostState: v })}
        />
        <ToggleSliderRow
          label="Treble Boost" state={draft.trebleBoostState}
          min={0} max={12} disabled={disabled}
          onChange={(v) => onChange({ trebleBoostState: v })}
        />
        <ToggleSliderRow
          label="Voice Clarity" state={draft.voiceClarityState}
          min={0} max={12} disabled={disabled}
          onChange={(v) => onChange({ voiceClarityState: v })}
        />
        <SliderRow
          label="General Gain" value={draft.generalGain ?? 0}
          min={-12} max={12} format={fmtDb} disabled={disabled} last
          onChange={(v) => onChange({ generalGain: v })}
        />
      </Section>

      {/* Smart Volume */}
      <Section
        title="Smart Volume"
        right={
          <Toggle
            value={sv?.enabled ?? false} disabled={disabled}
            onChange={(en) => onChange({ smartVolume: { ...(sv ?? { volumeLevel: 0, loudness: 'balanced' }), enabled: en } })}
          />
        }
      >
        {sv?.enabled ? (
          <>
            <div className="sn-sp-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="sn-sp-row-label">Loudness</span>
              <SelectField
                value={sv.loudness as 'soft' | 'balanced' | 'loud'}
                options={[
                  { value: 'soft',     label: 'Soft'     },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'loud',     label: 'Loud'     },
                ]}
                width={100}
                disabled={disabled}
                onChange={(v) => onChange({ smartVolume: { ...sv, loudness: v } })}
              />
            </div>
            <SliderRow
              label="Volume Level" value={sv.volumeLevel}
              min={0} max={100} disabled={disabled} last
              onChange={(v) => onChange({ smartVolume: { ...sv, volumeLevel: v } })}
            />
          </>
        ) : (
          <div className="sn-sp-row" style={{ borderBottom: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Disabled</span>
          </div>
        )}
      </Section>

      {/* Spatial Audio */}
      <Section
        title="Spatial Audio"
        right={
          <Toggle
            value={draft.virtualSurroundState ?? false} disabled={disabled}
            onChange={(en) => onChange({ virtualSurroundState: en })}
          />
        }
      >
        <div className="sn-sp-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="sn-sp-row-label">Form Factor</span>
          <SelectField
            value={draft.formFactor ?? 'headphones'}
            options={[
              { value: 'headphones', label: 'Headphones' },
              { value: 'speakers',   label: 'Speakers'   },
            ]}
            width={110}
            disabled={disabled}
            onChange={(v) => onChange({ formFactor: v })}
          />
        </div>
        <SliderRow
          label="Reverb Gain" value={draft.reverbGainDB ?? -6}
          min={-40} max={0} format={fmtDb} disabled={disabled}
          last={!draft.virtualSurroundState || !surround}
          onChange={(v) => onChange({ reverbGainDB: v })}
        />
        {draft.virtualSurroundState && surround && (
          <div className="sn-sp-surround">
            <div className="sn-sp-surround-header mono">
              <span style={{ width: 56 }} />
              <span style={{ width: 62, textAlign: 'center' }}>Position</span>
              <span style={{ width: 56, textAlign: 'center' }}>Gain</span>
            </div>
            {SURROUND_CHANNELS.map(({ key, label }) => {
              const ch = surround[key]
              return (
                <div key={key} className="sn-sp-surround-row">
                  <span className="sn-sp-surround-label">{label}</span>
                  <NumberField
                    value={ch.position} min={-180} max={180} width={62} disabled={disabled}
                    onChange={(v) => onChange({ virtualSurroundChannels: { ...surround, [key]: { ...ch, position: v } } })}
                  />
                  <NumberField
                    value={ch.gain} min={-12} max={12} width={56} disabled={disabled}
                    onChange={(v) => onChange({ virtualSurroundChannels: { ...surround, [key]: { ...ch, gain: v } } })}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

// ── Mic channel sections ────────────────────────────────────────────────────────

function VoiceEditForm({
  draft, onChange, disabled = false,
}: {
  draft: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled?: boolean
}): JSX.Element {
  return (
    <Section title="Noise Processing">
      <ToggleSliderRow
        label="Noise Reduction" state={draft.noiseReductionState}
        min={0} max={3} step={0.1} disabled={disabled}
        onChange={(v) => onChange({ noiseReductionState: v })}
      />
      <ToggleSliderRow
        label="Noise Gate" state={draft.noiseGateState}
        min={-60} max={0} step={0.1} format={fmtDb} disabled={disabled}
        onChange={(v) => onChange({ noiseGateState: v })}
      />
      <ToggleSliderRow
        label="Volume Stabilizer" state={draft.volumeStabilizerState}
        min={0} max={3} step={0.1} disabled={disabled}
        onChange={(v) => onChange({ volumeStabilizerState: v })}
      />
      <ToggleSliderRow
        label="Impact Noise Reduction" state={draft.impactNoiseReductionState}
        min={0} max={3} step={0.1} disabled={disabled}
        onChange={(v) => onChange({ impactNoiseReductionState: v })}
      />
      <ToggleSliderRow
        label="Noise Canceling" state={draft.noiseCancelingState}
        min={0} max={3} step={0.1} disabled={disabled}
        onChange={(v) => onChange({ noiseCancelingState: v })}
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
        disabled={disabled} last
        onChange={(v) => onChange({ acousticEchoCancelingState: v })}
      />
    </Section>
  )
}

// ── PresetSubpage ─────────────────────────────────────────────────────────────

export interface PresetSubpageProps {
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

export function PresetSubpage({
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
}: PresetSubpageProps): JSX.Element {
  const mic = isMicChannel(channel)
  const channelConfigs  = configs.filter((c) => c.virtualAudioDevice === channel)
  const resolvedActiveId = activePresetId ?? channelConfigs.find((c) => c.isSelected)?.id
  const activeConfig     = channelConfigs.find((c) => c.id === resolvedActiveId) ?? channelConfigs[0]

  const [draft,       setDraft]       = useState<SonarConfig | null>(null)
  const [composing,   setComposing]   = useState(false)
  const [dropOpen,    setDropOpen]    = useState(false)
  const [dropPos,     setDropPos]     = useState<{ top: number; left: number; width: number } | null>(null)

  const ddBtnRef = useRef<HTMLButtonElement>(null)
  const ddMenuRef = useRef<HTMLDivElement>(null)

  const activeId = activeConfig?.id
  const editable = !!draft && !draft.isPreset
  const dirty    = !!draft && (composing || !activeConfig ||
    draft.name !== activeConfig.name ||
    JSON.stringify(draft.data) !== JSON.stringify(activeConfig.data))

  // Sync draft when active preset changes (but not during composing or drag)
  useEffect(() => {
    if (composing) return
    setDraft(activeConfig ? clone(activeConfig) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, composing])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    function onMouseDown(e: MouseEvent): void {
      const t = e.target as Node
      if (!ddBtnRef.current?.contains(t) && !ddMenuRef.current?.contains(t)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [dropOpen])

  // Escape: close dropdown → discard draft → close subpage
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      if (dropOpen) setDropOpen(false)
      else if (dirty) discardChanges()
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropOpen, dirty, onClose])

  function toggleDropdown(): void {
    if (!dropOpen && ddBtnRef.current) {
      const r = ddBtnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(220, r.width) })
    }
    setDropOpen((o) => !o)
  }

  function startNew(): void {
    setDropOpen(false)
    setComposing(true)
    setDraft(buildNewConfig(channel))
  }

  function discardChanges(): void {
    if (composing) setComposing(false)
    else if (activeConfig) setDraft(clone(activeConfig))
  }

  function selectPreset(id: string): void {
    setComposing(false)
    onPresetSelect(id)
    setDropOpen(false)
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
    if (wasComposing) setComposing(false)
    else setDraft(final)
  }

  function patchData(patch: Partial<SonarConfigData>): void {
    setDraft((d) => (d ? { ...d, data: { ...d.data, ...patch } } : d))
  }

  const channelLabel = CHANNEL_LABELS[channel] ?? channel

  return (
    <div className="sn-subpage">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="sn-sp-head">
        <span className="sn-sp-channel-label">{channelLabel}</span>

        {/* Preset selector button */}
        <button
          ref={ddBtnRef}
          onClick={toggleDropdown}
          className="sn-sp-preset-btn"
          style={{ borderColor: dropOpen ? 'var(--color-text-primary)' : undefined }}
        >
          <span className="sn-sp-preset-name">
            {composing ? 'New Preset' : activeConfig?.name ?? 'No presets'}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Favourite toggle */}
        <button
          className={`sn-sp-head-btn${activeConfig?.isFavorite ? ' fav-on' : ''}`}
          onClick={() => activeConfig && onToggleFavorite(activeConfig.id, !activeConfig.isFavorite)}
          disabled={!activeConfig}
          title={activeConfig?.isFavorite ? 'Unfavourite' : 'Favourite'}
        >
          {activeConfig?.isFavorite ? '★' : '☆'}
        </button>

        {/* Close */}
        <button className="sn-sp-head-btn" onClick={onClose} title="Close (Esc)" aria-label="Close preset editor">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* ── Preset dropdown (portal) ───────────────────────────────────────── */}
      {dropOpen && dropPos && ReactDOM.createPortal(
        <div
          ref={ddMenuRef}
          style={{
            position: 'fixed',
            top: dropPos.top, left: dropPos.left, width: dropPos.width,
            maxHeight: '55vh', overflowY: 'auto',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 8, zIndex: 9999,
            boxShadow: 'var(--shadow-panel)',
          }}
        >
          {channelConfigs.map((c) => {
            const sel = c.id === resolvedActiveId
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => selectPreset(c.id)}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {sel && <span style={{ color: 'var(--color-accent)', fontSize: 13 }}>✓</span>}
                  <span style={{ fontSize: 12, fontWeight: sel ? 600 : 400 }} className="truncate">{c.name}</span>
                  {c.isFavorite && <span style={{ color: 'var(--color-warn)', fontSize: 11 }}>★</span>}
                </button>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <DropAction label="Dup"   onClick={() => { onDuplicate(c.id); setDropOpen(false) }} />
                  {!c.isPreset && <DropAction label="Reset" onClick={() => onReset(c.id)} />}
                  {!c.isPreset && <DropAction label="Del"   danger onClick={() => { onDelete(c.id); setDropOpen(false) }} />}
                </div>
              </div>
            )
          })}
          <button
            onClick={startNew}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 10px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-accent)', fontSize: 12, fontWeight: 600,
            }}
          >
            + New Preset
          </button>
        </div>,
        document.body,
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {draft ? (
        <>
          {/* Action bar (name + save controls) — visible for editable presets */}
          {editable && (
            <div className="sn-sp-actionbar">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                placeholder="Preset name"
                className="sn-sp-name-input"
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {dirty && (
                  <button className="sn-sp-btn-ghost" onClick={discardChanges}>
                    {composing ? 'Cancel' : 'Revert'}
                  </button>
                )}
                <button
                  className="sn-sp-btn-save"
                  onClick={() => void save()}
                  disabled={!dirty}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Read-only notice for built-in presets */}
          {!editable && (
            <div className="sn-sp-readonly-notice">
              <span>Built-in preset — read only.</span>
              <button
                className="sn-sp-btn-ghost"
                onClick={() => activeConfig && onDuplicate(activeConfig.id)}
              >
                Duplicate
              </button>
            </div>
          )}

          {/* Scrollable sections */}
          <div className="sn-sp-body">
            <EQSection
              eq={draft.data.parametricEQ}
              onChange={(eq) => patchData({ parametricEQ: eq })}
              disabled={!editable}
            />
            <SamplePreview channel={channel} />
            {mic
              ? <VoiceEditForm   draft={draft.data} onChange={patchData} disabled={!editable} />
              : <OutputEditForm  draft={draft.data} onChange={patchData} disabled={!editable} />}
          </div>
        </>
      ) : (
        <div style={{ padding: '20px 16px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
          No presets for this channel.{' '}
          <button onClick={startNew} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Create one
          </button>
        </div>
      )}
    </div>
  )
}

function DropAction({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 6px', borderRadius: 4, fontSize: 10,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: danger ? 'var(--color-danger)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
