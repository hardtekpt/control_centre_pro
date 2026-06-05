// PresetDetailPage — full-page preset editor replacing the sonar mixer view.
// Renders as the entire content area (two-column: EQ+bands left, controls right).
// Design: reference GG Sonar page from Claude Design handoff.

import '../detail-page.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type {
  SonarConfig,
  SonarConfigData,
  SonarEQFilter,
  SonarParametricEQ,
  SonarDeviceChannel,
  SonarAudioSample,
} from '@shared/types'
import { EQCurveEditor, fmtHz, fmtGainDb } from './EQCurveEditor'

// ── Constants ─────────────────────────────────────────────────────────────────

type FilterKey = Exclude<keyof SonarParametricEQ, 'enabled'>
const FILTER_KEYS: FilterKey[] = [
  'filter1', 'filter2', 'filter3', 'filter4', 'filter5',
  'filter6', 'filter7', 'filter8', 'filter9', 'filter10',
]

const CHANNEL_LABELS: Record<string, string> = {
  master: 'Master', game: 'Game', chatRender: 'Chat Out',
  chatCapture: 'Mic', media: 'Media', aux: 'Aux',
}

const FILTER_TYPE_SHORT: Record<SonarEQFilter['type'], string> = {
  peakingEQ: 'Peak', lowShelving: 'Low Shelf', highShelving: 'Hi Shelf',
}

const FILTER_TYPES: SonarEQFilter['type'][] = ['peakingEQ', 'lowShelving', 'highShelving']

function freqToNorm(f: number): number {
  const MIN = 20, MAX = 20000
  return Math.log(Math.max(MIN, f) / MIN) / Math.log(MAX / MIN)
}

function isMic(ch: string): boolean { return ch === 'chatCapture' }

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T }

function fmtDb(v: number): string {
  if (Math.abs(v) < 0.05) return '0 dB'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`
}

// ── Default configs ───────────────────────────────────────────────────────────

function makeFilter(freq: number, type: SonarEQFilter['type']): SonarEQFilter {
  return { enabled: true, qFactor: 0.7071, frequency: freq, gain: 0, type }
}

function makeOutputEQ(): SonarParametricEQ {
  const freqs = [35, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 16000]
  const f = (i: number) => makeFilter(freqs[i], 'peakingEQ')
  return { enabled: true, filter1:f(0), filter2:f(1), filter3:f(2), filter4:f(3), filter5:f(4), filter6:f(5), filter7:f(6), filter8:f(7), filter9:f(8), filter10:f(9) }
}

function makeMicEQ(): SonarParametricEQ {
  const freqs = [80, 200, 400, 800, 1600, 3200, 6400, 8000, 12000, 16000]
  const types: SonarEQFilter['type'][] = ['lowShelving','peakingEQ','peakingEQ','peakingEQ','peakingEQ','peakingEQ','peakingEQ','peakingEQ','peakingEQ','highShelving']
  const f = (i: number) => makeFilter(freqs[i], types[i])
  return { enabled: true, filter1:f(0), filter2:f(1), filter3:f(2), filter4:f(3), filter5:f(4), filter6:f(5), filter7:f(6), filter8:f(7), filter9:f(8), filter10:f(9) }
}

const DEFAULT_OUTPUT: SonarConfigData = {
  bassBoostState: { enabled: false, value: 0 },
  trebleBoostState: { enabled: false, value: 0 },
  voiceClarityState: { enabled: false, value: 0 },
  smartVolume: { enabled: false, volumeLevel: 0, loudness: 'balanced' },
  generalGain: 0,
  parametricEQ: makeOutputEQ(),
  virtualSurroundState: false,
  reverbGainDB: -6,
  formFactor: 'headphones',
  globalEnableState: true,
}

const DEFAULT_MIC: SonarConfigData = {
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

// ── Primitive UI ──────────────────────────────────────────────────────────────

// Round toggle with green-on / gray-off
function Toggle({ value, onChange, disabled = false, size = 28 }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean; size?: number
}): JSX.Element {
  const h = Math.round(size * 0.57)
  return (
    <button
      role="switch" aria-checked={value}
      onClick={() => { if (!disabled) onChange(!value) }}
      disabled={disabled}
      style={{
        width: size, height: h, borderRadius: h,
        background: value ? 'var(--color-accent-positive)' : 'var(--color-surface-raised)',
        border: `1px solid ${value ? 'var(--color-accent-positive)' : 'var(--color-border)'}`,
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0, opacity: disabled ? 0.4 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '50%', transform: 'translateY(-50%)',
        left: value ? `calc(100% - ${h - 4}px - 1px)` : 2,
        width: h - 4, height: h - 4, borderRadius: '50%',
        background: value ? '#fff' : 'var(--color-text-secondary)',
        transition: 'left 0.14s',
        display: 'block',
      }} />
    </button>
  )
}

// Green dot indicator toggle (for section headers)
function DotToggle({ value, onChange, disabled = false }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean
}): JSX.Element {
  return (
    <button
      role="switch" aria-checked={value}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!value) }}
      disabled={disabled}
      style={{
        width: 10, height: 10, borderRadius: '50%',
        background: value ? 'var(--color-accent-positive)' : 'var(--color-border-strong)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0, padding: 0,
        transition: 'background 0.15s',
      }}
    />
  )
}

// Circular-handle slider — draggable, filled track
function RangeSlider({ value, min, max, step = 1, onChange, disabled = false, fillColor }: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; disabled?: boolean; fillColor?: string
}): JSX.Element {
  const railRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [drag, setDrag] = useState<number | null>(null)
  const displayValue = drag !== null ? drag : value
  const pct = Math.max(0, Math.min(1, (displayValue - min) / (max - min)))

  function fromClient(clientX: number): number {
    const r = railRef.current!.getBoundingClientRect()
    const raw = min + ((clientX - r.left) / r.width) * (max - min)
    return Math.max(min, Math.min(max, Math.round(raw / step) * step))
  }

  function handleMouseDown(e: React.MouseEvent): void {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    const v = fromClient(e.clientX)
    setDrag(v)
    const onMove = (ev: MouseEvent): void => { const nv = fromClient(ev.clientX); setDrag(nv) }
    const onUp = (ev: MouseEvent): void => {
      dragging.current = false
      const nv = fromClient(ev.clientX)
      setDrag(null)
      onChange(nv)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    onChange(v)
  }

  const fill = fillColor ?? 'var(--color-accent)'

  return (
    <div
      ref={railRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative', width: '100%', height: 20,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {/* Track */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0,
        height: 3, transform: 'translateY(-50%)',
        background: 'var(--color-surface-raised)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        {/* Fill */}
        <div style={{ width: `${pct * 100}%`, height: '100%', background: fill, borderRadius: 2 }} />
      </div>
      {/* Thumb */}
      <div
        style={{
          position: 'absolute', top: '50%', left: `${pct * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--color-text-primary)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          transition: dragging.current ? 'none' : 'left 0.1s',
          flexShrink: 0,
        }}
      />
    </div>
  )
}

// Section header row (label left, info/toggle right)
function SectionHeader({ label, sub, toggle, onToggle, toggleValue, disabled }: {
  label: string; sub?: string; toggle?: boolean
  onToggle?: (v: boolean) => void; toggleValue?: boolean; disabled?: boolean
}): JSX.Element {
  return (
    <div className="sn-dp-section-h">
      <span className="sn-dp-section-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {toggle && onToggle !== undefined && (
          <DotToggle value={toggleValue ?? false} onChange={onToggle} disabled={disabled} />
        )}
        {sub && <span className="sn-dp-section-sub">{sub}</span>}
      </div>
    </div>
  )
}

// Control row: label left, value + slider right
function ControlRow({ label, value, min, max, step = 1, format, onChange, disabled = false, fillColor, last = false }: {
  label: string; value: number; min: number; max: number; step?: number
  format?: (v: number) => string; onChange: (v: number) => void
  disabled?: boolean; fillColor?: string; last?: boolean
}): JSX.Element {
  return (
    <div className="sn-dp-control-row" style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <span className="sn-dp-control-label">{label}</span>
      <div className="sn-dp-control-right">
        <RangeSlider value={value} min={min} max={max} step={step}
          onChange={onChange} disabled={disabled} fillColor={fillColor} />
        <span className="sn-dp-control-val mono">
          {format ? format(value) : value}
        </span>
      </div>
    </div>
  )
}

// ── Filter band card ──────────────────────────────────────────────────────────

function FilterBandCard({
  index, filter, isActive, disabled, onChange, onClick,
}: {
  index: number; filter: SonarEQFilter; isActive: boolean; disabled: boolean
  onChange: (patch: Partial<SonarEQFilter>) => void; onClick: () => void
}): JSX.Element {
  const freqNorm = freqToNorm(filter.frequency)
  const gainNorm = (filter.gain + 12) / 24
  const gainPos  = filter.gain > 0.05
  const gainNeg  = filter.gain < -0.05

  return (
    <div
      className={`sn-dp-band-card${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
      onClick={onClick}
    >
      {/* Number + type */}
      <div className="sn-dp-band-head">
        <span className="sn-dp-band-num">{index}</span>
        <span className="sn-dp-band-type">{FILTER_TYPE_SHORT[filter.type]}</span>
      </div>

      {/* FREQ */}
      <div className="sn-dp-band-field">
        <span className="sn-dp-band-fieldlabel">FREQ</span>
        <span className="sn-dp-band-fieldval">{fmtHz(filter.frequency)}</span>
      </div>
      <div className="sn-dp-band-track">
        <div className="sn-dp-band-fill" style={{ width: `${freqNorm * 100}%` }} />
      </div>

      {/* GAIN */}
      <div className="sn-dp-band-field">
        <span className="sn-dp-band-fieldlabel">GAIN</span>
        <span
          className="sn-dp-band-fieldval"
          style={{
            color: gainPos ? 'var(--color-accent-positive)'
              : gainNeg ? 'var(--color-warn)'
              : 'var(--color-text-secondary)',
          }}
        >
          {fmtGainDb(filter.gain)}
        </span>
      </div>
      {/* Gain fill — bi-directional from centre */}
      <div className="sn-dp-band-track">
        <div
          className="sn-dp-band-fill"
          style={{
            position: 'absolute',
            left: gainPos ? '50%' : `${gainNorm * 100}%`,
            width: `${Math.abs(filter.gain) / 24 * 100}%`,
            background: gainPos ? 'var(--color-accent-positive)' : gainNeg ? 'var(--color-warn)' : 'var(--color-border-strong)',
          }}
        />
      </div>

      {/* Q */}
      <div className="sn-dp-band-field" style={{ borderBottom: 'none' }}>
        <span className="sn-dp-band-fieldlabel">Q</span>
        <span className="sn-dp-band-fieldval">{filter.qFactor.toFixed(1)}</span>
      </div>

      {/* Enable toggle */}
      <div className="sn-dp-band-footer">
        <Toggle
          value={filter.enabled} disabled={disabled} size={26}
          onChange={(v) => { onChange({ enabled: v }); }}
        />
        {/* Type selector */}
        <select
          value={filter.type}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ type: e.target.value as SonarEQFilter['type'] })}
          className="sn-dp-band-typesel"
        >
          {FILTER_TYPES.map((t) => (
            <option key={t} value={t}>{FILTER_TYPE_SHORT[t]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Section panels ────────────────────────────────────────────────────────────

function SamplePreview({ channel }: { channel: SonarDeviceChannel }): JSX.Element | null {
  const [samples, setSamples] = useState<SonarAudioSample[]>([])
  useEffect(() => {
    let cancelled = false
    window.api.sonarGetAudioSamples(channel)
      .then((s) => { if (!cancelled) setSamples(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [channel])

  if (samples.length === 0) return null

  const icons: Record<string, string> = {
    bass: '🎵', pinkNoise: '〰', footsteps: '👣', dialogueClip: '💬', musicExcerpt: '🎶',
  }

  function label(id: string): string {
    return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase())
  }

  async function play(id: string): Promise<void> {
    try { const u = await window.api.sonarPlayAudioSample(channel, id); setSamples(u) } catch {}
  }

  const routedLabel = CHANNEL_LABELS[channel] ?? channel

  return (
    <div className="sn-dp-panel">
      <SectionHeader label="TEST SOUNDS" sub={`routed to ${routedLabel}`} />
      <div className="sn-dp-samples">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => void play(s.id)}
            className={`sn-dp-sample-btn${s.isPlaying ? ' playing' : ''}`}
          >
            <span style={{ fontSize: 12 }}>{icons[s.id] ?? '▶'}</span>
            {label(s.id)}
          </button>
        ))}
      </div>
    </div>
  )
}

function TonePanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const bs = data.bassBoostState ?? { enabled: false, value: 0 }
  const ts = data.trebleBoostState ?? { enabled: false, value: 0 }
  const vs = data.voiceClarityState ?? { enabled: false, value: 0 }
  const generalGain = data.generalGain ?? 0

  // Helpers that set enabled=true when value is non-zero
  function setBass(v: number): void {
    onChange({ bassBoostState: { enabled: v > 0, value: v } })
  }
  function setTreble(v: number): void {
    onChange({ trebleBoostState: { enabled: v > 0, value: v } })
  }
  function setVoice(v: number): void {
    onChange({ voiceClarityState: { enabled: v > 0, value: v } })
  }

  const bsSub = [
    bs.value ? `bass ${fmtGainDb(bs.value)}` : '',
    vs.value ? `voice ${fmtGainDb(vs.value)}` : '',
    ts.value ? `treble ${fmtGainDb(ts.value)}` : '',
  ].filter(Boolean).join(' · ') || 'flat'

  return (
    <div className="sn-dp-panel">
      <SectionHeader label="TONE" sub={bsSub} />
      <ControlRow label="BASS" value={bs.value} min={0} max={12} step={0.5}
        format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
        onChange={setBass} disabled={disabled}
        fillColor="var(--color-accent-positive)" />
      <ControlRow label="VOICE" value={vs.value} min={0} max={12} step={0.5}
        format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
        onChange={setVoice} disabled={disabled}
        fillColor="var(--color-accent-positive)" />
      <ControlRow label="TREBLE" value={ts.value} min={0} max={12} step={0.5}
        format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
        onChange={setTreble} disabled={disabled}
        fillColor="var(--color-accent-positive)" last />
    </div>
  )
}

function SpatialAudioPanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const on       = data.virtualSurroundState ?? false
  const reverb   = data.reverbGainDB ?? -6
  const formFactor = data.formFactor ?? 'headphones'
  const sub = on ? `${formFactor} · ${reverb.toFixed(0)} dB reverb` : 'off'

  return (
    <div className="sn-dp-panel">
      <SectionHeader
        label="SPATIAL AUDIO" sub={sub}
        toggle toggleValue={on}
        onToggle={(v) => onChange({ virtualSurroundState: v })}
        disabled={disabled}
      />
      {on && (
        <>
          {/* Form factor */}
          <div className="sn-dp-control-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="sn-dp-control-label">Form Factor</span>
            <select
              className="sn-dp-select"
              value={formFactor}
              disabled={disabled}
              onChange={(e) => onChange({ formFactor: e.target.value })}
            >
              <option value="headphones">Headphones</option>
              <option value="speakers">Speakers</option>
            </select>
          </div>
          <ControlRow
            label="REVERB" value={reverb} min={-40} max={0} step={1}
            format={fmtDb} onChange={(v) => onChange({ reverbGainDB: v })}
            disabled={disabled} last
          />
        </>
      )}
    </div>
  )
}

function VolumeBoostPanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const gain = data.generalGain ?? 0
  // Treat general gain as a "volume boost" section with dot toggle
  const on = gain !== 0
  const sub = gain !== 0 ? `make-up · ${fmtGainDb(gain)}` : 'off'

  return (
    <div className="sn-dp-panel">
      <SectionHeader label="VOLUME BOOST" sub={sub} />
      <ControlRow
        label="GAIN" value={gain} min={-12} max={12} step={0.5}
        format={fmtDb}
        onChange={(v) => onChange({ generalGain: v })}
        disabled={disabled} last
        fillColor={gain >= 0 ? 'var(--color-accent-positive)' : 'var(--color-warn)'}
      />
    </div>
  )
}

function SmartVolumePanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const sv = data.smartVolume ?? { enabled: false, volumeLevel: 0, loudness: 'balanced' }
  const sub = sv.enabled ? `target ${sv.volumeLevel}%` : 'off'

  return (
    <div className="sn-dp-panel">
      <SectionHeader
        label="SMART VOLUME" sub={sub}
        toggle toggleValue={sv.enabled}
        onToggle={(v) => onChange({ smartVolume: { ...sv, enabled: v } })}
        disabled={disabled}
      />
      {sv.enabled && (
        <>
          <div className="sn-dp-control-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="sn-dp-control-label">Loudness</span>
            <select
              className="sn-dp-select"
              value={sv.loudness}
              disabled={disabled}
              onChange={(e) => onChange({ smartVolume: { ...sv, loudness: e.target.value } })}
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced</option>
              <option value="loud">Loud</option>
            </select>
          </div>
          <ControlRow
            label="TARGET LEVEL" value={sv.volumeLevel} min={0} max={100} step={1}
            format={(v) => `${v} %`}
            onChange={(v) => onChange({ smartVolume: { ...sv, volumeLevel: v } })}
            disabled={disabled} last
            fillColor="var(--color-accent-positive)"
          />
        </>
      )}
    </div>
  )
}

function NoisePanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const nr  = data.noiseReductionState         ?? { enabled: false, value: 0 }
  const ng  = data.noiseGateState              ?? { enabled: false, value: -38.8 }
  const vs  = data.volumeStabilizerState       ?? { enabled: false, value: 0 }
  const inc = data.impactNoiseReductionState   ?? { enabled: false, value: 0 }
  const nc  = data.noiseCancelingState         ?? { enabled: false, value: 0 }
  const aec = data.acousticEchoCancelingState  ?? false
  const ang = data.automaticNoiseGateState     ?? { enabled: false, value: 0 }

  return (
    <div className="sn-dp-panel">
      <SectionHeader label="NOISE PROCESSING" />
      <ControlRow label="REDUCTION"  value={nr.value}  min={0} max={3}   step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange({ noiseReductionState: { enabled: v > 0, value: v } })}
        disabled={disabled} />
      <ControlRow label="NOISE GATE" value={ng.value}  min={-60} max={0} step={0.5}
        format={fmtDb}
        onChange={(v) => onChange({ noiseGateState: { enabled: v < -0.1, value: v } })}
        disabled={disabled} />
      <ControlRow label="STABILIZER" value={vs.value}  min={0} max={3}   step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange({ volumeStabilizerState: { enabled: v > 0, value: v } })}
        disabled={disabled} />
      <ControlRow label="IMPACT NR"  value={inc.value} min={0} max={3}   step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange({ impactNoiseReductionState: { enabled: v > 0, value: v } })}
        disabled={disabled} />
      <ControlRow label="AI CANCEL"  value={nc.value}  min={0} max={3}   step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange({ noiseCancelingState: { enabled: v > 0, value: v } })}
        disabled={disabled} last />
    </div>
  )
}

// ── Preset dropdown ────────────────────────────────────────────────────────────

function DropItem({ label, children }: { label: string; children?: React.ReactNode }): JSX.Element {
  return <div className="sn-dp-dropdown-item">{label}{children}</div>
}

// ── PresetDetailPage ──────────────────────────────────────────────────────────

export interface PresetDetailPageProps {
  channel: SonarDeviceChannel
  configs: SonarConfig[]
  activePresetId: string | undefined
  onBack: () => void
  onPresetSelect: (configId: string) => void
  onUpsert: (config: SonarConfig) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (sourceId: string) => Promise<void>
  onReset: (id: string) => Promise<void>
  onToggleFavorite: (id: string, fav: boolean) => Promise<void>
}

export function PresetDetailPage({
  channel,
  configs,
  activePresetId,
  onBack,
  onPresetSelect,
  onUpsert,
  onDelete,
  onDuplicate,
  onReset,
  onToggleFavorite,
}: PresetDetailPageProps): JSX.Element {
  const mic             = isMic(channel)
  const channelConfigs  = configs.filter((c) => c.virtualAudioDevice === channel)
  const activeConfig    = channelConfigs.find((c) => c.id === activePresetId)
    ?? channelConfigs.find((c) => c.isSelected)
    ?? channelConfigs[0]

  const [draft,      setDraft]      = useState<SonarConfig | null>(null)
  const [composing,  setComposing]  = useState(false)
  const [activeKey,  setActiveKey]  = useState<FilterKey | null>(null)
  const [dropOpen,   setDropOpen]   = useState(false)
  const [dropPos,    setDropPos]    = useState<{ top: number; left: number; width: number } | null>(null)
  const [optOpen,    setOptOpen]    = useState(false)
  const [optPos,     setOptPos]     = useState<{ top: number; right: number } | null>(null)

  const ddBtnRef  = useRef<HTMLButtonElement>(null)
  const ddMenuRef = useRef<HTMLDivElement>(null)
  const optBtnRef = useRef<HTMLButtonElement>(null)
  const optMenuRef = useRef<HTMLDivElement>(null)

  const activeId   = activeConfig?.id
  const editable   = !!draft && !draft.isPreset
  const dirty      = !!draft && (composing || !activeConfig ||
    draft.name !== activeConfig.name ||
    JSON.stringify(draft.data) !== JSON.stringify(activeConfig.data))

  useEffect(() => {
    if (composing) return
    setDraft(activeConfig ? clone(activeConfig) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, composing])

  // Close menus on outside click
  useEffect(() => {
    if (!dropOpen && !optOpen) return
    function cb(e: MouseEvent): void {
      const t = e.target as Node
      if (dropOpen && !ddBtnRef.current?.contains(t) && !ddMenuRef.current?.contains(t)) setDropOpen(false)
      if (optOpen && !optBtnRef.current?.contains(t) && !optMenuRef.current?.contains(t)) setOptOpen(false)
    }
    document.addEventListener('mousedown', cb)
    return () => document.removeEventListener('mousedown', cb)
  }, [dropOpen, optOpen])

  // Escape key handling
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      if (dropOpen) { setDropOpen(false); return }
      if (optOpen)  { setOptOpen(false);  return }
      if (dirty)    { discardChanges(); return }
      onBack()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropOpen, optOpen, dirty, onBack])

  function toggleDropdown(): void {
    if (!dropOpen && ddBtnRef.current) {
      const r = ddBtnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(200, r.width) })
    }
    setDropOpen((o) => !o)
  }

  function toggleOptions(): void {
    if (!optOpen && optBtnRef.current) {
      const r = optBtnRef.current.getBoundingClientRect()
      setOptPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOptOpen((o) => !o)
  }

  function startNew(): void {
    setDropOpen(false); setOptOpen(false); setComposing(true)
    setDraft({ id: crypto.randomUUID(), name: 'New Preset', virtualAudioDevice: channel,
      data: clone(mic ? DEFAULT_MIC : DEFAULT_OUTPUT), isPreset: false, isFavorite: false,
      favoritePosition: -1, image: '8.svg', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), schemaVersion: mic ? 6 : 5, releaseVersion: null,
    })
  }

  function discardChanges(): void {
    if (composing) setComposing(false)
    else if (activeConfig) setDraft(clone(activeConfig))
  }

  function selectPreset(id: string): void {
    setComposing(false); onPresetSelect(id); setDropOpen(false)
  }

  async function save(): Promise<void> {
    if (!draft || !editable || !dirty) return
    const wasComposing = composing
    const now = new Date().toISOString()
    const final: SonarConfig = { ...draft, isPreset: false, updatedAt: now,
      createdAt: wasComposing ? now : draft.createdAt }
    await onUpsert(final)
    if (wasComposing) setComposing(false); else setDraft(final)
  }

  function patchData(patch: Partial<SonarConfigData>): void {
    setDraft((d) => (d ? { ...d, data: { ...d.data, ...patch } } : d))
  }

  function patchEQ(eq: SonarParametricEQ): void { patchData({ parametricEQ: eq }) }

  function patchFilter(key: FilterKey, patch: Partial<SonarEQFilter>): void {
    const eq = draft?.data.parametricEQ
    if (!eq) return
    patchEQ({ ...eq, [key]: { ...eq[key], ...patch } })
  }

  const channelLabel = CHANNEL_LABELS[channel] ?? channel
  const eq           = draft?.data.parametricEQ
  const presetMeta   = activeConfig?.isPreset ? 'factory' : 'custom'

  return (
    <div className="sn-dp">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sn-dp-topbar">
        {/* Breadcrumb */}
        <div className="sn-dp-crumbs">
          <button className="sn-dp-back-btn" onClick={onBack} title="Back to Sonar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Sonar
          </button>
          <span className="sn-dp-crumb-sep">/</span>
          <span className="sn-dp-crumb-page">{channelLabel}</span>
        </div>

        {/* Preset selector dropdown */}
        <button ref={ddBtnRef} className="sn-dp-preset-tab" onClick={toggleDropdown}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {composing ? 'New Preset' : activeConfig?.name ?? 'No presets'}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div style={{ flex: 1 }} />

        {/* Favourite */}
        <button
          className={`sn-dp-icon-btn${activeConfig?.isFavorite ? ' fav-on' : ''}`}
          onClick={() => activeConfig && onToggleFavorite(activeConfig.id, !activeConfig.isFavorite)}
          disabled={!activeConfig}
          title="Favourite"
        >
          {activeConfig?.isFavorite ? '★' : '☆'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Options */}
        <button ref={optBtnRef} className="sn-dp-icon-btn" onClick={toggleOptions} title="Options">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* ── Name bar ────────────────────────────────────────────────────────── */}
      <div className="sn-dp-namebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          {editable ? (
            <input
              className="sn-dp-name-input"
              value={draft.name}
              onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
              placeholder="Preset name"
            />
          ) : (
            <span className="sn-dp-name-display">
              {composing ? 'New Preset' : activeConfig?.name ?? '—'}
            </span>
          )}
          <span className="sn-dp-name-meta">
            {composing ? `new · ${channelLabel.toLowerCase()}` : `${presetMeta} · ${channelLabel.toLowerCase()}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!editable && activeConfig && (
            <span className="sn-dp-readonly-badge">READ-ONLY</span>
          )}
          {dirty && (
            <button className="sn-dp-btn-ghost" onClick={discardChanges}>
              {composing ? 'Cancel' : 'Revert'}
            </button>
          )}
          {editable && (
            <button className="sn-dp-btn-save" onClick={() => void save()} disabled={!dirty}>
              Save
            </button>
          )}
          {!editable && activeConfig && (
            <button className="sn-dp-btn-ghost" onClick={() => void onDuplicate(activeConfig.id)}>
              Duplicate & Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column body ──────────────────────────────────────────────────── */}
      <div className="sn-dp-body">

        {/* LEFT — EQ + band cards */}
        <div className="sn-dp-left">
          {/* EQ header */}
          <div className="sn-dp-eq-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sn-dp-eq-title">PARAMETRIC EQ</span>
              {eq && (
                <Toggle
                  value={eq.enabled} size={28}
                  onChange={(v) => patchEQ({ ...eq, enabled: v })}
                  disabled={!editable}
                />
              )}
            </div>
            <span className="sn-dp-eq-hint">±12 dB · drag node</span>
          </div>

          {/* EQ curve */}
          <div className="sn-dp-eq-curve">
            {eq && (
              <EQCurveEditor
                eq={eq}
                onChange={patchEQ}
                disabled={!editable || !eq.enabled}
                selectedKey={activeKey}
                onNodeClick={setActiveKey}
              />
            )}
          </div>

          {/* Band cards */}
          <div className="sn-dp-bands-row">
            {eq && FILTER_KEYS.map((k, i) => (
              <FilterBandCard
                key={k}
                index={i + 1}
                filter={eq[k]}
                isActive={activeKey === k}
                disabled={!editable || !eq.enabled}
                onChange={(patch) => patchFilter(k, patch)}
                onClick={() => setActiveKey((prev) => prev === k ? null : k)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT — controls sidebar */}
        <div className="sn-dp-right">
          <SamplePreview channel={channel} />

          {!mic && (
            <>
              <TonePanel        data={draft?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={!editable} />
              <SpatialAudioPanel data={draft?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={!editable} />
              <VolumeBoostPanel  data={draft?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={!editable} />
              <SmartVolumePanel  data={draft?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={!editable} />
            </>
          )}

          {mic && (
            <NoisePanel data={draft?.data ?? DEFAULT_MIC} onChange={patchData} disabled={!editable} />
          )}
        </div>
      </div>

      {/* ── Preset dropdown (portal) ─────────────────────────────────────────── */}
      {dropOpen && dropPos && ReactDOM.createPortal(
        <div ref={ddMenuRef} className="sn-dp-dropdown" style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}>
          {channelConfigs.map((c) => {
            const sel = c.id === activeId
            return (
              <div key={c.id} className="sn-dp-dropdown-row">
                <button className="sn-dp-dropdown-item-btn" onClick={() => selectPreset(c.id)}>
                  {sel && <span style={{ color: 'var(--color-accent-positive)', marginRight: 4 }}>✓</span>}
                  <span style={{ fontWeight: sel ? 600 : 400 }}>{c.name}</span>
                  {c.isFavorite && <span style={{ color: 'var(--color-warn)', marginLeft: 4 }}>★</span>}
                </button>
                <div style={{ display: 'flex', gap: 3 }}>
                  <button className="sn-dp-dropdown-action" onClick={() => { void onDuplicate(c.id); setDropOpen(false) }}>Dup</button>
                  {!c.isPreset && <button className="sn-dp-dropdown-action" onClick={() => void onReset(c.id)}>Reset</button>}
                  {!c.isPreset && <button className="sn-dp-dropdown-action danger" onClick={() => { void onDelete(c.id); setDropOpen(false) }}>Del</button>}
                </div>
              </div>
            )
          })}
          <button className="sn-dp-dropdown-new" onClick={startNew}>+ New Preset</button>
        </div>,
        document.body,
      )}

      {/* ── Options menu (portal) ───────────────────────────────────────────── */}
      {optOpen && optPos && ReactDOM.createPortal(
        <div ref={optMenuRef} className="sn-dp-dropdown" style={{ top: optPos.top, right: optPos.right, width: 180, left: 'auto' }}>
          {activeConfig && !activeConfig.isPreset && (
            <button className="sn-dp-dropdown-item-btn" onClick={() => { void onReset(activeConfig.id); setOptOpen(false) }}>
              Reset to default
            </button>
          )}
          {activeConfig && (
            <button className="sn-dp-dropdown-item-btn" onClick={() => { void onDuplicate(activeConfig.id); setOptOpen(false) }}>
              Duplicate
            </button>
          )}
          {activeConfig && !activeConfig.isPreset && (
            <button className="sn-dp-dropdown-item-btn danger" onClick={() => { void onDelete(activeConfig.id); setOptOpen(false); onBack() }}>
              Delete preset
            </button>
          )}
          <button className="sn-dp-dropdown-item-btn" onClick={startNew}>New preset</button>
        </div>,
        document.body,
      )}
    </div>
  )
}
