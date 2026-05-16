import { useState } from 'react'
import { TopBar } from '../layout/TopBar'
import { SettingsSidebar } from './SettingsSidebar'
import { GeneralSettings } from '../../pages/settings/GeneralSettings'
import { GGSonarSettings } from '../../pages/settings/GGSonarSettings'
import { DDCSettings } from '../../pages/settings/DDCSettings'
import { About } from '../../pages/settings/About'
import { useAppStore } from '../../stores/appStore'
import { SettingsFormProvider, useSettingsForm } from '../../contexts/settingsFormContext'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import type { SettingsTab } from '@shared/types'

// About is read-only — no save footer needed
const SAVEABLE_TABS: SettingsTab[] = ['general', 'gg-sonar', 'ddc']

function SettingsLayoutInner(): JSX.Element {
  const { currentSettingsTab, setSettingsTab, goBack } = useAppStore()
  const { isDirty, setDirty, triggerSave } = useSettingsForm()
  const [pendingNav, setPendingNav] = useState<
    { type: 'tab'; tab: SettingsTab } | { type: 'back' } | null
  >(null)

  function requestTabChange(tab: SettingsTab): void {
    if (tab === currentSettingsTab) return
    if (isDirty) {
      setPendingNav({ type: 'tab', tab })
    } else {
      setSettingsTab(tab)
    }
  }

  function requestBack(): void {
    if (isDirty) {
      setPendingNav({ type: 'back' })
    } else {
      goBack()
    }
  }

  async function handleSaveAndContinue(): Promise<void> {
    await triggerSave()
    commitNav()
  }

  function handleLeaveWithoutSaving(): void {
    setDirty(false)
    commitNav()
  }

  function commitNav(): void {
    if (!pendingNav) return
    const nav = pendingNav
    setPendingNav(null)
    if (nav.type === 'tab') {
      setSettingsTab(nav.tab)
    } else {
      goBack()
    }
  }

  const showFooter = SAVEABLE_TABS.includes(currentSettingsTab)

  return (
    <div className="flex flex-col h-full">
      <TopBar settingsMode onBack={requestBack} />
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar onTabChange={requestTabChange} />
        <main
          className="flex-1 flex flex-col overflow-hidden selectable"
          style={{ background: 'var(--color-bg)' }}
        >
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {currentSettingsTab === 'general' && <GeneralSettings />}
            {currentSettingsTab === 'gg-sonar' && <GGSonarSettings />}
            {currentSettingsTab === 'ddc' && <DDCSettings />}
            {currentSettingsTab === 'about' && <About />}
          </div>
          {showFooter && (
            <div
              className="shrink-0 flex items-center justify-end gap-3 px-8 py-3"
              style={{
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
              }}
            >
              {isDirty && (
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Unsaved changes
                </span>
              )}
              <button
                onClick={triggerSave}
                disabled={!isDirty}
                className="text-sm px-4 py-1.5 rounded font-medium transition-colors"
                style={{
                  background: isDirty ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                  color: isDirty ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  cursor: isDirty ? 'pointer' : 'default',
                  opacity: isDirty ? 1 : 0.6,
                }}
              >
                Save
              </button>
            </div>
          )}
        </main>
      </div>
      {pendingNav && (
        <UnsavedChangesDialog
          onSaveAndContinue={handleSaveAndContinue}
          onLeave={handleLeaveWithoutSaving}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}

export function SettingsLayout(): JSX.Element {
  return (
    <SettingsFormProvider>
      <SettingsLayoutInner />
    </SettingsFormProvider>
  )
}
