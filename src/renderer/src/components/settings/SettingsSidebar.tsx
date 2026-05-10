import { useAppStore } from '../../stores/appStore'
import type { SettingsTab } from '@shared/types'

const FLOAT_GAP = 6
const SIDEBAR_RADIUS = 10

interface SettingsNavItem {
  id: SettingsTab
  label: string
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'general', label: 'General' },
  { id: 'app', label: 'App' },
  { id: 'gg-sonar', label: 'GG Sonar' },
  { id: 'ddc', label: 'DDC' },
  { id: 'about', label: 'About' },
]

/**
 * Settings-specific sidebar — fixed width, same floating card style as the
 * main Sidebar so both views feel visually consistent.
 */
export function SettingsSidebar(): JSX.Element {
  const { currentSettingsTab, setSettingsTab, setView } = useAppStore()

  return (
    <div
      className="w-44 shrink-0 flex flex-col"
      style={{
        margin: `${FLOAT_GAP}px 0 8px ${FLOAT_GAP}px`,
      }}
    >
      {/* Floating card */}
      <div
        className="flex flex-col flex-1 overflow-hidden py-2 px-1.5"
        style={{
          background: 'var(--color-surface)',
          borderRadius: SIDEBAR_RADIUS,
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Back to main app */}
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-2 w-full px-2 py-2 mb-1 rounded-lg text-sm font-medium transition-colors duration-100"
          style={{
            color: 'var(--color-nav-text)',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-hover-overlay)'
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-nav-text)'
          }}
        >
          <BackIcon />
          Back
        </button>

        {/* Divider */}
        <div className="mx-2 mb-2" style={{ height: 1, background: 'var(--color-border)' }} />

        {/* Section label */}
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
                className="flex items-center w-full px-2 py-2 mb-0.5 rounded-lg text-sm font-medium transition-colors duration-100"
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
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function BackIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7.5 2L3.5 6l4 4" />
    </svg>
  )
}
