import { memo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { haptic } from '../utils/haptic'
import { text, size } from './tokens'

/**
 * Shared UI kit for the remote web client. Every page builds its controls from
 * these primitives so cards, toggles, sliders, buttons and labels look and
 * behave identically everywhere. All components are touch-first (pointer
 * events, ≥30px tap targets) and colored via the CSS custom properties in
 * `styles/globals.css`.
 */

// ── PageHeader ────────────────────────────────────────────────────────────────

export function PageHeader({ title, right }: { title: string; right?: ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <h1 style={{ ...text.pageTitle, flex: 1, minWidth: 0 }}>{title}</h1>
      {right}
    </div>
  )
}

// ── Labels & fields ───────────────────────────────────────────────────────────

/** Uppercase group label inside a card body. */
export function SectionLabel({ children }: { children: ReactNode }): JSX.Element {
  return <span className="card-field-label">{children}</span>
}

/**
 * A labeled control row. Two layouts:
 * - inline (default): mono label in a fixed-width column, control fills the rest.
 * - `stack`: uppercase label above a full-width control — use for segment groups
 *   and anything that needs the whole row width on a phone.
 */
export function Field({
  label,
  stack = false,
  align = 'center',
  labelWidth = size.rowLabelWidth,
  children,
}: {
  label: string
  stack?: boolean
  align?: 'center' | 'start'
  labelWidth?: number
  children: ReactNode
}): JSX.Element {
  if (stack) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="card-field-label">{label}</span>
        {children}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: align === 'start' ? 'flex-start' : 'center', gap: 8 }}>
      <span
        className="card-row-label"
        style={{ width: labelWidth, flexShrink: 0, paddingTop: align === 'start' ? 7 : 0 }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// ── SliderInput (0..1, pointer events — works for mouse and touch) ───────────

function SliderInputComponent({
  value,
  onChange,
  onDragStart,
  onDragEnd,
  muted = false,
  orientation = 'horizontal',
}: {
  value: number
  onChange: (v: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  muted?: boolean
  orientation?: 'horizontal' | 'vertical'
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const displayValue = dragValue !== null ? dragValue : value

  function valueFromPoint(clientX: number, clientY: number): number {
    const el = containerRef.current
    if (!el) return displayValue
    const rect = el.getBoundingClientRect()
    return orientation === 'vertical'
      ? Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height))
      : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function onPointerDown(e: React.PointerEvent): void {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    isDragging.current = true
    haptic()
    onDragStart?.()
    const v = valueFromPoint(e.clientX, e.clientY)
    setDragValue(v)
    onChange(v)
  }
  function onPointerMove(e: React.PointerEvent): void {
    if (!isDragging.current) return
    const v = valueFromPoint(e.clientX, e.clientY)
    setDragValue(v)
    onChange(v)
  }
  function onPointerUp(): void {
    if (!isDragging.current) return
    isDragging.current = false
    setDragValue(null)
    onDragEnd?.()
  }

  const fillColor = muted ? 'var(--color-text-secondary)' : 'var(--color-accent)'
  const fillOpacity = muted ? 0.5 : 1

  if (orientation === 'vertical') {
    return (
      <div
        ref={containerRef}
        style={{ position: 'relative', height: '100%', width: '100%', cursor: 'ns-resize', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 6, bottom: 6, width: 6, borderRadius: 9999, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }} />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 6, width: 6, height: `calc(${displayValue} * (100% - 12px))`, borderRadius: 9999, background: fillColor, opacity: fillOpacity, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: `calc(6px + ${displayValue} * (100% - 12px) - 9px)`, width: 18, height: 10, borderRadius: size.radiusSm, background: 'var(--color-highlight)', boxShadow: 'var(--shadow-thumb)', pointerEvents: 'none' }} />
      </div>
    )
  }

  const thumbLeft = `calc(6px + ${displayValue} * (100% - 12px) - 5px)`
  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', flex: 1, minWidth: 60, height: 28, cursor: 'ew-resize', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 6, right: 6, height: 6, borderRadius: 9999, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }} />
      <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 6, width: `calc(${displayValue} * (100% - 12px))`, height: 6, borderRadius: 9999, background: fillColor, opacity: fillOpacity, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: thumbLeft, width: 10, height: 20, borderRadius: size.radiusSm, background: 'var(--color-highlight)', boxShadow: 'var(--shadow-thumb)', pointerEvents: 'none' }} />
    </div>
  )
}
export const SliderInput = memo(SliderInputComponent)

// ── Slider (ranged value + readout) ───────────────────────────────────────────

/**
 * Horizontal slider with a mono value readout. Handles min/max/step
 * normalization and keeps the readout live during a drag even when the bound
 * value only updates on the next state push.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  muted = false,
  showValue = true,
  format,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  muted?: boolean
  showValue?: boolean
  format?: (v: number) => string
  onChange: (v: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}): JSX.Element {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const display = dragValue !== null ? dragValue : value
  const range = max - min || 1

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <SliderInput
        value={Math.max(0, Math.min(1, (display - min) / range))}
        muted={muted}
        onChange={(v) => {
          const stepped = Math.round((min + v * range) / step) * step
          const fixed = step < 1 ? Math.round(stepped * 100) / 100 : stepped
          setDragValue(fixed)
          onChange(fixed)
        }}
        onDragStart={onDragStart}
        onDragEnd={() => {
          setDragValue(null)
          onDragEnd?.()
        }}
      />
      {showValue && (
        <span style={{ ...text.value, width: size.valueWidth, textAlign: 'right', flexShrink: 0 }}>
          {format ? format(display) : `${display}${unit}`}
        </span>
      )}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => {
        if (disabled) return
        haptic()
        onChange(!checked)
      }}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: checked ? 'var(--segment-active-bg)' : 'var(--color-border)',
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--segment-active-color)',
          transition: 'left 150ms',
        }}
      />
    </div>
  )
}

// ── Buttons ───────────────────────────────────────────────────────────────────

/** Square bordered button for a single icon. `active` flips to highlight colors. */
export function IconButton({
  onClick,
  active = false,
  title,
  ariaLabel,
  size: side = size.iconButton,
  style,
  children,
}: {
  onClick: () => void
  active?: boolean
  title?: string
  ariaLabel?: string
  size?: number
  style?: CSSProperties
  children: ReactNode
}): JSX.Element {
  return (
    <button
      onClick={() => {
        haptic()
        onClick()
      }}
      title={title}
      aria-label={ariaLabel ?? title}
      style={{
        width: side,
        height: side,
        borderRadius: size.radiusMd,
        border: '1px solid var(--color-border)',
        background: active ? 'var(--segment-active-bg)' : 'var(--color-surface-raised)',
        color: active ? 'var(--segment-active-color)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
        fontFamily: 'inherit',
        transition: 'background 150ms ease, color 150ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Text button. `primary` = filled highlight, `secondary` = raised surface, `ghost` = dashed outline. */
export function Button({
  variant = 'secondary',
  small = false,
  disabled = false,
  onClick,
  style,
  children,
}: {
  variant?: 'primary' | 'secondary' | 'ghost'
  small?: boolean
  disabled?: boolean
  onClick: () => void
  style?: CSSProperties
  children: ReactNode
}): JSX.Element {
  const colors: CSSProperties =
    variant === 'primary'
      ? { background: 'var(--segment-active-bg)', color: 'var(--segment-active-color)', border: '1px solid var(--color-border)' }
      : variant === 'ghost'
        ? { background: 'transparent', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-strong)' }
        : { background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }

  return (
    <button
      onClick={() => {
        if (disabled) return
        haptic()
        onClick()
      }}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: small ? '4px 10px' : '8px 14px',
        borderRadius: size.radiusLg,
        fontSize: small ? 11 : 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...colors,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── OptionGroup (connected segment buttons) ──────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div className="segment-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            haptic()
            onChange(opt.value)
          }}
          className={`segment-btn${value === opt.value ? ' active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Chip ──────────────────────────────────────────────────────────────────────

export function Chip({
  label,
  color,
  background,
}: {
  label: string
  color?: string
  background?: string
}): JSX.Element {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.05em',
        padding: '2px 8px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: background ?? 'transparent',
        color: color ?? 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ── BatteryIndicator ──────────────────────────────────────────────────────────

function BoltGlyph(): JSX.Element {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function BatteryIndicator({
  level,
  charging = false,
  title,
  hidePercent = false,
}: {
  level: number
  charging?: boolean
  title?: string
  hidePercent?: boolean
}): JSX.Element {
  const SEGMENTS = 4
  const filled = Math.round((level / 100) * SEGMENTS)
  const color =
    level <= 20 ? 'var(--color-status-error)' : level <= 50 ? 'var(--color-status-warn-fg)' : 'var(--color-status-ok)'
  return (
    <div title={title} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 24 }}>
      {charging && (
        <span style={{ color: 'var(--color-status-warn-fg)', display: 'flex' }}>
          <BoltGlyph />
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 14,
              borderRadius: 2,
              background: i < filled ? color : 'transparent',
              border: `1px solid ${i < filled ? color : 'var(--color-text-primary)'}`,
              opacity: i < filled ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      {!hidePercent && (
        <span style={{ ...text.value, color: 'var(--color-text-primary)', lineHeight: 1 }}>{level}%</span>
      )}
    </div>
  )
}
