export function GGSonarSettings(): JSX.Element {
  return (
    <div>
      <h2
        className="text-lg font-semibold mb-1 tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        GG Sonar
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        GG Sonar integration settings.
      </p>
      <div
        className="px-5 py-4 rounded-lg text-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
      >
        No GG Sonar settings configured yet.
      </div>
    </div>
  )
}
