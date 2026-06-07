import type { ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
}

/**
 * Touch-friendly wrapper around a native `<select>`. We keep the OS-native picker
 * (most reliable on phones) and only restyle the closed control: full width, a
 * 40px tap target, themed background, and a custom chevron overlay.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  ariaLabel,
  compact,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  /** Slightly smaller control for dense rows (still touch-sized). */
  compact?: boolean
}): JSX.Element {
  return (
    <div style={{ position: 'relative', width: '100%', opacity: disabled ? 0.5 : 1 }}>
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: compact ? 34 : 40,
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: compact ? '6px 30px 6px 10px' : '8px 32px 8px 12px',
          fontSize: 13,
          fontFamily: 'inherit',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Chevron compact={compact} />
    </div>
  )
}

function Chevron({ compact }: { compact?: boolean }): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-secondary)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        position: 'absolute',
        right: compact ? 9 : 11,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
