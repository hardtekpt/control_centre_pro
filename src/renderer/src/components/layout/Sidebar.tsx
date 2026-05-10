import { useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { AppView } from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_COLLAPSED_WIDTH = 48
const SIDEBAR_FLOAT_GAP = 6  // px gap on left / top / bottom from window edges
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

/**
 * Floating collapsible sidebar.
 *
 * Floating effect: outer div carries the margin (gap from window edges);
 * inner card has border-radius, border, and overflow-hidden.
 * The resize handle lives on the outer div so it isn't clipped by border-radius.
 *
 * Peek: when collapsed, hovering the sidebar-toggle icon in TopBar calls
 * showPeek() which temporarily sets sidebarPeek=true.  Moving into the
 * sidebar calls cancelPeekHide() so the peek persists while the user browses.
 * Moving away schedules the hide with a 180ms delay.
 */
export function Sidebar(): JSX.Element {
  const {
    sidebarCollapsed,
    sidebarPeek,
    sidebarWidth,
    currentView,
    setSidebarWidth,
    setView,
    cancelPeekHide,
    schedulePeekHide,
  } = useAppStore()

  const isResizing = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // The sidebar shows at full width when: not collapsed, OR peek is active
  const isExpanded = !sidebarCollapsed || sidebarPeek
  const effectiveWidth = isExpanded ? sidebarWidth : SIDEBAR_COLLAPSED_WIDTH

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
        width: effectiveWidth,
        // top:6 right:0 bottom:8 left:6
        margin: `${SIDEBAR_FLOAT_GAP}px 0 8px ${SIDEBAR_FLOAT_GAP}px`,
        // Peek: fast transition; normal toggle: 150ms
        transition: sidebarPeek
          ? 'width 100ms ease'
          : 'width 150ms ease',
      }}
      // Peek mouse-enter: cancel any pending hide timer
      onMouseEnter={() => { if (sidebarCollapsed) cancelPeekHide() }}
      // Peek mouse-leave: schedule the hide
      onMouseLeave={() => { if (sidebarCollapsed) schedulePeekHide() }}
    >
      {/* ── Inner floating card ────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderRadius: SIDEBAR_RADIUS,
          // Subtle border makes the floating card visible against the bg
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
              collapsed={!isExpanded}
              onClick={() => setView(item.id as AppView)}
            />
          ))}
        </nav>

        {/* Settings — no top divider, just natural spacing */}
        <div className="pb-2 px-1.5">
          <NavButton
            item={{ id: 'settings', label: 'Settings', icon: <CogIcon /> }}
            isActive={currentView === 'settings'}
            collapsed={!isExpanded}
            onClick={() => setView('settings')}
          />
        </div>
      </div>

      {/* Resize handle — on outer div, not clipped by border-radius */}
      {!sidebarCollapsed && (
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

/** Traditional gear/cog icon with 8 teeth — Feather-icon style */
function CogIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
