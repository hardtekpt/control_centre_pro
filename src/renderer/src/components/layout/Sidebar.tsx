import { useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { AppView } from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_FLOAT_GAP = 6
const SIDEBAR_RADIUS = 10

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItemDef {
  id: AppView | 'settings'
  label: string
  icon: JSX.Element
}

const MAIN_NAV: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar(): JSX.Element {
  const { sidebarWidth, currentView, setSidebarWidth, setView } = useAppStore()

  const isResizing = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      dragStartX.current = e.clientX
      dragStartWidth.current = sidebarWidth

      const onMouseMove = (ev: MouseEvent): void => {
        if (!isResizing.current) return
        const next = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, dragStartWidth.current + (ev.clientX - dragStartX.current))
        )
        setSidebarWidth(next)
      }

      const onMouseUp = (): void => {
        isResizing.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth, setSidebarWidth]
  )

  return (
    <div
      className="relative flex-shrink-0 flex flex-col"
      style={{
        width: sidebarWidth,
        margin: `${SIDEBAR_FLOAT_GAP}px 0 8px ${SIDEBAR_FLOAT_GAP}px`,
      }}
    >
      {/* ── Inner floating card ────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderRadius: SIDEBAR_RADIUS,
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5">
          {MAIN_NAV.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentView === item.id}
              onClick={() => setView(item.id as AppView)}
            />
          ))}
        </nav>

        {/* Settings chip */}
        <div className="p-2">
          <SettingsChip
            isActive={currentView === 'settings'}
            onClick={() => setView('settings')}
          />
        </div>
      </div>

      {/* Resize handle — on outer div, not clipped by border-radius */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute top-0 right-0 bottom-0 z-20"
        style={{ width: 6, cursor: 'col-resize' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-accent)'
          e.currentTarget.style.opacity = '0.35'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.opacity = '1'
        }}
      />
    </div>
  )
}

// ─── Settings chip ────────────────────────────────────────────────────────────

interface SettingsChipProps {
  isActive: boolean
  onClick: () => void
}

function SettingsChip({ isActive, onClick }: SettingsChipProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label="Settings"
      className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 transition-colors duration-100"
      style={{
        background: isActive ? 'var(--color-accent-subtle)' : 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--color-hover-overlay)'
          e.currentTarget.style.borderColor = 'var(--color-text-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--color-surface-raised)'
          e.currentTarget.style.borderColor = 'var(--color-border)'
        }
      }}
    >
      {/* Icon badge */}
      <span
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
        style={{
          background: isActive ? 'var(--color-accent)' : 'var(--color-border)',
          color: isActive ? 'var(--color-surface)' : 'var(--color-text-secondary)',
        }}
      >
        <CogIcon />
      </span>

      {/* Label */}
      <span
        className="flex-1 text-sm text-left truncate leading-none"
        style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
      >
        Settings
      </span>

      {/* Chevron */}
      <span style={{ color: 'var(--color-text-secondary)' }}>
        <ChevronDownIcon />
      </span>
    </button>
  )
}

// ─── Nav button ───────────────────────────────────────────────────────────────

interface NavButtonProps {
  item: NavItemDef
  isActive: boolean
  onClick: () => void
}

function NavButton({ item, isActive, onClick }: NavButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-sm transition-colors duration-100"
      style={{
        background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--color-hover-overlay)'
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }
      }}
    >
      <span className="shrink-0 w-4 h-4 flex items-center justify-center">
        {item.icon}
      </span>
      <span className="truncate leading-none">{item.label}</span>
    </button>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 6.5L7 1.5l5.5 5V13H9V9.5H5V13H1.5V6.5z" />
    </svg>
  )
}

function CogIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ChevronDownIcon(): JSX.Element {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1l4 4 4-4" />
    </svg>
  )
}
