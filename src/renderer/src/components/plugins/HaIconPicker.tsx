import ReactDOM from 'react-dom'
import type { HaHomeCardEntityType } from '@shared/types'

export const HA_ICONS = [
  { id: 'lightbulb',   label: 'Light' },
  { id: 'sun',         label: 'Sun / Brightness' },
  { id: 'moon',        label: 'Moon / Night' },
  { id: 'flame',       label: 'Heat / Fire' },
  { id: 'snowflake',   label: 'Cool / AC' },
  { id: 'thermometer', label: 'Thermostat' },
  { id: 'wind',        label: 'Fan / Wind' },
  { id: 'droplet',     label: 'Water / Humidity' },
  { id: 'tv',          label: 'TV / Display' },
  { id: 'speaker',     label: 'Speaker' },
  { id: 'music',       label: 'Music' },
  { id: 'power',       label: 'Power' },
  { id: 'plug',        label: 'Plug / Socket' },
  { id: 'zap',         label: 'Automation / Zap' },
  { id: 'lock',        label: 'Lock' },
  { id: 'shield',      label: 'Security / Alarm' },
  { id: 'camera',      label: 'Camera' },
  { id: 'bell',        label: 'Alert / Doorbell' },
  { id: 'home',        label: 'Home' },
  { id: 'play',        label: 'Scene / Play' },
  { id: 'clock',       label: 'Timer / Schedule' },
  { id: 'activity',    label: 'Sensor / Activity' },
  { id: 'wifi',        label: 'Network / WiFi' },
  { id: 'sofa',        label: 'Living Room' },
  { id: 'bed',         label: 'Bedroom' },
  { id: 'coffee',      label: 'Kitchen / Coffee' },
  { id: 'car',         label: 'Garage / Car' },
  { id: 'leaf',        label: 'Garden / Outdoor' },
  { id: 'star',        label: 'Favourite' },
  { id: 'eye',         label: 'Presence / Motion' },
] as const

export type HaIconId = typeof HA_ICONS[number]['id']

export function defaultHaIcon(type: HaHomeCardEntityType): string {
  switch (type) {
    case 'light':        return 'lightbulb'
    case 'climate':      return 'thermometer'
    case 'scene':        return 'play'
    case 'service_call': return 'zap'
    default:             return 'activity'
  }
}

const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: '1.5',
}

export function HaIconSvg({ id, size = 16 }: { id: string; size?: number }): JSX.Element {
  const props = { ...P, width: size, height: size, viewBox: '0 0 24 24' }

  switch (id) {
    case 'lightbulb': return (
      <svg {...props}>
        <path d="M9 21h6" />
        <path d="M12 3a6 6 0 0 1 6 6c0 3-1.7 5-3 6.5V18a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2.5C7.7 14 6 12 6 9a6 6 0 0 1 6-6z" />
      </svg>
    )
    case 'sun': return (
      <svg {...props}>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    )
    case 'moon': return (
      <svg {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
    case 'flame': return (
      <svg {...props}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    )
    case 'snowflake': return (
      <svg {...props}>
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="m20 16-4-4 4-4" />
        <path d="m4 8 4 4-4 4" />
        <path d="m16 4-4 4-4-4" />
        <path d="m8 20 4-4 4 4" />
      </svg>
    )
    case 'thermometer': return (
      <svg {...props}>
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>
    )
    case 'wind': return (
      <svg {...props}>
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      </svg>
    )
    case 'droplet': return (
      <svg {...props}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    )
    case 'tv': return (
      <svg {...props}>
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    )
    case 'speaker': return (
      <svg {...props}>
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <circle cx="12" cy="14" r="4" />
        <line x1="12" y1="6" x2="12.01" y2="6" />
      </svg>
    )
    case 'music': return (
      <svg {...props}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
    case 'power': return (
      <svg {...props}>
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    )
    case 'plug': return (
      <svg {...props}>
        <path d="M12 22V12" />
        <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
        <path d="M8 3v3" />
        <path d="M16 3v3" />
        <rect x="6" y="6" width="12" height="7" rx="1" />
      </svg>
    )
    case 'zap': return (
      <svg {...props}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    )
    case 'lock': return (
      <svg {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
    case 'shield': return (
      <svg {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
    case 'camera': return (
      <svg {...props}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    )
    case 'bell': return (
      <svg {...props}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    )
    case 'home': return (
      <svg {...props}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )
    case 'play': return (
      <svg {...props}>
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    )
    case 'clock': return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
    case 'activity': return (
      <svg {...props}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    )
    case 'wifi': return (
      <svg {...props}>
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    )
    case 'sofa': return (
      <svg {...props}>
        <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
        <path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5H6V11a2 2 0 0 0-4 0z" />
        <line x1="6" y1="19" x2="6" y2="21" />
        <line x1="18" y1="19" x2="18" y2="21" />
      </svg>
    )
    case 'bed': return (
      <svg {...props}>
        <path d="M2 4v16" />
        <path d="M2 9h20v11H2z" />
        <path d="M6 9V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4" />
        <path d="M14 9V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4" />
      </svg>
    )
    case 'coffee': return (
      <svg {...props}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    )
    case 'car': return (
      <svg {...props}>
        <path d="M5 17H3v-6l2.5-5h13L21 11v6h-2" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
        <path d="M9 17h6" />
      </svg>
    )
    case 'leaf': return (
      <svg {...props}>
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
    )
    case 'star': return (
      <svg {...props}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    )
    case 'eye': return (
      <svg {...props}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
    default: return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    )
  }
}

// ─── Picker popup ─────────────────────────────────────────────────────────────

interface HaIconPickerPopupProps {
  value: string | undefined
  type: HaHomeCardEntityType
  onChange: (iconId: string) => void
  onClose: () => void
  anchorRect: DOMRect
}

const POPUP_W = 220
const BTN = 32

export function HaIconPickerPopup({ value, type, onChange, onClose, anchorRect }: HaIconPickerPopupProps): JSX.Element {
  const currentId = value || defaultHaIcon(type)
  const rows = Math.ceil(HA_ICONS.length / 6)
  const popupH = rows * (BTN + 4) + 20

  const winW = window.innerWidth, winH = window.innerHeight
  let left = anchorRect.left
  let top = anchorRect.bottom + 6
  if (left + POPUP_W > winW - 8) left = winW - POPUP_W - 8
  if (top + popupH > winH - 8) top = anchorRect.top - popupH - 6
  if (left < 8) left = 8
  if (top < 8) top = 8

  return ReactDOM.createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div style={{
        position: 'fixed', left, top, width: POPUP_W, zIndex: 9999,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        padding: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        userSelect: 'none',
      }}>
        {HA_ICONS.map(icon => {
          const sel = currentId === icon.id
          return (
            <button
              key={icon.id}
              title={icon.label}
              onClick={() => { onChange(icon.id); onClose() }}
              style={{
                width: BTN,
                height: BTN,
                borderRadius: 6,
                border: `1px solid ${sel ? 'var(--color-accent)' : 'transparent'}`,
                background: sel ? 'var(--color-surface-raised)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: sel ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                padding: 0,
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => {
                if (!sel) {
                  e.currentTarget.style.background = 'var(--color-surface-raised)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!sel) {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }
              }}
            >
              <HaIconSvg id={icon.id} size={16} />
            </button>
          )
        })}
      </div>
    </>,
    document.body
  )
}
