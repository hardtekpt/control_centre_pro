import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useServiceStore } from '../../stores/serviceStore'
import type { ServiceInfo } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

// ─── General settings page ────────────────────────────────────────────────────

export function GeneralSettings(): JSX.Element {
  const { theme, setTheme } = useAppStore()
  const { services } = useServiceStore()

  // Python path input — local state so edits don't round-trip through IPC
  const [pythonPath, setPythonPathLocal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getServiceConfig().then((cfg) => setPythonPathLocal(cfg.pythonPath))
  }, [])

  function handleToggleService(svc: ServiceInfo): void {
    window.api.setServiceEnabled(svc.id, !svc.enabled)
  }

  function handleApplyPythonPath(): void {
    const val = pythonPath.trim()
    if (val) window.api.setPythonPath(val)
  }

  function handlePythonPathKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') handleApplyPythonPath()
    if (e.key === 'Escape') inputRef.current?.blur()
  }

  return (
    <div>
      <PageHeader title="General" />

      <SettingsSection title="Appearance">
        <SettingRow
          label="Theme"
          helper="Choose the color scheme for the application"
          last
        >
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
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
      </SettingsSection>

      <SettingsSection title="Services">
        {/* Python interpreter path — applies to all Python-based services */}
        <SettingRow
          label="Python executable"
          helper="Path or command used to launch Python services (e.g. python, python3, C:\…\python.exe)"
        >
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              className="text-sm mono px-2 py-1 rounded"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: 180,
              }}
              value={pythonPath}
              onChange={(e) => setPythonPathLocal(e.target.value)}
              onKeyDown={handlePythonPathKeyDown}
              spellCheck={false}
            />
            <button
              onClick={handleApplyPythonPath}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
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
          services.map((svc, i) => (
            <SettingRow
              key={svc.id}
              label={svc.name}
              helper={svc.description}
              last={i === services.length - 1}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs mono"
                  style={{
                    color: 'var(--color-text-secondary)',
                    opacity: svc.enabled ? 1 : 0.5,
                  }}
                >
                  {svc.running ? 'running' : 'stopped'}
                </span>
                <Toggle checked={svc.enabled} onChange={() => handleToggleService(svc)} />
              </div>
            </SettingRow>
          ))
        )}
      </SettingsSection>
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}): JSX.Element {
  return (
    <button
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--color-accent)' : 'var(--color-border)',
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
