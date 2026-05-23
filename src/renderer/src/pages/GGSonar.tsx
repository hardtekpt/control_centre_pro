import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSonarStore } from '../stores/sonarStore'
import { useAppStore } from '../stores/appStore'
import { MainPageHeader } from '../components/MainPageHeader'
import { PresetChips } from '../features/sonar/components/PresetChips'
import { ChannelMixer } from '../features/sonar/components/ChannelMixer'
import { AutoPresetSection } from '../features/sonar/components/AutoPreset/AutoPresetSection'
import type { UserPresetChip } from '../features/sonar/data/catalogues'
import { notifySonarPresetChange } from '../lib/notifyFromEvent'

// ─── Unavailable state ────────────────────────────────────────────────────────

function UnavailableState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center gap-5 p-8 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', minHeight: 220 }}
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
      width="28" height="28" viewBox="0 0 14 14" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <circle cx="7" cy="7" r="1.5" />
      <path d="M4 7a3 3 0 0 0 6 0M2 7a5 5 0 0 0 10 0" />
    </svg>
  )
}

function SettingsIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ExternalLinkIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

// ─── GGSonar page ─────────────────────────────────────────────────────────────

export function GGSonar(): JSX.Element {
  const sonarState    = useSonarStore((s) => s.sonarState)
  const setSonarState = useSonarStore((s) => s.setSonarState)
  const presetChips   = useSonarStore((s) => s.presetChips)
  const setActivePreset = useSonarStore((s) => s.setActivePreset)
  const { setView, setSettingsTab } = useAppStore()

  const [search, setSearch] = useState('')
  const [autoPilot, setAutoPilot] = useState(false)
  const [autoConfigId, setAutoConfigId] = useState<string | undefined>(undefined)

  useEffect(() => {
    window.api.sonarGetState().then(setSonarState).catch(console.error)
  }, [setSonarState])

  // Chips whose specific (channel, configName) config is currently selected in the API
  const activeUids = useMemo((): Set<string> => {
    const configs = sonarState?.configs ?? []
    const result = new Set<string>()
    for (const chip of presetChips) {
      const config = configs.find(
        (c) => c.virtualAudioDevice === chip.virtualAudioDevice && c.name === chip.configName
      )
      if (config?.isSelected) result.add(chip.uid)
    }
    return result
  }, [sonarState, presetChips])

  // Chips that match the auto-preset monitor's current matched config
  const autoUids = useMemo((): Set<string> => {
    if (!autoPilot || !autoConfigId) return new Set()
    const config = (sonarState?.configs ?? []).find((c) => c.id === autoConfigId)
    if (!config) return new Set()
    const result = new Set<string>()
    for (const chip of presetChips) {
      if (chip.virtualAudioDevice === config.virtualAudioDevice && chip.configName === config.name) {
        result.add(chip.uid)
      }
    }
    return result
  }, [autoPilot, autoConfigId, sonarState, presetChips])

  // Callback from AutoPresetSection to keep green-dot in sync
  const handleAutoPresetChange = useCallback((configId: string | undefined, pilot: boolean) => {
    setAutoPilot(pilot)
    setAutoConfigId(configId)
  }, [])

  // Apply the chip's specific config on its specific channel
  const handlePickChip = useCallback((chip: UserPresetChip): void => {
    const config = (sonarState?.configs ?? []).find(
      (c) => c.virtualAudioDevice === chip.virtualAudioDevice && c.name === chip.configName
    )
    if (!config) return
    window.api.sonarSelectPreset(config.id).catch(console.error)
    setActivePreset(config.virtualAudioDevice, config.id)
    notifySonarPresetChange(chip.label)
  }, [sonarState, setActivePreset])

  function handleRetry(): void {
    window.api.sonarGetState().then(setSonarState).catch(console.error)
  }

  const available = sonarState?.available ?? false

  const trailingActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <button
        onClick={() => window.api.openSteelSeriesGG().catch(console.error)}
        title="Open SteelSeries GG"
        className="rounded flex items-center justify-center"
        style={{
          width: 22, height: 22,
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <ExternalLinkIcon />
      </button>
      <button
        onClick={() => { setSettingsTab('gg-sonar'); setView('settings') }}
        title="GG Sonar settings"
        className="rounded flex items-center justify-center"
        style={{
          width: 22, height: 22,
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
  )

  const liveCount = available
    ? Object.values(sonarState?.classic?.devices ?? {}).filter((d) => !d.classic.muted).length
    : 0

  const subtitle = available
    ? `${liveCount} channels live`
    : 'Not detected'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Header */}
      <MainPageHeader
        title="GG Sonar"
        subtitle={subtitle}
        searchValue={search}
        onSearchChange={setSearch}
        trailingActions={trailingActions}
      />

      {/* Preset chips — sticky below header */}
      <PresetChips
        activeUids={activeUids}
        autoUids={autoUids}
        autoPilot={autoPilot}
        onPick={handlePickChip}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mixer */}
        {available && sonarState ? (
          <ChannelMixer sonarState={sonarState} />
        ) : (
          <div style={{ padding: '16px 20px' }}>
            <UnavailableState onRetry={handleRetry} />
          </div>
        )}

        {/* Auto preset section */}
        <AutoPresetSection sonarState={sonarState} onAutoPresetChange={handleAutoPresetChange} />
      </div>
    </div>
  )
}
