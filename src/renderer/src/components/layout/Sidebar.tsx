import { useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { AppView } from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_COLLAPSED_WIDTH = 56 // Icon-only mode

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItemDef {
  id: AppView | 'settings'
  label: string
  icon: JSX.Element
}

/** Main navigation items shown in the sidebar body */
const MAIN_NAV: NavItemDef[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <HomeIcon />,
  },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

/**
 * Collapsible left sidebar with drag-to-resize.
 *
 * Collapse: clicking the chevron button toggles icon-only mode (56px wide).
 * Resize:   dragging the right edge lets the user set any width between
 *           SIDEBAR_MIN_WIDTH and SIDEBAR_MAX_WIDTH.
 */
export function Sidebar(): JSX.Element {
  const {
    sidebarCollapsed,
    sidebarWidth,
    currentView,
    toggleSidebar,
    setSidebarWidth,
    setView,
  } = useAppStore()

  // Refs for tracking the drag state — we don't want React re-renders mid-drag
  const isResizing = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const effectiveWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth

  /**
   * Starts a drag-resize session when the user presses down on the resize handle.
   * Global mouse listeners are added so the drag works even when the cursor moves
   * outside the handle area (common when dragging quickly).
   */
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      dragStartX.current = e.clientX
      dragStartWidth.current = sidebarWidth

      const onMouseMove = (moveEvent: MouseEvent): void => {
        if (!isResizing.current) return
        const delta = moveEvent.clientX - dragStartX.current
        const newWidth = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, dragStartWidth.current + delta)
        )
        setSidebarWidth(newWidth)
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
      // Lock cursor and disable text selection during drag
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth, setSidebarWidth]
  )

  return (
    <aside
      className="relative flex flex-col shrink-0 h-full overflow-hidden"
      style={{
        width: effectiveWidth,
        minWidth: effectiveWidth,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        transition: 'width 150ms ease, min-width 150ms ease',
      }}
    >
      {/* ── Collapse / expand toggle ── */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute top-3 -right-3 z-20 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-100"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
          e.currentTarget.style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)'
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }}
      >
        <ChevronIcon collapsed={sidebarCollapsed} />
      </button>

      {/* ── Main nav items ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-1">
        {MAIN_NAV.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={currentView === item.id}
            collapsed={sidebarCollapsed}
            onClick={() => setView(item.id as AppView)}
          />
        ))}
      </nav>

      {/* ── Footer: Settings ── */}
      <div className="py-2 px-1" style={{ borderTop: '1px solid var(--color-border)' }}>
        <NavButton
          item={{ id: 'settings', label: 'Settings', icon: <SettingsIcon /> }}
          isActive={currentView === 'settings'}
          collapsed={sidebarCollapsed}
          onClick={() => setView('settings')}
        />
      </div>

      {/* ── Resize handle (hidden when collapsed) ── */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute right-0 top-0 bottom-0 w-1 z-10 cursor-col-resize"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)'
            e.currentTarget.style.opacity = '0.4'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.opacity = '1'
          }}
          style={{ background: 'transparent', transition: 'background 100ms ease' }}
        />
      )}
    </aside>
  )
}

// ─── Nav Button ───────────────────────────────────────────────────────────────

interface NavButtonProps {
  item: NavItemDef
  isActive: boolean
  collapsed: boolean
  onClick: () => void
}

/**
 * A single navigation row in the sidebar.
 * In collapsed mode only the icon is visible; the label is shown as a tooltip.
 */
function NavButton({ item, isActive, collapsed, onClick }: NavButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className="flex items-center gap-2.5 w-full rounded-md px-2 py-2 text-sm transition-colors duration-100"
      style={{
        background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        border: 'none',
        textAlign: 'left',
        justifyContent: collapsed ? 'center' : 'flex-start',
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
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}
    </button>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ collapsed }: { collapsed: boolean }): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{
        transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 150ms ease',
      }}
    >
      <path d="M6.5 2L3 5l3.5 3" />
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

function SettingsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1.5V3M7 11v1.5M1.5 7H3M11 7h1.5M3.1 3.1l1 1M9.9 9.9l1 1M3.1 10.9l1-1M9.9 4.1l1-1" />
    </svg>
  )
}
