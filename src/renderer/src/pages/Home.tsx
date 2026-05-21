import { useState } from 'react'
import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore } from '../stores/sonarStore'
import { CompactHeadsetCard } from '../components/home/CompactHeadsetCard'
import { CompactSonarCard } from '../components/home/CompactSonarCard'
import { DisplayCard } from '../components/home/DisplayCard'
import { MainPageHeader, type FilterChipDef } from '../components/MainPageHeader'

const HOME_CHIPS: FilterChipDef[] = [
  { id: 'all',     label: 'All' },
  { id: 'audio',   label: 'Audio' },
  { id: 'display', label: 'Display' },
]

// ─── Section wrapper ──────────────────────────────────────────────────────────

function HomeSection({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
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
  const [activeChip, setActiveChip] = useState('all')
  const [search, setSearch] = useState('')

  const sortedMonitors = [...ddcMonitors].sort((a, b) => {
    if (a.is_primary === b.is_primary) return 0
    return a.is_primary ? -1 : 1
  })

  const showAudio = arctisState || sonarState?.available

  const connectedCount =
    (arctisState ? 1 : 0) +
    (sonarState?.available ? 1 : 0) +
    ddcMonitors.length
  const homeSubtitle =
    connectedCount === 0
      ? 'No devices detected'
      : `${connectedCount} device${connectedCount !== 1 ? 's' : ''} connected`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <MainPageHeader
        title="Home"
        subtitle={homeSubtitle}
        chips={HOME_CHIPS}
        activeChip={activeChip}
        onChipSelect={setActiveChip}
        searchValue={search}
        onSearchChange={setSearch}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
    </div>
  )
}
