import type { ReactNode } from 'react'

/**
 * Standard card container. Header row = optional accent-colored icon + title +
 * right-aligned slot; body below. All pages must use this instead of hand-rolled
 * card divs so padding, borders and title typography stay identical.
 */
export function Card({
  title,
  icon,
  right,
  children,
  bodyStyle,
}: {
  title?: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  bodyStyle?: React.CSSProperties
}): JSX.Element {
  return (
    <div className="card">
      {(title || icon || right) && (
        <div className="flex items-center gap-2 mb-3" style={{ minWidth: 0 }}>
          {icon && (
            <span style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {icon}
            </span>
          )}
          {title && (
            <span
              className="card-title"
              style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {title}
            </span>
          )}
          {right && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {right}
            </div>
          )}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  )
}
