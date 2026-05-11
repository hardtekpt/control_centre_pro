import { TopBar } from '../layout/TopBar'
import { SettingsSidebar } from './SettingsSidebar'
import { GeneralSettings } from '../../pages/settings/GeneralSettings'
import { AppSettings } from '../../pages/settings/AppSettings'
import { GGSonarSettings } from '../../pages/settings/GGSonarSettings'
import { DDCSettings } from '../../pages/settings/DDCSettings'
import { About } from '../../pages/settings/About'
import { useAppStore } from '../../stores/appStore'

export function SettingsLayout(): JSX.Element {
  const { currentSettingsTab, setView } = useAppStore()

  return (
    <div className="flex flex-col h-full">
      <TopBar settingsMode onBack={() => setView('home')} />
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar />
        <main className="flex-1 overflow-y-auto selectable" style={{ background: 'var(--color-bg)' }}>
          <div className="px-8 py-6">
            {currentSettingsTab === 'general' && <GeneralSettings />}
            {currentSettingsTab === 'app' && <AppSettings />}
            {currentSettingsTab === 'gg-sonar' && <GGSonarSettings />}
            {currentSettingsTab === 'ddc' && <DDCSettings />}
            {currentSettingsTab === 'about' && <About />}
          </div>
        </main>
      </div>
    </div>
  )
}
