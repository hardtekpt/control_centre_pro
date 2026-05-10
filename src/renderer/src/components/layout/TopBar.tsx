import { useAppStore } from '../../stores/appStore'

/**
 * Custom frameless title bar.
 *
 * Left icon toolbar (left → right):
 *   1. Hamburger  → opens the native OS application menu (File/Edit/View/Help)
 *   2. Sidebar    → click to toggle; hover when collapsed shows a peek preview
 *   3. Search     → placeholder
 *   4. Back/Fwd   → placeholder navigation arrows (disabled)
 *
 * Right: Windows window controls (— □ ×)
 * The whole bar is a drag region; interactive elements opt out via no-drag.
 *
 * Top bar uses var(--color-bg) — same as the main content area — so there
 * is no visual separation between the bar and the canvas beneath it.
 */
export function TopBar(): JSX.Element {
  const { isMaximized, sidebarCollapsed, toggleSidebar, showPeek, schedulePeekHide } =
    useAppStore()

  /** Open the native application menu below the hamburger button */
  const handleShowMenu = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    window.api.showMenu(Math.round(rect.left), Math.round(rect.bottom))
  }

  return (
    <div
      className="flex items-center h-10 shrink-0 select-none"
      style={{
        // Same color as the main canvas — no divider, seamless with the content
        background: 'var(--color-bg)',
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      {/* ── Left: icon toolbar ─────────────────────────────────────────────── */}
      <div
        className="flex items-center h-full px-1 gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'] }}
      >
        {/* 1. Hamburger → native app menu */}
        <ToolbarBtn onClick={handleShowMenu} label="Application menu">
          <HamburgerIcon />
        </ToolbarBtn>

        {/* 2. Sidebar toggle — hover shows peek when collapsed */}
        <ToolbarBtn
          onClick={toggleSidebar}
          label={sidebarCollapsed ? 'Expand sidebar · Ctrl+B' : 'Collapse sidebar · Ctrl+B'}
          onMouseEnter={() => showPeek()}
          onMouseLeave={() => schedulePeekHide()}
        >
          <SidebarIcon />
        </ToolbarBtn>

        {/* 3. Search */}
        <ToolbarBtn onClick={() => {}} label="Search">
          <SearchIcon />
        </ToolbarBtn>

        {/* Thin vertical divider */}
        <div
          className="mx-0.5 h-4 w-px shrink-0"
          style={{ background: 'var(--color-border)' }}
        />

        {/* 4. Navigation arrows (disabled — placeholder) */}
        <ToolbarBtn onClick={() => {}} label="Go back" disabled>
          <BackArrowIcon />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => {}} label="Go forward" disabled>
          <ForwardArrowIcon />
        </ToolbarBtn>
      </div>

      {/* ── Drag spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right: Windows window controls ────────────────────────────────── */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'] }}
      >
        <WindowControl onClick={() => window.api.minimize()} label="Minimize">
          <MinimizeIcon />
        </WindowControl>
        <WindowControl
          onClick={() => window.api.maximize()}
          label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </WindowControl>
        <WindowControl onClick={() => window.api.close()} label="Close" isClose>
          <CloseIcon />
        </WindowControl>
      </div>
    </div>
  )
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  children: React.ReactNode
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  label: string
  disabled?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function ToolbarBtn({
  children,
  onClick,
  label,
  disabled = false,
  onMouseEnter,
  onMouseLeave,
}: ToolbarBtnProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded transition-colors duration-100"
      style={{
        background: 'transparent',
        color: disabled ? 'var(--color-border)' : 'var(--color-text-secondary)',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => {
        onMouseEnter?.()
        if (!disabled) {
          e.currentTarget.style.background = 'var(--color-hover-overlay)'
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.()
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = disabled ? 'var(--color-border)' : 'var(--color-text-secondary)'
      }}
    >
      {children}
    </button>
  )
}

// ─── Window control button ────────────────────────────────────────────────────

interface WindowControlProps {
  children: React.ReactNode
  onClick: () => void
  label: string
  isClose?: boolean
}

function WindowControl({ children, onClick, label, isClose = false }: WindowControlProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-11 h-10 flex items-center justify-center transition-colors duration-100"
      style={{ color: 'var(--color-text-secondary)', background: 'transparent', border: 'none' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isClose ? '#c42b1c' : 'var(--color-hover-overlay)'
        if (isClose) e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-secondary)'
      }}
    >
      {children}
    </button>
  )
}

// ─── Toolbar icons ────────────────────────────────────────────────────────────

function HamburgerIcon(): JSX.Element {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
      <rect width="15" height="1.5" rx="0.75" />
      <rect y="4.75" width="15" height="1.5" rx="0.75" />
      <rect y="9.5" width="15" height="1.5" rx="0.75" />
    </svg>
  )
}

/** Window-with-left-panel sidebar icon */
function SidebarIcon(): JSX.Element {
  return (
    <svg width="16" height="13" viewBox="0 0 16 13" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="0.625" y="0.625" width="14.75" height="11.75" rx="2.375" />
      <line x1="5.25" y1="0.625" x2="5.25" y2="12.375" />
    </svg>
  )
}

function SearchIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="6" cy="6" r="4.5" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" />
    </svg>
  )
}

function BackArrowIcon(): JSX.Element {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1L1.5 6.5L7 12" />
    </svg>
  )
}

function ForwardArrowIcon(): JSX.Element {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1L6.5 6.5L1 12" />
    </svg>
  )
}

// ─── Window control icons ─────────────────────────────────────────────────────

function MinimizeIcon(): JSX.Element {
  return (
    <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
      <rect width="10" height="1" />
    </svg>
  )
}

function MaximizeIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  )
}

function RestoreIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="2.5" y="0.5" width="7" height="7" />
      <path d="M0.5 2.5v7h7" />
    </svg>
  )
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
      <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
    </svg>
  )
}
