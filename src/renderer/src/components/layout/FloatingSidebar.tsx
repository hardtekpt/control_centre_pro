import ReactDOM from 'react-dom'
import { useRef, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../stores/appStore'
import type { AppView } from '@shared/types'

const SIDEBAR_RADIUS = 10

interface NavItemDef {
  id: AppView | 'settings'
  label: string
  icon: JSX.Element
}

const MAIN_NAV: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'gg-sonar', label: 'GG Sonar', icon: <SonarIcon /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <ShortcutsIcon /> },
  { id: 'sonar-preset-switcher', label: 'Sonar Preset Switcher', icon: <PresetSwitcherIcon /> },
  { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
]

/**
 * Portal-based floating sidebar peek panel.
 * Renders at document.body so it's never clipped by parent overflow:hidden.
 * Visible only when the sidebar is collapsed AND the user is hovering the
 * sidebar-toggle button (or this panel itself).
 */
export function FloatingSidebar(): JSX.Element | null {
  const {
    sidebarCollapsed,
    sidebarPeek,
    sidebarPeekAnchor,
    sidebarWidth,
    currentView,
    setView,
    cancelPeekHide,
    schedulePeekHide,
  } = useAppStore()

  if (!sidebarCollapsed || !sidebarPeek || !sidebarPeekAnchor) return null

  const panel = (
    <div
      className="float-in"
      onMouseEnter={cancelPeekHide}
      onMouseLeave={schedulePeekHide}
      style={{
        position: 'fixed',
        left: sidebarPeekAnchor.x,
        top: sidebarPeekAnchor.bottom + 4,
        width: sidebarWidth,
        minHeight: 120,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        borderRadius: SIDEBAR_RADIUS,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
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

      {/* Mission Control chip */}
      <div className="p-2">
        <MissionControlChip
          isSettingsActive={currentView === 'settings'}
          onNavigateSettings={() => setView('settings')}
        />
      </div>
    </div>
  )

  return ReactDOM.createPortal(panel, document.body)
}

// ─── Mission Control chip ─────────────────────────────────────────────────────

interface MissionControlChipProps {
  isSettingsActive: boolean
  onNavigateSettings: () => void
}

function MissionControlChip({ isSettingsActive, onNavigateSettings }: MissionControlChipProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0, width: 0 })

  const openMenu = useCallback(() => {
    if (!chipRef.current) return
    const rect = chipRef.current.getBoundingClientRect()
    setMenuPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
      width: rect.width,
    })
    setMenuOpen(true)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent): void => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        chipRef.current && !chipRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  return (
    <>
      <div
        ref={chipRef}
        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5"
        style={{
          background: isSettingsActive ? 'var(--color-nav-active)' : 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* App icon badge */}
        <span
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
          style={{
            background: isSettingsActive ? 'var(--color-accent)' : 'var(--color-border)',
            color: isSettingsActive ? 'var(--color-surface)' : 'var(--color-text-primary)',
          }}
        >
          <MissionControlIcon />
        </span>

        {/* Label */}
        <span
          className="flex-1 text-xs font-semibold text-left truncate leading-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Mission Control
        </span>

        {/* Chevron button — opens floating menu */}
        <button
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          className="flex items-center justify-center w-5 h-5 rounded"
          aria-label="Open Mission Control menu"
          style={{
            background: menuOpen ? 'var(--color-surface-raised)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-raised)'
          }}
          onMouseLeave={(e) => {
            if (!menuOpen) e.currentTarget.style.background = 'transparent'
          }}
        >
          <ChevronDownIcon />
        </button>
      </div>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 4,
              zIndex: 9999,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            }}
          >
            <button
              onClick={() => {
                onNavigateSettings()
                setMenuOpen(false)
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: isSettingsActive ? 'var(--color-nav-active)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isSettingsActive) e.currentTarget.style.background = 'var(--color-hover-overlay)'
              }}
              onMouseLeave={(e) => {
                if (!isSettingsActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                <CogIcon />
              </span>
              Settings
            </button>
          </div>,
          document.body
        )}
    </>
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
      className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 mb-0.5 text-sm font-medium transition-colors duration-100"
      style={{
        background: isActive ? 'var(--color-nav-active)' : 'transparent',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-nav-text)',
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
          e.currentTarget.style.color = 'var(--color-nav-text)'
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

function MissionControlIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="3.5" />
      <line x1="7" y1="1" x2="7" y2="3.5" />
      <line x1="7" y1="10.5" x2="7" y2="13" />
      <line x1="1" y1="7" x2="3.5" y2="7" />
      <line x1="10.5" y1="7" x2="13" y2="7" />
    </svg>
  )
}

function HomeIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 6.5L7 1.5l5.5 5V13H9V9.5H5V13H1.5V6.5z" />
    </svg>
  )
}

function SonarIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="1.5" />
      <path d="M4 7a3 3 0 0 0 6 0M2 7a5 5 0 0 0 10 0" />
    </svg>
  )
}

function ShortcutsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="11" height="8" rx="1.5" />
      <path d="M4 6.5h6M4 8.5h4" />
    </svg>
  )
}

function PresetSwitcherIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h10M2 7h7M2 10h4" />
      <path d="M11 8l2 2-2 2" />
    </svg>
  )
}

function NotificationsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5A4 4 0 0 0 3 5.5v2.5L2 9.5h10l-1-1.5V5.5A4 4 0 0 0 7 1.5z" />
      <path d="M5.5 9.5a1.5 1.5 0 0 0 3 0" />
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
