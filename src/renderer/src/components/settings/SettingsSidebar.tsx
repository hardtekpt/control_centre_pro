import { useAppStore } from '../../stores/appStore'
import type { SettingsTab } from '@shared/types'

// ─── Nav items ────────────────────────────────────────────────────────────────

interface SettingsNavItem {
  id: SettingsTab
  label: string
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'general', label: 'General' },
  { id: 'about', label: 'About' },
]

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Left sidebar used exclusively inside the Settings view.
 * Fixed width (no resize) — simpler than the main sidebar since settings
 * navigation doesn't need the same level of customisation.
 */
export function SettingsSidebar(): JSX.Element {
  const { currentSettingsTab, setSettingsTab, setView } = useAppStore()

  return (
    <aside
      className="w-48 shrink-0 flex flex-col h-full py-3 px-1"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Back to main app */}
      <button
        onClick={() => setView('home')}
        className="flex items-center gap-2 w-full px-2 py-1.5 mb-2 rounded text-sm transition-colors duration-100"
        style={{ color: 'var(--color-text-secondary)', border: 'none', background: 'transparent', textAlign: 'left' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-hover-overlay)'
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }}
      >
        <BackIcon />
        Back
      </button>

      {/* Divider */}
      <div className="mx-2 mb-3" style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Section heading */}
      <p
        className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Settings
      </p>

      {/* Tab navigation */}
      <nav>
        {SETTINGS_NAV.map((item) => {
          const isActive = currentSettingsTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setSettingsTab(item.id)}
              className="flex items-center w-full px-2 py-2 rounded text-sm transition-colors duration-100"
              style={{
                background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: 'none',
                textAlign: 'left',
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
              {item.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7.5 2L3.5 6l4 4" />
    </svg>
  )
}
