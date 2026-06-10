import { useState, useMemo } from 'react'
import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore } from '../stores/sonarStore'
import { useDiscordStore } from '../stores/discordStore'
import { CompactHeadsetCard } from '../components/home/CompactHeadsetCard'
import { CompactSonarCard } from '../components/home/CompactSonarCard'
import { DiscordCard } from '../components/home/DiscordCard'
import { DisplayCard } from '../components/home/DisplayCard'
import { HaHomeCard } from '../components/home/HaHomeCard'
import { MainPageHeader, type FilterChipDef } from '../components/MainPageHeader'

const HOME_CHIPS: FilterChipDef[] = [
  { id: 'all',        label: 'All' },
  { id: 'audio',      label: 'Audio' },
  { id: 'display',    label: 'Display' },
  { id: 'smart-home', label: 'Smart Home' },
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
  const arctisState        = useServiceStore(s => s.arctisState)
  const ddcMonitors        = useServiceStore(s => s.ddcMonitors)
  const syncBrightness     = useServiceStore(s => s.settings.ddcSyncBrightness)
  const discordShowHomeCard = useServiceStore(s => s.settings.discordShowHomeCard)
  const haHomeCardEnabled  = useServiceStore(s => s.settings.haHomeCardEnabled)
  const haHomeCardEntities = useServiceStore(s => s.settings.haHomeCardEntities)
  const sonarAvailable     = useSonarStore(s => s.sonarState?.available ?? false)
  const discordState       = useDiscordStore(s => s.discordState)
  const [activeChip, setActiveChip] = useState('all')
  const [search, setSearch] = useState('')

  const sortedMonitors = useMemo(
    () => [...ddcMonitors].sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1)),
    [ddcMonitors],
  )

  const showDiscord = discordShowHomeCard && (discordState?.available ?? false)
  const showAudio   = arctisState || sonarAvailable || showDiscord
  const showHa      = haHomeCardEnabled && haHomeCardEntities.length > 0

  const homeSubtitle = useMemo(() => {
    const count = (arctisState ? 1 : 0) + (sonarAvailable ? 1 : 0) + (showDiscord ? 1 : 0) + ddcMonitors.length + (showHa ? 1 : 0)
    return count === 0 ? 'No devices detected' : `${count} device${count !== 1 ? 's' : ''} connected`
  }, [arctisState, sonarAvailable, showDiscord, ddcMonitors.length, showHa])

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
              {sonarAvailable && <CompactSonarCard />}
              {showDiscord && <DiscordCard />}
            </div>
          </HomeSection>
        )}
        {ddcMonitors.length > 0 && (activeChip === 'all' || activeChip === 'display') && (
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
                  syncBrightness={syncBrightness}
                  allMonitors={ddcMonitors}
                />
              ))}
            </div>
          </HomeSection>
        )}
        {showHa && (activeChip === 'all' || activeChip === 'smart-home') && (
          <HomeSection title="Smart Home">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(320px, 480px)',
                gap: '12px',
                alignItems: 'start',
              }}
            >
              <HaHomeCard />
            </div>
          </HomeSection>
        )}
      </div>
    </div>
  )
}
