import { useAppStore } from '../../stores/appStore'
import { useServiceStore } from '../../stores/serviceStore'
import type { ServiceInfo } from '@shared/types'

type Theme = 'light' | 'dark' | 'system'

// ─── General settings page ────────────────────────────────────────────────────

export function GeneralSettings(): JSX.Element {
  const { theme, setTheme } = useAppStore()
  const { services } = useServiceStore()

  function handleToggleService(svc: ServiceInfo): void {
    window.api.setServiceEnabled(svc.id, !svc.enabled)
  }

  return (
    <div className="max-w-lg">
      <PageHeader
        title="General"
        description="App-wide preferences and display settings"
      />

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
        {services.length === 0 ? (
          <div
            className="px-4 py-3 text-sm"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
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
                    color: svc.running ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
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

function PageHeader({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="mb-7">
      <h2
        className="text-lg font-semibold mb-1 tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>
    </div>
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
    <section className="mb-6">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h3>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-border)' }}
      >
        {children}
      </div>
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
      className="flex items-center justify-between px-4 py-3"
      style={{
        background: 'var(--color-surface)',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <div>
        <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        {helper && (
          <div
            className="text-xs mt-0.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {helper}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
