export function DDCSettings(): JSX.Element {
  return (
    <div>
      <h2
        className="text-lg font-semibold mb-1 tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        DDC
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        DDC/CI monitor control settings.
      </p>
      <div
        className="px-5 py-4 rounded-lg text-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
      >
        No DDC settings configured yet.
      </div>
    </div>
  )
}
