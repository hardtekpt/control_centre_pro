import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useServiceStore } from '../../stores/serviceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, ToggleSetting, SettingsPageWrapper } from '../../components/SettingsComponents'
import type { ServiceInfo } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

const THEME_DEFAULT_ACCENT: Record<Theme, string> = {
  dark: '#B0B0B0',
  light: '#525252',
  system: '#B0B0B0',
}

const THEME_DEFAULT_HIGHLIGHT: Record<Theme, string> = {
  dark: '#EBEBEB',
  light: '#141414',
  system: '#EBEBEB',
}

export function GeneralSettings(): JSX.Element {
  const { theme, setTheme, setAccentColor, setHighlightColor } = useAppStore()
  const { services } = useServiceStore()
  const { setDirty, registerSave } = useSettingsForm()

  const [draftTheme, setDraftTheme] = useState<Theme>(theme)
  const [draftAccentColor, setDraftAccentColor] = useState('')
  const [savedAccentColor, setSavedAccentColor] = useState('')
  const [draftHighlightColor, setDraftHighlightColor] = useState('')
  const [savedHighlightColor, setSavedHighlightColor] = useState('')
  const [draftMinimizeToTray, setDraftMinimizeToTray] = useState(true)
  const [savedMinimizeToTray, setSavedMinimizeToTray] = useState(true)
  const [draftOpenOnActiveDisplay, setDraftOpenOnActiveDisplay] = useState(false)
  const [savedOpenOnActiveDisplay, setSavedOpenOnActiveDisplay] = useState(false)
  const [draftRunAtStartup, setDraftRunAtStartup] = useState(false)
  const [savedRunAtStartup, setSavedRunAtStartup] = useState(false)
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
      setDraftOpenOnActiveDisplay(s.openOnActiveDisplay ?? false)
      setSavedOpenOnActiveDisplay(s.openOnActiveDisplay ?? false)
      setDraftRunAtStartup(s.runAtStartup ?? false)
      setSavedRunAtStartup(s.runAtStartup ?? false)
      setDraftAccentColor(s.accentColor ?? '')
      setSavedAccentColor(s.accentColor ?? '')
      setDraftHighlightColor(s.highlightColor ?? '')
      setSavedHighlightColor(s.highlightColor ?? '')
    })
  }, [])

  const isDirtyLocal =
    draftTheme !== theme ||
    draftAccentColor !== savedAccentColor ||
    draftHighlightColor !== savedHighlightColor ||
    draftPythonPath !== savedPythonPath ||
    draftMinimizeToTray !== savedMinimizeToTray ||
    draftOpenOnActiveDisplay !== savedOpenOnActiveDisplay ||
    draftRunAtStartup !== savedRunAtStartup
  useEffect(() => {
    setDirty(isDirtyLocal)
  }, [isDirtyLocal, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const currentSettings = await window.api.getSettings()
      await window.api.setSettings({
        ...currentSettings,
        theme: draftTheme,
        accentColor: draftAccentColor,
        highlightColor: draftHighlightColor,
        minimizeToTray: draftMinimizeToTray,
        openOnActiveDisplay: draftOpenOnActiveDisplay,
        runAtStartup: draftRunAtStartup,
      })
      setTheme(draftTheme)
      setAccentColor(draftAccentColor)
      setSavedAccentColor(draftAccentColor)
      setHighlightColor(draftHighlightColor)
      setSavedHighlightColor(draftHighlightColor)
      setSavedMinimizeToTray(draftMinimizeToTray)
      setSavedOpenOnActiveDisplay(draftOpenOnActiveDisplay)
      setSavedRunAtStartup(draftRunAtStartup)

      const trimmedPath = draftPythonPath.trim()
      if (trimmedPath) {
        await window.api.setPythonPath(trimmedPath)
        setSavedPythonPath(trimmedPath)
      }
    })
    return () => registerSave(null)
  }, [draftTheme, draftAccentColor, draftHighlightColor, draftMinimizeToTray, draftOpenOnActiveDisplay, draftRunAtStartup, draftPythonPath, registerSave, setTheme, setAccentColor, setHighlightColor])

  function handleToggleService(svc: ServiceInfo): void {
    window.api.setServiceEnabled(svc.id, !svc.enabled)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="General" description="Application theme, startup behavior, and service configuration" />
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
          label="Accent color"
          description="Override the theme's default accent color for interactive elements"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={draftAccentColor || THEME_DEFAULT_ACCENT[draftTheme]}
              onChange={(e) => setDraftAccentColor(e.target.value)}
              style={{
                width: 36,
                height: 28,
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                cursor: 'pointer',
                padding: 2,
                background: 'var(--color-surface-raised)',
              }}
            />
            {draftAccentColor && (
              <button
                onClick={() => setDraftAccentColor('')}
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </SettingRow>
        <SettingRow
          label="Highlight color"
          description="Color for toggles, slider handles, and active selections"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={draftHighlightColor || THEME_DEFAULT_HIGHLIGHT[draftTheme]}
              onChange={(e) => setDraftHighlightColor(e.target.value)}
              style={{
                width: 36,
                height: 28,
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                cursor: 'pointer',
                padding: 2,
                background: 'var(--color-surface-raised)',
              }}
            />
            {draftHighlightColor && (
              <button
                onClick={() => setDraftHighlightColor('')}
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </SettingRow>
        <SettingRow
          label="Minimize to tray"
          description="Keep the app running in the system tray when the window is closed"
        >
          <ToggleSetting
            checked={draftMinimizeToTray}
            onChange={() => setDraftMinimizeToTray((v) => !v)}
          />
        </SettingRow>
        <SettingRow
          label="Open on active display"
          description="Open the app and notifications on the display where the cursor is. When off, always uses the primary display."
        >
          <ToggleSetting
            checked={draftOpenOnActiveDisplay}
            onChange={() => setDraftOpenOnActiveDisplay((v) => !v)}
          />
        </SettingRow>
        <SettingRow
          label="Run at startup"
          description="Automatically launch Control Centre Pro when you log in to Windows"
          last
        >
          <ToggleSetting
            checked={draftRunAtStartup}
            onChange={() => setDraftRunAtStartup((v) => !v)}
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
              width: '100%',
            }}
            value={draftPythonPath}
            onChange={(e) => setDraftPythonPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') inputRef.current?.blur() }}
            spellCheck={false}
          />
        </SettingRow>

        {services.filter((svc) => !['discord', 'home-assistant', 'resource-monitor'].includes(svc.id)).map((svc, idx, arr) => (
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

