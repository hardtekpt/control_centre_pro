import type { ReactNode } from 'react'

// ── Plain icon circle ─────────────────────────────────────────────────────────

interface NotificationCircleProps {
  icon: ReactNode
  dot?: boolean
  className?: string
  onClick?: () => void
}

export function NotificationCircle({
  icon, dot, className = '', onClick,
}: NotificationCircleProps): JSX.Element {
  return (
    <div
      className={`notif notif-circ${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {icon}
      {dot && <span className="circ-dot" />}
    </div>
  )
}

// ── Ring progress circle ──────────────────────────────────────────────────────

interface NotificationCircleRingProps {
  icon: ReactNode
  value: number   // 0–100
  className?: string
  onClick?: () => void
}

export function NotificationCircleRing({
  icon, value, className = '', onClick,
}: NotificationCircleRingProps): JSX.Element {
  const R = 25
  const C = 2 * Math.PI * R
  const v = Math.max(0, Math.min(100, value))
  const offset = C * (1 - v / 100)

  return (
    <div
      className={`notif notif-circ ring${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <svg className="ring-svg" width="56" height="56" aria-hidden="true">
        <circle
          cx="28" cy="28" r={R}
          fill="none" stroke="var(--color-border)" strokeWidth="2.5"
        />
        <circle
          cx="28" cy="28" r={R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="ring-content">{icon}</span>
    </div>
  )
}

// ── Glyph circle ──────────────────────────────────────────────────────────────

interface NotificationCircleGlyphProps {
  glyph: string
  sub?: string
  className?: string
  onClick?: () => void
}

export function NotificationCircleGlyph({
  glyph, sub, className = '', onClick,
}: NotificationCircleGlyphProps): JSX.Element {
  return (
    <div
      className={`notif notif-circ glyph${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <span className="glyph-main">{glyph}</span>
      {sub && <span className="glyph-sub">{sub}</span>}
    </div>
  )
}
