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

export function MicIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export function SleepIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function LockIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function MonitorOffIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h13" />
      <path d="M22 3 2 23" />
      <path d="M22 15V5a2 2 0 0 0-2-2" />
      <path d="M8 21h8" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export function PlayPauseIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="6" y1="15" x2="6" y2="9" />
      <polygon points="14 8 22 12 14 16 14 8" />
    </svg>
  )
}

export function SkipBackIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  )
}

export function SkipForwardIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  )
}

/** Speaker glyph; crossed out when `muted`. Used on all mute buttons. */
export function MuteIcon({ muted = true, color = 'currentColor', size = 15, title }: IconProps & { muted?: boolean }): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      )}
    </svg>
  )
}

export function MicOffIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

/** Headset with a slash — Discord "deafened" state. */
export function HeadsetOffIcon({ color = 'currentColor', size = 15, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2z" />
      <path d="M20 14a2 2 0 0 0-2 2v2a2 2 0 0 0 4 0v-2a2 2 0 0 0-2-2z" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  )
}

export function EditIcon({ color = 'currentColor', size = 14, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  )
}

export function TrashIcon({ color = 'currentColor', size = 14, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function RefreshIcon({ color = 'currentColor', size = 14, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      {title && <title>{title}</title>}
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

export function PlusIcon({ color = 'currentColor', size = 12, title }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)} strokeWidth={2.5}>
      {title && <title>{title}</title>}
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
