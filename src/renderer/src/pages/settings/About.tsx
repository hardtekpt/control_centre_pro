/** About page — version and build information */
export function About(): JSX.Element {
  return (
    <div className="max-w-lg">
      <div className="mb-7">
        <h2
          className="text-lg font-semibold mb-1 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          About
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Control Centre Pro version and build information
        </p>
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-border)' }}
      >
        {[
          { label: 'Version', value: '0.1.0' },
          { label: 'Platform', value: 'Windows' },
          { label: 'Framework', value: 'Electron + React' },
          { label: 'Build', value: 'Development' },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: 'var(--color-surface)',
              borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {row.label}
            </span>
            <span
              className="text-sm mono"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
