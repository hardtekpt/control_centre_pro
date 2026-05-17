import type { ReactNode } from 'react'

// ── Standard rectangle ────────────────────────────────────────────────────────

interface NotificationRectProps {
  icon: ReactNode
  title: string
  subtitle?: string
  tail?: string
  wide?: boolean
  className?: string
  onClick?: () => void
}

export function NotificationRect({
  icon, title, subtitle, tail, wide, className = '', onClick,
}: NotificationRectProps): JSX.Element {
  return (
    <div
      className={`notif notif-rect${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <div className="ic">{icon}</div>
      <div className="body">
        <div className="title">{title}</div>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {tail && <div className="tail">{tail}</div>}
    </div>
  )
}

// ── Volume / slider variant ───────────────────────────────────────────────────

interface NotificationVolumeProps {
  icon: ReactNode
  label?: string
  value: number   // 0–100
  className?: string
  onClick?: () => void
}

export function NotificationVolume({
  icon, label = 'Volume', value, className = '', onClick,
}: NotificationVolumeProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={`notif notif-rect slider wide${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <div className="ic">{icon}</div>
      <div className="body">
        <div className="row1">
          <div className="title">{label}</div>
          <div className="pct">{Math.round(clamped)}%</div>
        </div>
        <div className="track">
          <div className="fill" style={{ width: `${clamped}%` }} />
        </div>
      </div>
    </div>
  )
}
