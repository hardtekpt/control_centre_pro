import { useRef, useState, memo } from 'react'

/**
 * Custom slider with visual track, fill, and thumb.
 * Supports mouse drag, keyboard, and wheel input.
 * Normalizes values to 0-1 range internally.
 */
function SliderInputComponent({
  value,
  onChange,
  disabled = false,
  showMuted = false,
  muted = false,
  onDragStart,
  onDragEnd,
  orientation = 'horizontal',
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  showMuted?: boolean
  muted?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  orientation?: 'horizontal' | 'vertical'
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragValueRef = useRef<number | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)

  const displayValue = dragValue !== null ? dragValue : value

  function valueFromClient(clientX: number, clientY: number): number {
    const el = containerRef.current
    if (!el) return displayValue
    const rect = el.getBoundingClientRect()
    if (orientation === 'vertical') {
      return Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height))
    } else {
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }
  }

  function triggerChange(v: number): void {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      onChange(v)
      debounceTimerRef.current = null
    }, 50)
  }

  function onWheel(e: React.WheelEvent): void {
    if (disabled) return
    e.preventDefault()
    const delta = orientation === 'vertical' ? -e.deltaY : e.deltaY
    const newValue = Math.max(0, Math.min(1, displayValue - delta * 0.001))
    setDragValue(newValue)
    triggerChange(newValue)
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    onDragStart?.()
    const newValue = valueFromClient(e.clientX, e.clientY)
    dragValueRef.current = newValue
    setDragValue(newValue)

    function onMove(ev: MouseEvent): void {
      if (!dragging.current) return
      const v = valueFromClient(ev.clientX, ev.clientY)
      dragValueRef.current = v
      setDragValue(v)
      triggerChange(v)
    }
    function onUp(): void {
      dragging.current = false
      const finalValue = dragValueRef.current
      dragValueRef.current = null
      setDragValue(null)
      onDragEnd?.()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (finalValue !== null) onChange(finalValue)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Thumb sits centred on the value position within the padded track area.
  // Track padding: 6px each side. Thumb: 10px wide, 18px tall.
  const thumbLeft = `calc(6px + ${displayValue} * (100% - 12px) - 5px)`

  return (
    <div
      ref={containerRef}
      className="relative flex-1"
      style={{
        height: orientation === 'vertical' ? 'auto' : 18,
        cursor: disabled ? 'not-allowed' : (orientation === 'vertical' ? 'ns-resize' : 'ew-resize'),
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
    >
      {orientation === 'vertical' ? (
        <>
          {/* Track (vertical) */}
          <div
            className="absolute rounded-full"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              top: 6,
              bottom: 6,
              width: 6,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
            }}
          />
          {/* Fill (vertical) */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 6,
              width: 6,
              height: `calc(${displayValue} * (100% - 12px))`,
              background: showMuted && muted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              opacity: showMuted && muted ? 0.35 : 1,
              transition: dragging.current ? 'none' : 'opacity 150ms ease',
            }}
          />
          {/* Thumb (vertical) */}
          <div
            className="absolute pointer-events-none rounded"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: `calc(6px + ${displayValue} * (100% - 12px) - 9px)`,
              width: 18,
              height: 10,
              background: 'var(--color-text-primary)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
        </>
      ) : (
        <>
          {/* Track (horizontal) */}
          <div
            className="absolute rounded-full"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              left: 6,
              right: 6,
              height: 6,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
            }}
          />
          {/* Fill (horizontal) */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              left: 6,
              width: `calc(${displayValue} * (100% - 12px))`,
              height: 6,
              background: showMuted && muted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              opacity: showMuted && muted ? 0.35 : 1,
              transition: dragging.current ? 'none' : 'opacity 150ms ease',
            }}
          />
          {/* Thumb (horizontal) */}
          <div
            className="absolute pointer-events-none rounded"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              left: thumbLeft,
              width: 10,
              height: 18,
              background: 'var(--color-text-primary)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
        </>
      )}
    </div>
  )
}

export const SliderInput = memo(SliderInputComponent)
