export function AppSettings(): JSX.Element {
  return (
    <div>
      <h2
        className="text-lg font-semibold mb-1 tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        App
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        Application-level settings.
      </p>
      <div
        className="px-5 py-4 rounded-lg text-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
      >
        No app settings configured yet.
      </div>
    </div>
  )
}
