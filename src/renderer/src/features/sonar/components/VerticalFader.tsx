import { useRef, useState, useCallback, memo } from 'react'

export interface VerticalFaderProps {
  /** 0-100 */
  value: number
  onChange: (v: number) => void
  /** Called on every drag frame — use for real-time API calls without store updates */
  onDragChange?: (v: number) => void
  muted?: boolean
  /** Track height in px, default 200 */
  height?: number
  onDragStart?: () => void
  onDragEnd?: () => void
}

const TICKS = [
  { pct: 0,   label: '0',   bold: true  },
  { pct: 15,  label: '-6',  bold: false },
  { pct: 30,  label: '-12', bold: false },
  { pct: 50,  label: '-20', bold: false },
  { pct: 75,  label: '-40', bold: false },
  { pct: 100, label: '-∞', bold: true  },
]

function VerticalFaderComponent({
  value,
  onChange,
  onDragChange,
  muted,
  height = 200,
  onDragStart,
  onDragEnd,
}: VerticalFaderProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localValue, setLocalValue] = useState<number | null>(null)

  const display = localValue !== null ? localValue : value
  const fillPct = display  // 0-100, fill from bottom

  const valueFromClientY = useCallback((clientY: number): number => {
    const el = trackRef.current
    if (!el) return display
    const rect = el.getBoundingClientRect()
    const pct = 1 - (clientY - rect.top) / rect.height
    return Math.round(Math.max(0, Math.min(100, pct * 100)))
  }, [display])

  function onPointerDown(e: React.PointerEvent): void {
    e.preventDefault()
    draggingRef.current = true
    setIsDragging(true)
    onDragStart?.()
    const v = valueFromClientY(e.clientY)
    setLocalValue(v)
    onDragChange?.(v)

    function onMove(ev: PointerEvent): void {
      if (!draggingRef.current) return
      const v2 = valueFromClientY(ev.clientY)
      setLocalValue(v2)
      if (onDragChange) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          onDragChange(v2)
        })
      }
    }
    function onUp(ev: PointerEvent): void {
      draggingRef.current = false
      setIsDragging(false)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const v2 = valueFromClientY(ev.clientY)
      setLocalValue(null)
      onChange(v2)
      onDragEnd?.()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    let delta = 0
    if (e.key === 'ArrowUp')   { e.preventDefault(); delta = 1 }
    if (e.key === 'ArrowDown') { e.preventDefault(); delta = -1 }
    if (e.key === 'PageUp')    { e.preventDefault(); delta = 10 }
    if (e.key === 'PageDown')  { e.preventDefault(); delta = -10 }
    if (delta !== 0) onChange(Math.max(0, Math.min(100, value + delta)))
  }

  // Thumb sits at the fill top: bottom = fillPct% relative to track height
  // minus half of 14px thumb height = 7px
  const thumbBottom = `calc(${fillPct}% - 7px)`

  return (
    <div className="sn-fader-wrap" style={{ height }}>
      {/* Tick marks — each absolutely positioned at its dB percentage */}
      <div className="sn-fader-ticks">
        {TICKS.map((t) => (
          <div
            key={t.pct}
            className={`sn-tick${t.bold ? ' bold' : ''}`}
            style={{ top: `${t.pct}%` }}
          >
            <span className="sn-tick-line" />
            <span className="sn-tick-num">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className={`sn-fader-track${isDragging ? ' dragging' : ''}${muted ? ' muted' : ''}`}
        style={{ height: '100%' }}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="slider"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Volume"
      >
        <div className="sn-fader-fill" style={{ height: `${fillPct}%` }} />
        <div className="sn-fader-thumb" style={{ bottom: thumbBottom }}>
          <span className="sn-fader-thumb-line" />
        </div>
      </div>
    </div>
  )
}

export const VerticalFader = memo(VerticalFaderComponent)
