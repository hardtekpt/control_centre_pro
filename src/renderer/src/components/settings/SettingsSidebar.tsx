import { useAppStore } from '../../stores/appStore'
import type { SettingsTab } from '@shared/types'

interface SettingsNavItem {
  id: SettingsTab
  label: string
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'general', label: 'General' },
  { id: 'gg-sonar', label: 'GG Sonar' },
  { id: 'ddc', label: 'DDC' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'remote-access', label: 'Remote Access' },
  { id: 'about', label: 'About' },
]

export function SettingsSidebar({ onTabChange }: { onTabChange: (tab: SettingsTab) => void }): JSX.Element {
  const { currentSettingsTab } = useAppStore()

  return (
    <div className="w-48 shrink-0 flex flex-col py-6 px-2" style={{ background: 'var(--color-bg)' }}>
      <nav>
        {SETTINGS_NAV.map((item) => {
          const isActive = currentSettingsTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex items-center w-full px-3 py-2 mb-0.5 rounded-lg text-sm font-medium transition-colors duration-100"
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
  )
}
