import { useServiceStore } from '../stores/serviceStore'
import { DisplayCard } from '../components/home/DisplayCard'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function HomeSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wider px-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────

export function Home(): JSX.Element {
  const { ddcMonitors } = useServiceStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      {ddcMonitors.length > 0 && (
        <HomeSection title="Display">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '12px',
            }}
          >
            {ddcMonitors.map((monitor) => (
              <DisplayCard key={monitor.monitor_id} monitor={monitor} />
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  )
}
