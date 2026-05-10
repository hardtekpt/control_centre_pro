import { TopBar } from '../layout/TopBar'
import { SettingsSidebar } from './SettingsSidebar'
import { GeneralSettings } from '../../pages/settings/GeneralSettings'
import { About } from '../../pages/settings/About'
import { useAppStore } from '../../stores/appStore'

/**
 * Settings view layout — replaces MainLayout when the user opens settings.
 * Has its own dedicated sidebar so settings navigation is separate from the
 * main app navigation. The TopBar is shared so window controls remain accessible.
 */
export function SettingsLayout(): JSX.Element {
  const { currentSettingsTab } = useAppStore()

  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar />
        <main
          className="flex-1 overflow-y-auto p-8 selectable"
          style={{ background: 'var(--color-bg)' }}
        >
          {currentSettingsTab === 'general' && <GeneralSettings />}
          {currentSettingsTab === 'about' && <About />}
        </main>
      </div>
    </div>
  )
}
