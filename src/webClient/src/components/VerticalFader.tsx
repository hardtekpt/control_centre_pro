import { useRef } from 'react'

/**
 * Minimal touch vertical fader. Value is 0..1; the fill grows bottom-up.
 * Pointer events compute the value from the Y position within the track, so it
 * works for mouse and touch. `onChange` fires live during the drag; the optional
 * `onDragStart`/`onDragEnd` let the store suppress remote state echoes mid-gesture.
 */
export function VerticalFader({
  value,
  onChange,
  onDragStart,
  onDragEnd,
  muted = false,
  height = 130,
}: {
  value: number
  onChange: (v: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  muted?: boolean
  height?: number
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const clamp = (v: number): number => Math.max(0, Math.min(1, v))

  const valueFromEvent = (clientY: number): number => {
    const el = trackRef.current
    if (!el) return value
    const rect = el.getBoundingClientRect()
    return clamp(1 - (clientY - rect.top) / rect.height)
  }

  const handlePointerDown = (e: React.PointerEvent): void => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    onDragStart?.()
    onChange(valueFromEvent(e.clientY))
  }

  const handlePointerMove = (e: React.PointerEvent): void => {
    if (!dragging.current) return
    onChange(valueFromEvent(e.clientY))
  }

  const handlePointerUp = (e: React.PointerEvent): void => {
    if (!dragging.current) return
    dragging.current = false
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    onDragEnd?.()
  }

  const pct = Math.round(clamp(value) * 100)
  const fillColor = muted ? 'var(--color-text-secondary)' : 'var(--color-accent)'

  return (
    <div
      role="slider"
      aria-orientation="vertical"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'relative',
        width: 40,
        height,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Track */}
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          width: 8,
          height: '100%',
          borderRadius: 6,
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${pct}%`,
            background: fillColor,
            opacity: muted ? 0.5 : 1,
          }}
        />
      </div>
      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: `calc(${pct}% - 7px)`,
          transform: 'translateX(-50%)',
          width: 24,
          height: 14,
          borderRadius: 4,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
