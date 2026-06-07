import type { ReactNode } from 'react'

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
    <div className="card">
      {(title || right) && (
        <div className="flex items-center gap-2 mb-3">
          {title && <span className="card-title">{title}</span>}
          {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  )
}
