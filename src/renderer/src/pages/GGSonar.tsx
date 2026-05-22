import { useEffect, useState } from 'react'
import { useSonarStore } from '../stores/sonarStore'
import { useAppStore } from '../stores/appStore'
import { ChannelMixer } from '../components/gg-sonar/ChannelMixer'
import { PresetSwitcherSection } from '../components/gg-sonar/PresetSwitcherSection'
import { MainPageHeader, type FilterChipDef } from '../components/MainPageHeader'

const SONAR_CHIPS: FilterChipDef[] = [
  { id: 'all',     label: 'All' },
  { id: 'mixer',   label: 'Mixer' },
  { id: 'presets', label: 'Preset Switcher' },
]

// ─── Section wrapper (matches Home.tsx pattern) ───────────────────────────────

function SettingsIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ExternalLinkIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function HomeSection({
  title,
  action,
  children,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ─── Unavailable state ────────────────────────────────────────────────────────

function UnavailableState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center gap-5 p-8 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', minHeight: 200 }}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
      >
        <SonarIcon />
      </div>
      <div>
        <h1
          className="text-xl font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          GG Sonar Not Detected
        </h1>
        <p
          className="text-sm max-w-xs mx-auto"
          style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}
        >
          Make sure SteelSeries GG is running with Sonar enabled. The app will connect automatically.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="text-sm px-4 py-2 rounded"
        style={{
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        ↺ Check Again
      </button>
    </div>
  )
}

function SonarIcon(): JSX.Element {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <circle cx="7" cy="7" r="1.5" />
      <path d="M4 7a3 3 0 0 0 6 0M2 7a5 5 0 0 0 10 0" />
    </svg>
  )
}

// ─── GGSonar page ─────────────────────────────────────────────────────────────

export function GGSonar(): JSX.Element {
  const sonarState    = useSonarStore(s => s.sonarState)
  const setSonarState = useSonarStore(s => s.setSonarState)
  const { setView, setSettingsTab } = useAppStore()

  const [presetSwitcherEnabled, setPresetSwitcherEnabled] = useState(true)
  const [activeChip, setActiveChip] = useState('all')
  const [search, setSearch] = useState('')

  // Fetch fresh state on page mount (covers navigation to this page)
  useEffect(() => {
    window.api.sonarGetState().then(setSonarState).catch(console.error)
    window.api.getPresetSwitcherEnabled().then(setPresetSwitcherEnabled).catch(console.error)
  }, [setSonarState])

  // Subscribe to preset switcher enabled changes
  useEffect(() => {
    const cleanup = window.api.onPresetSwitcherEnabledChange(setPresetSwitcherEnabled)
    return cleanup
  }, [])

  function handleRetry(): void {
    window.api.sonarGetState().then(setSonarState).catch(console.error)
  }

  const available = sonarState?.available ?? false
  const sonarSubtitle = `${available ? 'Connected' : 'Not detected'} · Preset switcher ${presetSwitcherEnabled ? 'on' : 'off'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <MainPageHeader
        title="GG Sonar"
        subtitle={sonarSubtitle}
        chips={SONAR_CHIPS}
        activeChip={activeChip}
        onChipSelect={setActiveChip}
        searchValue={search}
        onSearchChange={setSearch}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <HomeSection
        title={
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              title={available ? 'Sonar connected' : 'Sonar not detected'}
              style={{ background: available ? 'var(--color-ok)' : 'var(--color-text-secondary)' }}
            />
            <span>Mixer</span>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            {!available && (
              <button
                onClick={handleRetry}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                ↺ Retry
              </button>
            )}
            {/* Open SteelSeries GG app */}
            <button
              onClick={() => {
                console.log('Opening SteelSeries GG...')
                window.api.openSteelSeriesGG().catch((err) => {
                  console.error('Failed to open SteelSeries GG:', err)
                })
              }}
              title="Open SteelSeries GG"
              className="rounded flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ExternalLinkIcon />
            </button>
            {/* GG Sonar settings shortcut */}
            <button
              onClick={() => { setSettingsTab('gg-sonar'); setView('settings') }}
              title="GG Sonar settings"
              className="rounded flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <SettingsIcon />
            </button>
          </div>
        }
      >
        {available && sonarState ? (
          <ChannelMixer sonarState={sonarState} />
        ) : (
          <UnavailableState onRetry={handleRetry} />
        )}
      </HomeSection>

      <HomeSection
        title={
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              title={presetSwitcherEnabled ? 'Preset switcher enabled' : 'Preset switcher disabled'}
              style={{ background: presetSwitcherEnabled ? 'var(--color-ok)' : 'var(--color-text-secondary)' }}
            />
            <span>Preset Switcher</span>
          </div>
        }
      >
        <PresetSwitcherSection sonarState={sonarState} />
      </HomeSection>
      </div>
    </div>
  )
}
