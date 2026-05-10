import { useAppStore } from '../../stores/appStore'

/**
 * Custom frameless title bar — replaces the native OS window chrome.
 * The entire bar is a drag region (WebkitAppRegion: drag) so the user can
 * move the window by clicking and dragging anywhere on it.
 * Interactive elements (buttons) must opt out of dragging via no-drag.
 */
export function TopBar(): JSX.Element {
  const { isMaximized } = useAppStore()

  return (
    <div
      className="flex items-center justify-between h-10 shrink-0 select-none"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        // Makes the bar draggable — Electron reads this CSS property
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      {/* ── Left: Logo + App name ── */}
      <div
        className="flex items-center gap-2 px-3"
        style={{ WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'] }}
      >
        <LogoMark />
        <span
          className="text-sm font-medium tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Control Centre Pro
        </span>
      </div>

      {/* ── Right: Windows window controls ── */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'] }}
      >
        <WindowControl
          onClick={() => window.api.minimize()}
          label="Minimize"
        >
          <MinimizeIcon />
        </WindowControl>
        <WindowControl
          onClick={() => window.api.maximize()}
          label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </WindowControl>
        <WindowControl
          onClick={() => window.api.close()}
          label="Close"
          isClose
        >
          <CloseIcon />
        </WindowControl>
      </div>
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function LogoMark(): JSX.Element {
  return (
    <div
      className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'var(--color-accent)', color: '#fff' }}
    >
      C
    </div>
  )
}

// ─── Window Control Button ────────────────────────────────────────────────────

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

// ─── Window Control Icons ─────────────────────────────────────────────────────

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
