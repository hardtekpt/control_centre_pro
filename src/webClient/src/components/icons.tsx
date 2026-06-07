/**
 * Small inline-SVG icon set used across the web client. Each takes a `color`
 * (defaults to currentColor) and `size`. These replace the old "status dots" so
 * connection / device state reads as a representative glyph instead of a dot.
 */

interface IconProps {
  color?: string
  size?: number
  title?: string
}

function base(size: number, color: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

/** 2.4 GHz wireless. */
export function WifiIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M5 12.5a10 10 0 0 1 14 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <line x1="12" y1="19.5" x2="12" y2="19.5" />
    </svg>
  )
}

export function BluetoothIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="m7 7 10 10-5 4V3l5 4L7 17" />
    </svg>
  )
}

export function PowerIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
  )
}

/** Sonar "active" indicator. */
export function AudioWaveIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <line x1="4" y1="10" x2="4" y2="14" />
      <line x1="8" y1="7" x2="8" y2="17" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="16" y1="8" x2="16" y2="16" />
      <line x1="20" y1="11" x2="20" y2="13" />
    </svg>
  )
}

export function HeadsetIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2z" />
      <path d="M20 14a2 2 0 0 0-2 2v2a2 2 0 0 0 4 0v-2a2 2 0 0 0-2-2z" />
    </svg>
  )
}

export function HomeIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

/** WebSocket connection state. */
export function LinkIcon({ color = 'currentColor', size = 16, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  )
}

export function LightningIcon({ color = 'currentColor', size = 14, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)} strokeWidth={2}>
      {title && <title>{title}</title>}
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
