// PresetDetailPage — full-page channel preset editor.
// Faithful implementation of the Claude Design "ChannelPresetPopover" (.cpp):
// header (back · channel chip · preset dropdown · favorite · actions), then a
// two-column body — parametric EQ on the left, per-section controls on the right.
//
// Edit model: auto-apply. Every change patches the active config and is
// persisted (debounced) through onUpsert; factory presets are directly editable
// with "reset to factory". No Save/Revert button.

import '../detail-page.css'
import { useEffect, useRef, useState } from 'react'
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

function isMic(ch: string): boolean { return ch === 'chatCapture' || ch === 'chatRender' }
function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T }

function fmtDb(v: number): string {
  if (Math.abs(v) < 0.05) return '0 dB'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`
}

// ── Default configs (for "New preset") ──────────────────────────────────────────

function makeFilter(freq: number, type: SonarEQFilter['type']): SonarEQFilter {
  return { enabled: true, qFactor: 0.7071, frequency: freq, gain: 0, type }
}
function makeOutputEQ(): SonarParametricEQ {
  const freqs = [35, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 16000]
  const f = (i: number): SonarEQFilter => makeFilter(freqs[i], 'peakingEQ')
  return { enabled: true, filter1: f(0), filter2: f(1), filter3: f(2), filter4: f(3), filter5: f(4), filter6: f(5), filter7: f(6), filter8: f(7), filter9: f(8), filter10: f(9) }
}
function makeMicEQ(): SonarParametricEQ {
  const freqs = [80, 200, 400, 800, 1600, 3200, 6400, 8000, 12000, 16000]
  const types: SonarEQFilter['type'][] = ['lowShelving', 'peakingEQ', 'peakingEQ', 'peakingEQ', 'peakingEQ', 'peakingEQ', 'peakingEQ', 'peakingEQ', 'peakingEQ', 'highShelving']
  const f = (i: number): SonarEQFilter => makeFilter(freqs[i], types[i])
  return { enabled: true, filter1: f(0), filter2: f(1), filter3: f(2), filter4: f(3), filter5: f(4), filter6: f(5), filter7: f(6), filter8: f(7), filter9: f(8), filter10: f(9) }
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

// ── Inline icons (same chassis as the rest of the design) ──────────────────────

type IcoProps = { size?: number }

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }): JSX.Element {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (channel) {
    case 'game':
      return <svg {...p}><line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" /><line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" /><rect x="2" y="6" width="20" height="12" rx="4" /></svg>
    case 'chatRender':
      return <svg {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /></svg>
    case 'chatCapture':
      return <svg {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
    case 'media':
      return <svg {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    case 'aux':
      return <svg {...p}><path d="M12 2v6" /><path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8z" /></svg>
    default: // master
      return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
  }
}
function IcoSliders({ size = 13 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
}
function IcoChevron({ size = 11 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
}
function IcoStar({ size = 13, filled = false }: IcoProps & { filled?: boolean }): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></svg>
}
function IcoMore({ size = 14 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
}
function IcoPlus({ size = 13 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function IcoCopy({ size = 13 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
}
function IcoReset({ size = 13 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
}
function IcoTrash({ size = 13 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
}
function IcoCheck({ size = 13 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
}
function IcoBack({ size = 11 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
}
function IcoHeadset({ size = 12 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2" y="13" width="5" height="7" rx="1.5" /><rect x="17" y="13" width="5" height="7" rx="1.5" /></svg>
}
function IcoSpeaker({ size = 12 }: IcoProps): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><circle cx="12" cy="14" r="4" /><circle cx="12" cy="6" r="1" /></svg>
}

// ── Toggle switch (design .tg-switch) ──────────────────────────────────────────

function ToggleSwitch({ on, onChange, size = 'sm', disabled = false, label }: {
  on: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md'; disabled?: boolean; label?: string
}): JSX.Element {
  return (
    <button
      className={`tg-switch tg-${size}${on ? ' on' : ''}`}
      role="switch" aria-checked={on} aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!on) }}
    >
      <span className="tg-knob" />
    </button>
  )
}

// ── Param slider (design .ps) ──────────────────────────────────────────────────

function ParamSlider({ label, value, min, max, step = 1, format, onChange, disabled = false, log = false }: {
  label: string; value: number; min: number; max: number; step?: number
  format?: (v: number) => string; onChange: (v: number) => void; disabled?: boolean; log?: boolean
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const symmetric = min < 0 && max > 0 && Math.abs(min) === Math.abs(max)
  const zeroPct = symmetric ? 0.5 : 0

  const toPct = (v: number): number =>
    log ? Math.log(Math.max(min, v) / min) / Math.log(max / min) : (v - min) / (max - min)
  const fromPct = (p: number): number =>
    log ? min * Math.pow(max / min, p) : min + p * (max - min)

  const pct = Math.max(0, Math.min(1, toPct(value)))

  const setFromClientX = (clientX: number): void => {
    if (disabled || !trackRef.current) return
    const r = trackRef.current.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    const raw = Math.round(fromPct(p) / step) * step
    onChange(Math.max(min, Math.min(max, raw)))
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (disabled) return
    e.preventDefault()
    setFromClientX(e.clientX)
    const move = (ev: PointerEvent): void => setFromClientX(ev.clientX)
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const text = format
    ? format(value)
    : (value > 0 && symmetric ? '+' : '') + value

  return (
    <div className={`ps${disabled ? ' disabled' : ''}`}>
      <div className="ps-head">
        <span className="ps-label">{label}</span>
        <span className="ps-val mono">{text}</span>
      </div>
      <div
        ref={trackRef}
        className="ps-track"
        onPointerDown={onPointerDown}
        role="slider"
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(min, value - step)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(max, value + step)) }
        }}
      >
        {symmetric && <div className="ps-zero" style={{ left: '50%' }} />}
        <div
          className="ps-fill"
          style={{
            left: `${Math.min(zeroPct, pct) * 100}%`,
            right: `${(1 - Math.max(zeroPct, pct)) * 100}%`,
          }}
        />
        <div className="ps-thumb" style={{ left: `calc(${pct * 100}% - 7px)` }} />
      </div>
    </div>
  )
}

// ── EQ band card (design .peq-band) ────────────────────────────────────────────

function EQBandCard({ index, filter, isActive, disabled, onChange, onClick }: {
  index: number; filter: SonarEQFilter; isActive: boolean; disabled: boolean
  onChange: (patch: Partial<SonarEQFilter>) => void; onClick: () => void
}): JSX.Element {
  return (
    <div
      className={`peq-band${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
      onClick={onClick}
    >
      <div className="peq-band-h">
        <span className="peq-band-n mono">{index}</span>
        <select
          className="peq-band-type"
          value={filter.type}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ type: e.target.value as SonarEQFilter['type'] })}
          title={`Band ${index} · ${FILTER_TYPE_SHORT[filter.type]}`}
        >
          {FILTER_TYPES.map((t) => <option key={t} value={t}>{FILTER_TYPE_SHORT[t]}</option>)}
        </select>
        <ToggleSwitch on={filter.enabled} disabled={disabled} onChange={(v) => onChange({ enabled: v })} label="Band enabled" />
      </div>
      <ParamSlider
        label="Freq" value={filter.frequency} min={20} max={20000} step={1} log
        format={(v) => `${fmtHz(v)} Hz`}
        onChange={(v) => onChange({ frequency: Math.round(v) })}
        disabled={disabled || !filter.enabled}
      />
      <ParamSlider
        label="Gain" value={filter.gain} min={-12} max={12} step={0.1}
        format={(v) => `${fmtGainDb(v)} dB`}
        onChange={(v) => onChange({ gain: Math.round(v * 10) / 10 })}
        disabled={disabled || !filter.enabled}
      />
      <ParamSlider
        label="Q" value={filter.qFactor} min={0.1} max={10} step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange({ qFactor: Math.round(v * 10) / 10 })}
        disabled={disabled || !filter.enabled}
      />
    </div>
  )
}

// ── Section header ──────────────────────────────────────────────────────────────

function SectionHead({ label, sub, toggle, toggleValue, onToggle, disabled }: {
  label: string; sub?: string
  toggle?: boolean; toggleValue?: boolean; onToggle?: (v: boolean) => void; disabled?: boolean
}): JSX.Element {
  return (
    <div className="cpp-sec-h">
      <div className="cpp-sec-h-l">
        {toggle && onToggle && (
          <ToggleSwitch on={toggleValue ?? false} onChange={onToggle} disabled={disabled} label={label} />
        )}
        <span className="ds-label">{label}</span>
      </div>
      {sub && <span className="ds-sub mono">{sub}</span>}
    </div>
  )
}

// ── Test sounds ─────────────────────────────────────────────────────────────────

const SAMPLE_ICONS: Record<string, string> = {
  bass: '🎵', pinkNoise: '〰', footsteps: '👣', dialogueClip: '💬', musicExcerpt: '🎶',
  communication: '🗣', communicationNoise: '📢',
}
const SAMPLE_LABELS: Record<string, string> = {
  communication: 'Play communication',
  communicationNoise: 'Play communication + noise',
}
function sampleLabel(id: string): string {
  return SAMPLE_LABELS[id] ?? id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase())
}

function MicTestSounds(): JSX.Element {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlayingBack, setIsPlayingBack] = useState(false)

  async function toggleRecord(): Promise<void> {
    try {
      if (isRecording) {
        await window.api.sonarMicStopRecord()
        setIsRecording(false)
      } else {
        await window.api.sonarMicStartRecord()
        setIsRecording(true)
      }
    } catch { /* ignore */ }
  }

  async function togglePlayback(): Promise<void> {
    const next = !isPlayingBack
    try {
      const samples = await window.api.sonarMicSetPlayback(next)
      const rec = samples.find((s) => s.id === 'record')
      setIsPlayingBack(rec?.isPlaying ?? next)
    } catch { /* ignore */ }
  }

  return (
    <section className="cpp-sec">
      <SectionHead label="Test sounds" sub="routed to Mic" />
      <div className="ts-row">
        <button className={`ts-pill${isRecording ? ' on' : ''}`} onClick={() => void toggleRecord()}>
          <span className="ts-pill-ic">⏺</span>
          <span className="ts-pill-name">Record</span>
          {isRecording && <span className="ts-bars" aria-hidden="true"><span /><span /><span /><span /></span>}
        </button>
        <button className={`ts-pill${isPlayingBack ? ' on' : ''}`} onClick={() => void togglePlayback()}>
          <span className="ts-pill-ic">▶</span>
          <span className="ts-pill-name">Playback</span>
          {isPlayingBack && <span className="ts-bars" aria-hidden="true"><span /><span /><span /><span /></span>}
        </button>
      </div>
    </section>
  )
}

function TestSounds({ channel }: { channel: SonarDeviceChannel }): JSX.Element | null {
  const [samples, setSamples] = useState<SonarAudioSample[]>([])
  useEffect(() => {
    let cancelled = false
    window.api.sonarGetAudioSamples(channel)
      .then((s) => { if (!cancelled) setSamples(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [channel])

  if (samples.length === 0) return null

  async function play(id: string): Promise<void> {
    try { const u = await window.api.sonarPlayAudioSample(channel, id); setSamples(u) } catch { /* ignore */ }
  }

  return (
    <section className="cpp-sec">
      <SectionHead label="Test sounds" sub={`routed to ${CHANNEL_LABELS[channel] ?? channel}`} />
      <div className="ts-row">
        {samples.map((s) => (
          <button
            key={s.id}
            className={`ts-pill${s.isPlaying ? ' on' : ''}`}
            onClick={() => void play(s.id)}
          >
            <span className="ts-pill-ic">{SAMPLE_ICONS[s.id] ?? '▶'}</span>
            <span className="ts-pill-name">{sampleLabel(s.id)}</span>
            {s.isPlaying && (
              <span className="ts-bars" aria-hidden="true"><span /><span /><span /><span /></span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Header: preset dropdown ─────────────────────────────────────────────────────

function PresetDropdown({ configs, activeId, onPick }: {
  configs: SonarConfig[]; activeId: string | undefined; onPick: (id: string) => void
}): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const active = configs.find((c) => c.id === activeId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const sorted = [...configs].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  if (!active) return null

  return (
    <div className="pp-pdd" ref={wrapRef}>
      <button className={`pp-pdd-btn${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)} title="Switch preset">
        <span className="pp-pdd-ic"><IcoSliders size={13} /></span>
        <span className="pp-pdd-text">
          <span className="pp-pdd-name">{active.name}</span>
          <span className="pp-pdd-sub mono">{active.isPreset ? 'factory' : 'user'}</span>
        </span>
        {active.isFavorite && <span className="pp-pdd-star"><IcoStar size={11} filled /></span>}
        <span className="pp-pdd-chev"><IcoChevron size={11} /></span>
      </button>
      {open && (
        <div className="pp-pdd-menu">
          <div className="dd-menu-h mono">Preset for this channel</div>
          {sorted.map((c) => {
            const sel = c.id === activeId
            return (
              <button
                key={c.id}
                className={`dd-opt${sel ? ' sel' : ''}`}
                onClick={(e) => { e.stopPropagation(); onPick(c.id); setOpen(false) }}
              >
                <span className="dd-opt-ic"><IcoSliders size={12} /></span>
                <span className="dd-opt-text">
                  <span className="dd-opt-name">{c.name}</span>
                  <span className="dd-opt-sub mono">{c.isPreset ? 'factory' : 'user'}</span>
                </span>
                {c.isFavorite && <span className="dd-opt-star"><IcoStar size={11} filled /></span>}
                {sel && <span className="dd-opt-check"><IcoCheck size={13} /></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Header: actions menu ────────────────────────────────────────────────────────

function ActionsMenu({ isFactory, onNew, onDuplicate, onRename, onReset, onDelete }: {
  isFactory: boolean
  onNew: () => void; onDuplicate: () => void; onRename: () => void
  onReset: () => void; onDelete: () => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const run = (fn: () => void) => () => { fn(); setOpen(false) }

  return (
    <div className="pp-act" ref={wrapRef}>
      <button className={`pp-act-btn${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Preset actions" title="Preset actions">
        <IcoMore size={14} />
      </button>
      {open && (
        <div className="pp-act-menu">
          <button className="ctx-item" onClick={run(onNew)}><IcoPlus size={13} /><span>New preset…</span></button>
          <button className="ctx-item" onClick={run(onDuplicate)}><IcoCopy size={13} /><span>Duplicate</span></button>
          <button className="ctx-item" onClick={run(onRename)}><IcoSliders size={13} /><span>Rename</span></button>
          <div className="ctx-sep" />
          <button className="ctx-item" onClick={run(onReset)} disabled={!isFactory}>
            <IcoReset size={13} /><span>Reset to factory</span>
            {!isFactory && <span className="ctx-kbd mono">user</span>}
          </button>
          <button className="ctx-item danger" onClick={run(onDelete)} disabled={isFactory}>
            <IcoTrash size={13} /><span>Delete preset</span>
            {isFactory && <span className="ctx-kbd mono">factory</span>}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Settings panels ─────────────────────────────────────────────────────────────

function TonePanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const bs = data.bassBoostState ?? { enabled: false, value: 0 }
  const ts = data.trebleBoostState ?? { enabled: false, value: 0 }
  const vs = data.voiceClarityState ?? { enabled: false, value: 0 }
  const sub = [
    bs.value ? `bass ${fmtGainDb(bs.value)}` : '',
    vs.value ? `voice ${fmtGainDb(vs.value)}` : '',
    ts.value ? `treble ${fmtGainDb(ts.value)}` : '',
  ].filter(Boolean).join(' · ') || 'bass · voice · treble'

  return (
    <section className="cpp-sec">
      <SectionHead label="Tone" sub={sub} />
      <div className="cpp-three">
        <ParamSlider label="Bass" value={bs.value} min={0} max={12} step={0.5}
          format={(v) => `${fmtGainDb(v)} dB`} disabled={disabled}
          onChange={(v) => onChange({ bassBoostState: { enabled: v > 0, value: v } })} />
        <ParamSlider label="Voice" value={vs.value} min={0} max={12} step={0.5}
          format={(v) => `${fmtGainDb(v)} dB`} disabled={disabled}
          onChange={(v) => onChange({ voiceClarityState: { enabled: v > 0, value: v } })} />
        <ParamSlider label="Treble" value={ts.value} min={0} max={12} step={0.5}
          format={(v) => `${fmtGainDb(v)} dB`} disabled={disabled}
          onChange={(v) => onChange({ trebleBoostState: { enabled: v > 0, value: v } })} />
      </div>
    </section>
  )
}

function SpatialPanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const on = data.virtualSurroundState ?? false
  const reverb = data.reverbGainDB ?? -6
  const formFactor = data.formFactor ?? 'headphones'
  const sub = on ? (formFactor === 'speakers' ? 'crossfeed · room sim' : 'HRTF · 3-D stage') : 'disabled'
  const off = disabled || !on

  return (
    <section className={`cpp-sec toggleable ${on ? 'on' : 'off'}`}>
      <SectionHead label="Spatial audio" sub={sub} toggle toggleValue={on} disabled={disabled}
        onToggle={(v) => onChange({ virtualSurroundState: v })} />
      <div className="cpp-spatial">
        <div className="cpp-seg">
          <button className={`cpp-seg-btn${formFactor === 'headphones' ? ' on' : ''}`} disabled={off}
            onClick={() => onChange({ formFactor: 'headphones' })}><IcoHeadset size={12} /> Headphones</button>
          <button className={`cpp-seg-btn${formFactor === 'speakers' ? ' on' : ''}`} disabled={off}
            onClick={() => onChange({ formFactor: 'speakers' })}><IcoSpeaker size={12} /> Speakers</button>
        </div>
        <div className="cpp-spatial-sliders">
          <ParamSlider label="Reverb" value={reverb} min={-40} max={0} step={1}
            format={fmtDb} disabled={off}
            onChange={(v) => onChange({ reverbGainDB: v })} />
        </div>
      </div>
    </section>
  )
}

function VolumeBoostPanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const gain = data.generalGain ?? 0
  const on = gain !== 0
  const lastRef = useRef(gain !== 0 ? gain : 3)
  if (gain !== 0) lastRef.current = gain
  const sub = on ? `make-up · ${fmtGainDb(gain)} dB` : 'disabled'

  return (
    <section className={`cpp-sec toggleable ${on ? 'on' : 'off'}`}>
      <SectionHead label="Volume boost" sub={sub} toggle toggleValue={on} disabled={disabled}
        onToggle={(v) => onChange({ generalGain: v ? lastRef.current : 0 })} />
      <ParamSlider label="Gain" value={gain} min={-12} max={12} step={0.5}
        format={fmtDb} disabled={disabled || !on}
        onChange={(v) => onChange({ generalGain: v })} />
    </section>
  )
}

function SmartVolumePanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const sv = data.smartVolume ?? { enabled: false, volumeLevel: 0, loudness: 'balanced' }
  const sub = sv.enabled ? `target ${sv.volumeLevel}%` : 'disabled'
  const off = disabled || !sv.enabled

  return (
    <section className={`cpp-sec toggleable ${sv.enabled ? 'on' : 'off'}`}>
      <SectionHead label="Smart volume" sub={sub} toggle toggleValue={sv.enabled} disabled={disabled}
        onToggle={(v) => onChange({ smartVolume: { ...sv, enabled: v } })} />
      <div className="cpp-spatial">
        <div className="cpp-seg">
          {(['soft', 'balanced', 'loud'] as const).map((l) => (
            <button key={l} className={`cpp-seg-btn${sv.loudness === l ? ' on' : ''}`} disabled={off}
              onClick={() => onChange({ smartVolume: { ...sv, loudness: l } })}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
        <div className="cpp-spatial-sliders">
          <ParamSlider label="Target level" value={sv.volumeLevel} min={0} max={100} step={1}
            format={(v) => `${v} %`} disabled={off}
            onChange={(v) => onChange({ smartVolume: { ...sv, volumeLevel: v } })} />
        </div>
      </div>
    </section>
  )
}

function NoisePanel({ data, onChange, disabled }: {
  data: SonarConfigData; onChange: (p: Partial<SonarConfigData>) => void; disabled: boolean
}): JSX.Element {
  const nr = data.noiseReductionState ?? { enabled: false, value: 0 }
  const ng = data.noiseGateState ?? { enabled: false, value: -38.8 }
  const vs = data.volumeStabilizerState ?? { enabled: false, value: 0 }
  const inc = data.impactNoiseReductionState ?? { enabled: false, value: 0 }
  const nc = data.noiseCancelingState ?? { enabled: false, value: 0 }

  return (
    <section className="cpp-sec">
      <SectionHead label="Noise processing" sub="reduction · gate · stabilizer" />
      <ParamSlider label="Reduction" value={nr.value} min={0} max={3} step={0.1}
        format={(v) => v.toFixed(1)} disabled={disabled}
        onChange={(v) => onChange({ noiseReductionState: { enabled: v > 0, value: v } })} />
      <ParamSlider label="Noise gate" value={ng.value} min={-60} max={0} step={0.5}
        format={fmtDb} disabled={disabled}
        onChange={(v) => onChange({ noiseGateState: { enabled: v < -0.1, value: v } })} />
      <ParamSlider label="Stabilizer" value={vs.value} min={0} max={3} step={0.1}
        format={(v) => v.toFixed(1)} disabled={disabled}
        onChange={(v) => onChange({ volumeStabilizerState: { enabled: v > 0, value: v } })} />
      <ParamSlider label="Impact NR" value={inc.value} min={0} max={3} step={0.1}
        format={(v) => v.toFixed(1)} disabled={disabled}
        onChange={(v) => onChange({ impactNoiseReductionState: { enabled: v > 0, value: v } })} />
      <ParamSlider label="AI cancel" value={nc.value} min={0} max={3} step={0.1}
        format={(v) => v.toFixed(1)} disabled={disabled}
        onChange={(v) => onChange({ noiseCancelingState: { enabled: v > 0, value: v } })} />
    </section>
  )
}

// ── PresetDetailPage ─────────────────────────────────────────────────────────────

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
  channel, configs, activePresetId,
  onBack, onPresetSelect, onUpsert, onDelete, onDuplicate, onReset, onToggleFavorite,
}: PresetDetailPageProps): JSX.Element {
  const mic = isMic(channel)
  const channelLabel = CHANNEL_LABELS[channel] ?? channel
  const channelConfigs = configs.filter((c) => c.virtualAudioDevice === channel)
  const activeConfig =
    channelConfigs.find((c) => c.id === activePresetId)
    ?? channelConfigs.find((c) => c.isSelected)
    ?? channelConfigs[0]
  const activeId = activeConfig?.id

  // ── Auto-apply working copy ──────────────────────────────────────────────────
  const [working, setWorking] = useState<SonarConfig | null>(activeConfig ? clone(activeConfig) : null)
  const syncedId = useRef(activeId)
  const pendingRef = useRef<SonarConfig | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Resync only when the selected preset changes (so in-flight edits aren't clobbered).
  useEffect(() => {
    if (activeId !== syncedId.current) {
      syncedId.current = activeId
      setWorking(activeConfig ? clone(activeConfig) : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Flush any pending persist on unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (pendingRef.current) void onUpsert(pendingRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit(next: SonarConfig): void {
    const stamped: SonarConfig = { ...next, updatedAt: new Date().toISOString() }
    setWorking(stamped)
    pendingRef.current = stamped
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const cfg = pendingRef.current
      pendingRef.current = null
      timerRef.current = null
      if (cfg) void onUpsert(cfg)
    }, 200)
  }

  const disabled = !working
  const eq = working?.data.parametricEQ
  const [activeKey, setActiveKey] = useState<FilterKey | null>(null)

  function patchData(patch: Partial<SonarConfigData>): void {
    if (!working) return
    commit({ ...working, data: { ...working.data, ...patch } })
  }
  function patchEQ(next: SonarParametricEQ): void { patchData({ parametricEQ: next }) }
  function patchFilter(key: FilterKey, patch: Partial<SonarEQFilter>): void {
    if (!eq) return
    patchEQ({ ...eq, [key]: { ...eq[key], ...patch } })
  }
  function setName(name: string): void {
    if (!working) return
    commit({ ...working, name })
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  async function startNew(): Promise<void> {
    const id = crypto.randomUUID()
    const cfg: SonarConfig = {
      id, name: 'New preset', virtualAudioDevice: channel,
      data: clone(mic ? DEFAULT_MIC : DEFAULT_OUTPUT),
      isPreset: false, isFavorite: false, favoritePosition: -1, image: '8.svg',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      schemaVersion: mic ? 6 : 5, releaseVersion: null,
    }
    await onUpsert(cfg)
    onPresetSelect(id)
    setTimeout(() => nameRef.current?.select(), 80)
  }

  // Escape closes the page (menus handle their own Escape first via stopPropagation).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && e.target === document.body) onBack()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])

  const isFactory = !!activeConfig?.isPreset

  return (
    <div className="cpp" role="region" aria-label={`${channelLabel} preset editor`}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="cpp-head">
        <button className="cpp-back" onClick={onBack} aria-label="Back to Sonar">
          <IcoBack size={11} /> Sonar
        </button>
        <span className="cpp-nav-sep">/</span>
        <div className="cpp-head-ch">
          <span className="cpp-head-ic"><ChannelIcon channel={channel} size={14} /></span>
          <span className="cpp-head-label">{channelLabel}</span>
        </div>

        <PresetDropdown configs={channelConfigs} activeId={activeId} onPick={onPresetSelect} />

        <button
          className={`pp-fav${activeConfig?.isFavorite ? ' on' : ''}`}
          onClick={() => activeConfig && void onToggleFavorite(activeConfig.id, !activeConfig.isFavorite)}
          disabled={!activeConfig}
          aria-label="Toggle favorite"
          title={activeConfig?.isFavorite ? 'Remove favorite' : 'Mark as favorite'}
        >
          <IcoStar size={13} filled={!!activeConfig?.isFavorite} />
        </button>

        <ActionsMenu
          isFactory={isFactory}
          onNew={() => void startNew()}
          onDuplicate={() => activeConfig && void onDuplicate(activeConfig.id)}
          onRename={() => nameRef.current?.select()}
          onReset={() => activeConfig && void onReset(activeConfig.id)}
          onDelete={() => { if (activeConfig) { void onDelete(activeConfig.id); onBack() } }}
        />
      </div>

      {/* ── Body — two columns ───────────────────────────────────────────────── */}
      <div className="cpp-body">

        {/* LEFT — name + parametric EQ */}
        <div className="cpp-col-eq">
          <div className="cpp-name-row">
            <input
              ref={nameRef}
              className="cpp-name-input"
              value={working?.name ?? ''}
              placeholder="Preset name"
              spellCheck={false}
              maxLength={40}
              disabled={disabled}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="cpp-name-tag mono">{isFactory ? 'factory · editable' : 'user'}</span>
          </div>

          <section className={`cpp-sec toggleable ${eq?.enabled ? 'on' : 'off'}`}>
            <SectionHead
              label="Parametric EQ" sub="±12 dB · drag node"
              toggle toggleValue={eq?.enabled ?? false} disabled={disabled}
              onToggle={(v) => eq && patchEQ({ ...eq, enabled: v })}
            />
            <div className="peq-frame">
              {eq && (
                <EQCurveEditor
                  eq={eq}
                  onChange={patchEQ}
                  disabled={disabled || !eq.enabled}
                  selectedKey={activeKey}
                  onNodeClick={setActiveKey}
                  curveColor="var(--color-text-primary)"
                  bare
                />
              )}
            </div>
            <div className="peq-bands">
              {eq && FILTER_KEYS.map((k, i) => {
                const filter = eq[k]
                if (!filter) return null
                return (
                  <EQBandCard
                    key={k}
                    index={i + 1}
                    filter={filter}
                    isActive={activeKey === k}
                    disabled={disabled || !eq.enabled}
                    onChange={(patch) => patchFilter(k, patch)}
                    onClick={() => setActiveKey((prev) => (prev === k ? null : k))}
                  />
                )
              })}
            </div>
          </section>
        </div>

        {/* RIGHT — per-section controls */}
        <div className="cpp-col-settings">
          {channel === 'chatCapture' ? <MicTestSounds /> : <TestSounds channel={channel} />}
          {!mic ? (
            <>
              <TonePanel data={working?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={disabled} />
              <SpatialPanel data={working?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={disabled} />
              <VolumeBoostPanel data={working?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={disabled} />
              <SmartVolumePanel data={working?.data ?? DEFAULT_OUTPUT} onChange={patchData} disabled={disabled} />
            </>
          ) : (
            <NoisePanel data={working?.data ?? DEFAULT_MIC} onChange={patchData} disabled={disabled} />
          )}
        </div>
      </div>
    </div>
  )
}
