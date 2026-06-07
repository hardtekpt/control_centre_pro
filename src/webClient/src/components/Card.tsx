import type { ReactNode } from 'react'

/**
 * Standard surface card used across the web client. Optional uppercase title and
 * an optional right-aligned slot (e.g. a status icon or toggle).
 */
export function Card({
  title,
  right,
  children,
  bodyStyle,
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  bodyStyle?: React.CSSProperties
}): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {title && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-secondary)',
              }}
            >
              {title}
            </span>
          )}
          {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  )
}
