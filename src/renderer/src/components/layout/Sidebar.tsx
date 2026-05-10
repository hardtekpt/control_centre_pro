import { useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { AppView } from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_COLLAPSED_WIDTH = 48 // Icon-only mode
const SIDEBAR_FLOAT_GAP = 6       // px gap between sidebar and window edges
const SIDEBAR_RADIUS = 10         // px border-radius on the floating card

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItemDef {
  id: AppView | 'settings'
  label: string
  icon: JSX.Element
}

/** Main navigation items — add new sections here */
const MAIN_NAV: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

/**
 * Floating collapsible left sidebar.
 *
 * Visual structure:
 *  - An outer positioning div (handles margin / width / resize dragging)
 *  - An inner rounded card (background, border-radius, overflow-hidden)
 *    so the content is cleanly clipped to the rounded shape
 *
 * Collapse: toggled by the hamburger icon in TopBar (calls toggleSidebar in store).
 * Resize:   drag the right edge (outside the rounded card) to set any width
 *           between SIDEBAR_MIN_WIDTH and SIDEBAR_MAX_WIDTH.
 */
export function Sidebar(): JSX.Element {
  const {
    sidebarCollapsed,
    sidebarWidth,
    currentView,
    setSidebarWidth,
    setView,
  } = useAppStore()

  const isResizing = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const effectiveWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth

  /**
   * Begin a drag-resize session when the user presses on the resize handle.
   * Global listeners are added so the drag continues even when the cursor
   * moves outside the handle strip.
   */
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      dragStartX.current = e.clientX
      dragStartWidth.current = sidebarWidth

      const onMouseMove = (ev: MouseEvent): void => {
        if (!isResizing.current) return
        const delta = ev.clientX - dragStartX.current
        const next = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, dragStartWidth.current + delta)
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
    /*
     * Outer div: controls width + floating margin + transition.
     * Does NOT have overflow-hidden so the resize handle extends to its edge.
     */
    <div
      className="relative flex-shrink-0 flex flex-col"
      style={{
        width: effectiveWidth,
        margin: `${SIDEBAR_FLOAT_GAP}px 0 ${SIDEBAR_FLOAT_GAP}px ${SIDEBAR_FLOAT_GAP}px`,
        transition: sidebarCollapsed
          ? 'width 150ms ease'
          : 'width 0ms', // instant while dragging
      }}
    >
      {/*
       * Inner card: the visible floating surface.
       * border-radius + overflow-hidden ensure content clips to rounded shape.
       */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderRadius: SIDEBAR_RADIUS,
        }}
      >
        {/* ── Main nav ── */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5">
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
        <div
          className="py-2 px-1.5"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <NavButton
            item={{ id: 'settings', label: 'Settings', icon: <SettingsIcon /> }}
            isActive={currentView === 'settings'}
            collapsed={sidebarCollapsed}
            onClick={() => setView('settings')}
          />
        </div>
      </div>

      {/* ── Resize handle ─────────────────────────────────────────────────── */}
      {/*
       * Positioned on the outer div (outside the rounded card) so it spans
       * the full height and triggers resize from the true right edge.
       */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute top-0 right-0 bottom-0 z-20"
          style={{
            width: 6,
            cursor: 'col-resize',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)'
            e.currentTarget.style.opacity = '0.35'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.opacity = '1'
          }}
        />
      )}
    </div>
  )
}

// ─── Nav button ───────────────────────────────────────────────────────────────

interface NavButtonProps {
  item: NavItemDef
  isActive: boolean
  collapsed: boolean
  onClick: () => void
}

/**
 * A single nav row.  In collapsed mode only the icon is visible (label
 * shown as a native tooltip via `title`).
 */
function NavButton({ item, isActive, collapsed, onClick }: NavButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-sm transition-colors duration-100"
      style={{
        background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        border: 'none',
        textAlign: 'left',
        justifyContent: collapsed ? 'center' : 'flex-start',
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
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}
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

function SettingsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1.5V3M7 11v1.5M1.5 7H3M11 7h1.5M3.1 3.1l1 1M9.9 9.9l1 1M3.1 10.9l1-1M9.9 4.1l1-1" />
    </svg>
  )
}
