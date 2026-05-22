import { useRef, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../stores/appStore'
import type { AppView } from '@shared/types'
import {
  MAIN_NAV,
  type NavItemDef,
  MissionControlIcon,
  CogIcon,
  ChevronDownIcon,
} from './navItems'

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_FLOAT_GAP = 6
const SIDEBAR_RADIUS = 10

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

        {/* Mission Control chip */}
        <div className="p-2">
          <MissionControlChip
            isSettingsActive={currentView === 'settings'}
            onNavigateSettings={() => setView('settings')}
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

// ─── Mission Control chip ─────────────────────────────────────────────────────

interface MissionControlChipProps {
  isSettingsActive: boolean
  onNavigateSettings: () => void
}

function MissionControlChip({ isSettingsActive, onNavigateSettings }: MissionControlChipProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLButtonElement>(null)
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
      <button
        ref={chipRef}
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5"
        aria-label="Open Mission Control menu"
        style={{
          background: isSettingsActive ? 'var(--color-nav-active)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!isSettingsActive) e.currentTarget.style.background = 'var(--color-hover-overlay)'
        }}
        onMouseLeave={(e) => {
          if (!isSettingsActive) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* App icon badge */}
        <span
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
          style={{
            background: isSettingsActive ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: isSettingsActive ? 'var(--color-surface)' : 'var(--color-text-secondary)',
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

        {/* Chevron */}
        <span
          className="flex items-center justify-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              overflow: 'hidden',
              zIndex: 9999,
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            {/* Identity header */}
            <div
              style={{
                padding: '10px 12px 9px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div
                className="flex items-center gap-2"
              >
                <span
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded"
                  style={{
                    background: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <MissionControlIcon />
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1,
                  }}
                >
                  Mission Control
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: 4 }}>
              <button
                onClick={() => {
                  onNavigateSettings()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2.5 w-full rounded-md"
                style={{
                  padding: '7px 10px',
                  background: isSettingsActive ? 'var(--color-nav-active)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  if (!isSettingsActive) e.currentTarget.style.background = 'var(--color-hover-overlay)'
                }}
                onMouseLeave={(e) => {
                  if (!isSettingsActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  className="shrink-0 flex items-center justify-center"
                  style={{ color: 'var(--color-text-secondary)', width: 16, height: 16 }}
                >
                  <CogIcon />
                </span>
                <span className="flex-1">Settings</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    letterSpacing: '0.01em',
                  }}
                >
                  Ctrl+,
                </span>
              </button>
            </div>
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

