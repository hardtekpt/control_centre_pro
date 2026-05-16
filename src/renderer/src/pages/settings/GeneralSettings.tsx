import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useServiceStore } from '../../stores/serviceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import type { ServiceInfo } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

// ─── General settings page ────────────────────────────────────────────────────

export function GeneralSettings(): JSX.Element {
  const { theme, accentColor, setTheme, setAccentColor } = useAppStore()
  const { services } = useServiceStore()
  const { setDirty, registerSave } = useSettingsForm()

  const [draftTheme, setDraftTheme] = useState<Theme>(theme)
  const [draftAccentColor, setDraftAccentColor] = useState(accentColor)
  const [draftPythonPath, setDraftPythonPath] = useState('')
  const [savedPythonPath, setSavedPythonPath] = useState('')
  const [savedAccentColor, setSavedAccentColor] = useState(accentColor)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getServiceConfig().then((cfg) => {
      setDraftPythonPath(cfg.pythonPath)
      setSavedPythonPath(cfg.pythonPath)
    })
  }, [])

  // Sync dirty state to context
  const isDirtyLocal = draftTheme !== theme || draftAccentColor !== savedAccentColor || draftPythonPath !== savedPythonPath
  useEffect(() => {
    setDirty(isDirtyLocal)
  }, [isDirtyLocal, setDirty])

  // Register save handler — re-registers whenever draft values change so the
  // closure captures the latest values
  useEffect(() => {
    registerSave(async () => {
      const currentSettings = await window.api.getSettings()
      await window.api.setSettings({ ...currentSettings, theme: draftTheme, accentColor: draftAccentColor })
      setTheme(draftTheme)
      setAccentColor(draftAccentColor)
      setSavedAccentColor(draftAccentColor)

      const trimmedPath = draftPythonPath.trim()
      if (trimmedPath) {
        await window.api.setPythonPath(trimmedPath)
        setSavedPythonPath(trimmedPath)
      }
    })
    return () => registerSave(null)
  }, [draftTheme, draftAccentColor, draftPythonPath, registerSave, setTheme, setAccentColor])

  function handleToggleService(svc: ServiceInfo): void {
    window.api.setServiceEnabled(svc.id, !svc.enabled)
  }

  return (
    <div>
      <PageHeader title="General" />

      <SettingsSection title="Appearance">
        <SettingRow
          label="Theme"
          helper="Choose the color scheme for the application"
        >
          <select
            value={draftTheme}
            onChange={(e) => setDraftTheme(e.target.value as Theme)}
            className="text-sm px-2 py-1 rounded mono"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </SettingRow>
        <SettingRow
          label="Accent Color"
          helper="Choose the accent color for interactive elements"
          last
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={draftAccentColor}
              onChange={(e) => setDraftAccentColor(e.target.value)}
              style={{
                width: 40,
                height: 32,
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            />
            <input
              type="text"
              value={draftAccentColor}
              onChange={(e) => {
                const val = e.target.value
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                  setDraftAccentColor(val)
                }
              }}
              placeholder="#525252"
              className="text-sm px-2 py-1 rounded mono"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: 100,
              }}
            />
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Services">
        {/* Python interpreter path — saved via the page Save button */}
        <SettingRow
          label="Python executable"
          helper="Path or command used to launch Python services (e.g. python, python3, C:\…\python.exe)"
        >
          <input
            ref={inputRef}
            type="text"
            className="text-sm mono px-2 py-1 rounded"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              width: 200,
            }}
            value={draftPythonPath}
            onChange={(e) => setDraftPythonPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') inputRef.current?.blur() }}
            spellCheck={false}
          />
        </SettingRow>

        {services.length === 0 ? (
          <div
            className="px-4 py-3 text-sm"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            No services registered
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Service
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc) => {
                  const toggleColor = svc.enabled && svc.running ? 'green' : svc.enabled ? 'red' : 'gray'
                  return (
                    <tr
                      key={svc.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <div className="font-medium">{svc.name}</div>
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {svc.description}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            opacity: svc.enabled ? 1 : 0.6,
                          }}
                        >
                          {svc.enabled ? (svc.running ? 'running' : 'stopped') : 'disabled'}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'right',
                        }}
                      >
                        <Toggle color={toggleColor} checked={svc.enabled} onChange={() => handleToggleService(svc)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  color = 'gray',
  onChange,
}: {
  checked: boolean
  color?: 'green' | 'red' | 'gray'
  onChange: () => void
}): JSX.Element {
  const colorMap = {
    green: '#22c55e',
    red: '#ef4444',
    gray: 'var(--color-border)',
  }

  return (
    <button
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? colorMap[color] : colorMap.gray,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 150ms',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          transition: 'left 150ms',
          display: 'block',
        }}
      />
    </button>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PageHeader({ title }: { title: string }): JSX.Element {
  return (
    <h1
      className="text-xl font-semibold mb-7 tracking-tight"
      style={{ color: 'var(--color-text-primary)' }}
    >
      {title}
    </h1>
  )
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="mb-8">
      <h2
        className="text-base font-semibold mb-4"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  helper,
  children,
  last = false,
}: {
  label: string
  helper?: string
  children: React.ReactNode
  last?: boolean
}): JSX.Element {
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <div>
        <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        {helper && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {helper}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
