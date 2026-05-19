import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useServiceStore } from '../../stores/serviceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, ToggleSetting, SettingsPageWrapper } from '../../components/SettingsComponents'
import type { ServiceInfo } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

export function GeneralSettings(): JSX.Element {
  const { theme, setTheme } = useAppStore()
  const { services } = useServiceStore()
  const { setDirty, registerSave } = useSettingsForm()

  const [draftTheme, setDraftTheme] = useState<Theme>(theme)
  const [draftMinimizeToTray, setDraftMinimizeToTray] = useState(true)
  const [savedMinimizeToTray, setSavedMinimizeToTray] = useState(true)
  const [draftPythonPath, setDraftPythonPath] = useState('')
  const [savedPythonPath, setSavedPythonPath] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getServiceConfig().then((cfg) => {
      setDraftPythonPath(cfg.pythonPath)
      setSavedPythonPath(cfg.pythonPath)
    })
    window.api.getSettings().then((s) => {
      setDraftMinimizeToTray(s.minimizeToTray)
      setSavedMinimizeToTray(s.minimizeToTray)
    })
  }, [])

  const isDirtyLocal =
    draftTheme !== theme ||
    draftPythonPath !== savedPythonPath ||
    draftMinimizeToTray !== savedMinimizeToTray
  useEffect(() => {
    setDirty(isDirtyLocal)
  }, [isDirtyLocal, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const currentSettings = await window.api.getSettings()
      await window.api.setSettings({
        ...currentSettings,
        theme: draftTheme,
        minimizeToTray: draftMinimizeToTray,
      })
      setTheme(draftTheme)
      setSavedMinimizeToTray(draftMinimizeToTray)

      const trimmedPath = draftPythonPath.trim()
      if (trimmedPath) {
        await window.api.setPythonPath(trimmedPath)
        setSavedPythonPath(trimmedPath)
      }
    })
    return () => registerSave(null)
  }, [draftTheme, draftMinimizeToTray, draftPythonPath, registerSave, setTheme])

  function handleToggleService(svc: ServiceInfo): void {
    window.api.setServiceEnabled(svc.id, !svc.enabled)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="General" />
      <div className="flex-1 overflow-y-auto">
        <SettingsPageWrapper>
          <SettingSection title="Appearance">
        <SettingRow
          label="Theme"
          description="Choose the color scheme for the application"
        >
          <select
            value={draftTheme}
            onChange={(e) => setDraftTheme(e.target.value as Theme)}
            className="text-sm px-3 py-2 rounded"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </SettingRow>
        <SettingRow
          label="Minimize to tray"
          description="Keep the app running in the system tray when the window is closed"
          last
        >
          <ToggleSetting
            checked={draftMinimizeToTray}
            onChange={() => setDraftMinimizeToTray((v) => !v)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Services">
        <SettingRow
          label="Python executable"
          description="Path or command used to launch Python services"
          stacked
        >
          <input
            ref={inputRef}
            type="text"
            className="text-sm rounded font-mono"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              padding: '7px 10px',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            value={draftPythonPath}
            onChange={(e) => setDraftPythonPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') inputRef.current?.blur() }}
            spellCheck={false}
          />
        </SettingRow>

        {services.filter((svc) => svc.id !== 'discord').map((svc, idx, arr) => (
          <SettingRow
            key={svc.id}
            label={svc.name}
            description={svc.description}
            last={idx === arr.length - 1}
          >
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  opacity: svc.enabled ? 1 : 0.6,
                }}
              >
                {svc.enabled ? (svc.running ? 'running' : 'stopped') : 'disabled'}
              </span>
              <ToggleSetting
                checked={svc.enabled}
                onChange={() => handleToggleService(svc)}
              />
            </div>
          </SettingRow>
        ))}

        {services.length === 0 && (
          <div
            className="px-5 py-3.5 text-sm"
            style={{
              color: 'var(--color-text-secondary)',
            }}
          >
            No services registered
          </div>
        )}
      </SettingSection>
        </SettingsPageWrapper>
      </div>
    </div>
  )
}

