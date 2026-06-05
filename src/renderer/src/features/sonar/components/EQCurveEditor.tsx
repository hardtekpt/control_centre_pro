import { useCallback, useMemo, useRef, useState } from 'react'
import type { SonarEQFilter, SonarParametricEQ } from '@shared/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const VW = 500
const VH = 160
const MIN_FREQ = 20
const MAX_FREQ = 20000
const MAX_GAIN = 12
const SAMPLE_RATE = 48000
const N_CURVE = 380

type FilterKey = Exclude<keyof SonarParametricEQ, 'enabled'>
const FILTER_KEYS: FilterKey[] = [
  'filter1', 'filter2', 'filter3', 'filter4', 'filter5',
  'filter6', 'filter7', 'filter8', 'filter9', 'filter10',
]

// ── Coordinate helpers ─────────────────────────────────────────────────────────

function freqToX(freq: number): number {
  return VW * Math.log(Math.max(MIN_FREQ, freq) / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)
}

function xToFreq(x: number): number {
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, Math.max(0, Math.min(1, x / VW)))
}

function gainToY(gain: number): number {
  // Clamp display range slightly beyond ±MAX_GAIN so endpoints don't clip to edge
  const clamped = Math.max(-(MAX_GAIN + 1.5), Math.min(MAX_GAIN + 1.5, gain))
  return VH * (0.5 - clamped / ((MAX_GAIN + 1.5) * 2))
}

function yToGain(y: number): number {
  return (0.5 - y / VH) * (MAX_GAIN + 1.5) * 2
}

// ── Biquad filter response (RBJ cookbook formulas) ────────────────────────────

function filterDb(freq: number, f: SonarEQFilter): number {
  if (!f.enabled || Math.abs(f.gain) < 0.001) return 0

  const f0    = Math.max(1, f.frequency)
  const Q     = Math.max(0.1, f.qFactor)
  const w0    = 2 * Math.PI * f0 / SAMPLE_RATE
  const A     = Math.pow(10, f.gain / 40)
  const cosW0 = Math.cos(w0)
  const sinW0 = Math.sin(w0)
  const alpha = sinW0 / (2 * Q)

  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number

  if (f.type === 'lowShelving') {
    const sqA = Math.sqrt(A)
    const t   = 2 * sqA * alpha
    b0 = A * ((A + 1) - (A - 1) * cosW0 + t)
    b1 = 2 * A * ((A - 1) - (A + 1) * cosW0)
    b2 = A * ((A + 1) - (A - 1) * cosW0 - t)
    a0 = (A + 1) + (A - 1) * cosW0 + t
    a1 = -2 * ((A - 1) + (A + 1) * cosW0)
    a2 = (A + 1) + (A - 1) * cosW0 - t
  } else if (f.type === 'highShelving') {
    const sqA = Math.sqrt(A)
    const t   = 2 * sqA * alpha
    b0 = A * ((A + 1) + (A - 1) * cosW0 + t)
    b1 = -2 * A * ((A - 1) + (A + 1) * cosW0)
    b2 = A * ((A + 1) + (A - 1) * cosW0 - t)
    a0 = (A + 1) - (A - 1) * cosW0 + t
    a1 = 2 * ((A - 1) - (A + 1) * cosW0)
    a2 = (A + 1) - (A - 1) * cosW0 - t
  } else {
    // peakingEQ (default)
    b0 = 1 + alpha * A
    b1 = -2 * cosW0
    b2 = 1 - alpha * A
    a0 = 1 + alpha / A
    a1 = -2 * cosW0
    a2 = 1 - alpha / A
  }

  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0

  const w   = 2 * Math.PI * freq / SAMPLE_RATE
  const cW  = Math.cos(w); const sW  = Math.sin(w)
  const c2W = Math.cos(2 * w); const s2W = Math.sin(2 * w)

  const nR = b0 + b1 * cW + b2 * c2W
  const nI = -(b1 * sW + b2 * s2W)
  const dR = 1 + a1 * cW + a2 * c2W
  const dI = -(a1 * sW + a2 * s2W)

  const mag2 = (nR * nR + nI * nI) / (dR * dR + dI * dI)
  return mag2 > 0 ? 10 * Math.log10(mag2) : -120
}

function combinedDb(freqs: number[], eq: SonarParametricEQ): number[] {
  return freqs.map((f) => FILTER_KEYS.reduce((s, k) => s + filterDb(f, eq[k]), 0))
}

// ── Formatting ─────────────────────────────────────────────────────────────────

export function fmtHz(f: number): string {
  if (f >= 10000) return `${Math.round(f / 1000)}k`
  if (f >= 1000)  return `${(f / 1000).toFixed(1)}k`
  return `${Math.round(f)}`
}

export function fmtGainDb(g: number): string {
  if (Math.abs(g) < 0.05) return '±0'
  return `${g > 0 ? '+' : ''}${g.toFixed(1)}`
}

// ── Static layout data ─────────────────────────────────────────────────────────

const GRID_FREQS  = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const LABEL_FREQS = [100, 1000, 10000]
const GRID_GAINS  = [-12, -6, 6, 12]

// ── Component ─────────────────────────────────────────────────────────────────

interface EQCurveEditorProps {
  eq: SonarParametricEQ
  onChange: (eq: SonarParametricEQ) => void
  disabled?: boolean
  /** Externally controlled active (selected) key — if undefined, component self-manages */
  selectedKey?: FilterKey | null
  onNodeClick?: (key: FilterKey) => void
}

export function EQCurveEditor({
  eq, onChange, disabled = false, selectedKey, onNodeClick,
}: EQCurveEditorProps): JSX.Element {
  const svgRef              = useRef<SVGSVGElement>(null)
  const [internalActive, setInternalActive] = useState<FilterKey | null>(null)
  const [hover,  setHover]  = useState<FilterKey | null>(null)
  // Use external selectedKey if provided, otherwise use internalActive
  const active = selectedKey !== undefined ? selectedKey : internalActive

  // Sample frequencies (log-spaced across the SVG width)
  const sampleFreqs = useMemo<number[]>(() => {
    const out: number[] = []
    for (let i = 0; i < N_CURVE; i++) out.push(xToFreq((i / (N_CURVE - 1)) * VW))
    return out
  }, [])

  // Combined biquad response across all enabled filters
  const responseDb = useMemo(() => combinedDb(sampleFreqs, eq), [sampleFreqs, eq])

  // SVG path strings for the curve and its fill area
  const { curvePath, areaPath } = useMemo(() => {
    const pts = responseDb.map((db, i) => {
      const x = (i / (N_CURVE - 1)) * VW
      const y = gainToY(db)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    const line = pts.join(' ')
    const midY = gainToY(0).toFixed(1)
    return { curvePath: line, areaPath: `${line} L${VW} ${midY} L0 ${midY} Z` }
  }, [responseDb])

  // Map pointer client coords → SVG coordinate space
  const toSvgCoords = useCallback((cx: number, cy: number): { sx: number; sy: number } => {
    const r = svgRef.current!.getBoundingClientRect()
    return { sx: (cx - r.left) / r.width * VW, sy: (cy - r.top) / r.height * VH }
  }, [])

  const handleNodePointerDown = useCallback((e: React.PointerEvent, key: FilterKey) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    if (selectedKey === undefined) setInternalActive(key)
    onNodeClick?.(key)

    const onMove = (ev: PointerEvent): void => {
      const { sx, sy } = toSvgCoords(ev.clientX, ev.clientY)
      const freq = Math.max(MIN_FREQ, Math.min(MAX_FREQ, Math.round(xToFreq(sx))))
      const gain = Math.round(Math.max(-MAX_GAIN, Math.min(MAX_GAIN, yToGain(sy))) * 10) / 10
      onChange({ ...eq, [key]: { ...eq[key], frequency: freq, gain } })
    }

    const onUp = (): void => {
      if (selectedKey === undefined) setInternalActive(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [disabled, eq, onChange, toSvgCoords, selectedKey, onNodeClick])

  const midY    = gainToY(0)
  const tipKey  = active ?? hover

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{
        display: 'block', width: '100%', aspectRatio: `${VW} / ${VH}`,
        cursor: disabled ? 'not-allowed' : active ? 'grabbing' : 'crosshair',
        background: 'var(--color-bg)',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
      }}
      aria-label="EQ frequency response"
    >
      <defs>
        <linearGradient id="sn-eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--color-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="sn-eq-clip">
          <rect x={0} y={0} width={VW} height={VH} />
        </clipPath>
      </defs>

      {/* Frequency grid lines */}
      {GRID_FREQS.map((f) => (
        <line key={f}
          x1={freqToX(f)} y1={0} x2={freqToX(f)} y2={VH}
          stroke="var(--color-border)" strokeWidth={0.7} strokeDasharray="3 5"
        />
      ))}

      {/* Gain grid lines */}
      {GRID_GAINS.map((g) => (
        <line key={g}
          x1={0} y1={gainToY(g)} x2={VW} y2={gainToY(g)}
          stroke="var(--color-border)" strokeWidth={0.7} strokeDasharray="3 5"
        />
      ))}

      {/* 0 dB centre line */}
      <line
        x1={0} y1={midY} x2={VW} y2={midY}
        stroke="var(--color-border-strong)" strokeWidth={1}
      />

      {/* Curve fill */}
      <path d={areaPath} fill="url(#sn-eq-fill)" clipPath="url(#sn-eq-clip)" />

      {/* Curve line */}
      <path
        d={curvePath} fill="none"
        stroke="var(--color-accent)" strokeWidth={1.75}
        strokeLinecap="round" strokeLinejoin="round"
        clipPath="url(#sn-eq-clip)"
        style={{ opacity: disabled ? 0.4 : 1 }}
      />

      {/* Frequency axis labels */}
      {LABEL_FREQS.map((f) => (
        <text key={f} x={freqToX(f)} y={VH - 4} textAnchor="middle"
          style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, fill: 'var(--color-text-tertiary)' }}>
          {fmtHz(f)}
        </text>
      ))}

      {/* Gain axis labels */}
      {GRID_GAINS.map((g) => (
        <text key={g} x={6} y={gainToY(g) + 3.5}
          style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, fill: 'var(--color-text-tertiary)' }}>
          {g > 0 ? `+${g}` : g}
        </text>
      ))}

      {/* Filter nodes — rendered last so they sit on top of the curve */}
      {FILTER_KEYS.map((key) => {
        const flt   = eq[key]
        const x     = freqToX(Math.max(MIN_FREQ, Math.min(MAX_FREQ, flt.frequency)))
        const y     = gainToY(Math.max(-MAX_GAIN, Math.min(MAX_GAIN, flt.gain)))
        const isAct = key === active
        const isHov = key === hover
        const r     = isAct ? 8 : isHov ? 6.5 : flt.enabled ? 5 : 4

        return (
          <g key={key}>
            {/* Invisible hit zone (large for easy grab) */}
            <circle
              cx={x} cy={y} r={13}
              fill="transparent"
              style={{
                cursor: disabled ? 'not-allowed' : isAct ? 'grabbing' : 'grab',
                pointerEvents: 'all',
              }}
              onPointerDown={(e) => handleNodePointerDown(e, key)}
              onMouseEnter={() => !disabled && setHover(key)}
              onMouseLeave={() => setHover(null)}
            />

            {/* Visual node */}
            <circle
              cx={x} cy={y} r={r}
              fill={flt.enabled
                ? (isAct ? 'var(--color-text-primary)' : 'var(--color-accent)')
                : 'var(--color-border-strong)'}
              stroke="var(--color-bg)"
              strokeWidth={1.75}
              style={{
                pointerEvents: 'none',
                transition: isAct ? 'none' : 'r 0.1s, fill 0.1s',
              }}
            />

            {/* Tooltip on hover or active drag */}
            {tipKey === key && (() => {
              const tx = Math.max(48, Math.min(VW - 48, x))
              const ty = y < 30 ? y + 22 : y - 19
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={tx - 48} y={ty - 11} width={96} height={18} rx={4}
                    fill="var(--color-surface-raised)"
                    stroke="var(--color-border-strong)"
                    strokeWidth={0.75}
                  />
                  <text
                    x={tx} y={ty + 4} textAnchor="middle"
                    style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, fill: 'var(--color-text-primary)' }}
                  >
                    {fmtHz(flt.frequency)}Hz {fmtGainDb(flt.gain)}dB
                  </text>
                </g>
              )
            })()}
          </g>
        )
      })}
    </svg>
  )
}
