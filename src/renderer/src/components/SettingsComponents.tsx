import { Toggle } from './plugins/Toggle'

// ──── Settings page wrapper ───────────────────────────────────────────────

export function SettingsPageWrapper({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      {children}
    </div>
  )
}

// ──── Page header ─────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}): JSX.Element {
  return (
    <div className="pb-6 mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
      <h1
        className="text-lg font-semibold tracking-tight mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h1>
      {description && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      )}
    </div>
  )
}

// ──── Section card ────────────────────────────────────────────────────────

export function SettingSection({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div
      className="rounded-lg overflow-hidden mb-4"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {(title || description) && (
        <div
          className="px-5 py-3.5 border-b flex items-baseline gap-2.5"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {title && (
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

// ──── Setting row ─────────────────────────────────────────────────────────

export function SettingRow({
  label,
  description,
  children,
  stacked = false,
  last = false,
}: {
  label: string
  description?: string
  children: React.ReactNode
  stacked?: boolean
  last?: boolean
}): JSX.Element {
  const gridClass = stacked
    ? 'grid-cols-1 gap-2'
    : 'grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8'

  return (
    <div
      className={`grid ${gridClass} px-5 py-3.5 items-start`}
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <div>
        <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </label>
        {description && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      <div className={stacked ? '' : 'flex justify-end items-start'}>{children}</div>
    </div>
  )
}

// ──── Toggle wrapper ──────────────────────────────────────────────────────

export function ToggleSetting({
  checked,
  onChange,
  size = 'sm',
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'sm' | 'lg'
}): JSX.Element {
  return <Toggle checked={checked} onChange={onChange} size={size} />
}
