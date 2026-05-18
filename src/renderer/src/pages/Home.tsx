import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore } from '../stores/sonarStore'
import { CompactHeadsetCard } from '../components/home/CompactHeadsetCard'
import { CompactSonarCard } from '../components/home/CompactSonarCard'
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
  const { arctisState, ddcMonitors, settings } = useServiceStore()
  const { sonarState } = useSonarStore()

  const sortedMonitors = [...ddcMonitors].sort((a, b) => {
    if (a.is_primary === b.is_primary) return 0
    return a.is_primary ? -1 : 1
  })

  const showAudio = arctisState || sonarState?.available

  return (
    <div className="flex flex-col gap-6 p-6">
      {showAudio && (
        <HomeSection title="Audio">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '12px',
              alignItems: 'start',
            }}
          >
            {arctisState && <CompactHeadsetCard state={arctisState} />}
            {sonarState?.available && <CompactSonarCard />}
          </div>
        </HomeSection>
      )}
      {ddcMonitors.length > 0 && (
        <HomeSection title="Display">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '12px',
            }}
          >
            {sortedMonitors.map((monitor) => (
              <DisplayCard
                key={monitor.monitor_id}
                monitor={monitor}
                syncBrightness={settings.ddcSyncBrightness}
                allMonitors={ddcMonitors}
              />
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  )
}
