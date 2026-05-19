import { useState, useEffect } from 'react'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, SettingsPageWrapper } from '../../components/SettingsComponents'
import { DEFAULT_SETTINGS } from '@shared/types'

export function NotificationsSettings(): JSX.Element {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [draftDuration, setDraftDuration] = useState(
    DEFAULT_SETTINGS.notifications.durationMs.toString()
  )
  const { setDirty, registerSave } = useSettingsForm()

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      setDraftDuration(s.notifications.durationMs.toString())
    }).catch(console.error)
  }, [])

  useEffect(() => {
    const saved = settings.notifications.durationMs.toString()
    setDirty(draftDuration !== saved)
  }, [draftDuration, settings.notifications.durationMs, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const parsed = parseInt(draftDuration, 10)
      if (!isNaN(parsed) && parsed >= 500 && parsed <= 10000) {
        const current = await window.api.getSettings()
        const updated = { ...current, notifications: { ...current.notifications, durationMs: parsed } }
        await window.api.setSettings(updated)
        setSettings(updated)
      }
    })
    return () => registerSave(null)
  }, [draftDuration, registerSave])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Notifications"
        description="Control how long notifications appear on screen before automatically dismissing"
      />
      <div className="flex-1 overflow-y-auto">
        <SettingsPageWrapper>
          <SettingSection title="Display Duration">
            <SettingRow
              label="Duration"
              description="How long notifications remain visible (500–10000 ms)"
              stacked
              last
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={500}
                  max={10000}
                  step={100}
                  value={draftDuration}
                  onChange={(e) => setDraftDuration(e.target.value)}
                  className="text-sm px-3 py-2 rounded w-32 font-mono"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    fontSize: '13px',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>ms</span>
              </div>
            </SettingRow>
          </SettingSection>
        </SettingsPageWrapper>
      </div>
    </div>
  )
}
