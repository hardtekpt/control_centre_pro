/**
 * Home page — the landing screen shown on app start.
 * Currently a placeholder; future iterations will show a device/service dashboard.
 */
export function Home(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      {/* Logo mark */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        C
      </div>

      {/* Headline */}
      <div>
        <h1
          className="text-2xl font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Control Centre Pro
        </h1>
        <p
          className="text-sm max-w-sm"
          style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}
        >
          Hardware device management and custom service runner for Windows.
          <br />
          Your devices and services will appear here.
        </p>
      </div>

      {/* Empty state card */}
      <div
        className="mt-2 px-5 py-3 rounded-lg text-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
      >
        No devices or services configured yet — use the sidebar to get started
      </div>
    </div>
  )
}
