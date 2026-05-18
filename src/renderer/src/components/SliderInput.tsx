import { useRef, useState, memo } from 'react'

/**
 * Custom horizontal slider with visual track, fill, and thumb.
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
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  showMuted?: boolean
  muted?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragValueRef = useRef<number | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)

  const displayValue = dragValue !== null ? dragValue : value

  function valueFromClientX(clientX: number): number {
    const el = containerRef.current
    if (!el) return displayValue
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
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
    const newValue = Math.max(0, Math.min(1, displayValue - e.deltaY * 0.001))
    setDragValue(newValue)
    triggerChange(newValue)
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    onDragStart?.()
    const newValue = valueFromClientX(e.clientX)
    dragValueRef.current = newValue
    setDragValue(newValue)

    function onMove(ev: MouseEvent): void {
      if (!dragging.current) return
      const v = valueFromClientX(ev.clientX)
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
        height: 18,
        cursor: disabled ? 'not-allowed' : 'ew-resize',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
    >
      {/* Track */}
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
      {/* Fill */}
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
      {/* Thumb */}
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
    </div>
  )
}

export const SliderInput = memo(SliderInputComponent)
