import { useState, useRef } from 'react'
import { useServiceStore } from '../stores/serviceStore'
import { HeadsetCard } from '../components/home/HeadsetCard'
import { AudioOptionsPanel } from '../components/home/AudioOptionsPanel'
import { WirelessAudioPanel } from '../components/home/WirelessAudioPanel'
import { BaseStationPanel } from '../components/home/BaseStationPanel'
import { EqPanel } from '../components/home/EqPanel'
import { MainPageHeader, type FilterChipDef } from '../components/MainPageHeader'

type ArctisFilter = 'all' | 'audio' | 'wireless' | 'eq'

const ARCTIS_CHIPS: FilterChipDef[] = [
  { id: 'all',      label: 'All' },
  { id: 'audio',    label: 'Audio' },
  { id: 'wireless', label: 'Wireless' },
  { id: 'eq',       label: 'EQ' },
]

const PANEL_TERMS: Record<string, string> = {
  headset:  'headset arctis status battery',
  audio:    'audio options sidetone chatmix volume',
  wireless: 'wireless 2.4ghz link',
  base:     'base station dock',
  eq:       'equalizer eq bands',
}

export function Arctis(): JSX.Element {
  const { arctisState } = useServiceStore()
  const [filter, setFilter] = useState<ArctisFilter>('all')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  if (!arctisState) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ color: 'var(--color-text-secondary)' }}>Arctis Nova Pro not connected</span>
      </div>
    )
  }

  const panelStyle = !arctisState.baseStationConnected
    ? { opacity: 0.4, pointerEvents: 'none' as const }
    : undefined

  const q = search.toLowerCase().trim()
  const matches = (key: string): boolean => !q || PANEL_TERMS[key].includes(q)

  const showHeadset  = (filter === 'all' || filter === 'audio')    && matches('headset')
  const showAudio    = (filter === 'all' || filter === 'audio')    && matches('audio')
  const showWireless = (filter === 'all' || filter === 'wireless') && matches('wireless')
  const showBase     = (filter === 'all' || filter === 'wireless') && matches('base')
  const showEq       = (filter === 'all' || filter === 'eq')       && matches('eq')

  const arctisSubtitle = `Battery ${arctisState.batteryHeadset}% · ${arctisState.wirelessConnected ? 'Wireless connected' : 'Headset offline'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <MainPageHeader
        title="Arctis Nova Pro"
        subtitle={arctisSubtitle}
        chips={ARCTIS_CHIPS}
        activeChip={filter}
        onChipSelect={(id) => setFilter(id as ArctisFilter)}
        searchValue={search}
        onSearchChange={setSearch}
        searchRef={searchRef}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {showHeadset && (
          <div style={panelStyle}>
            <HeadsetCard state={arctisState} expandByDefault={true} />
          </div>
        )}
        {(showAudio || showWireless) && (
          <div style={{ display: 'grid', gridTemplateColumns: showAudio && showWireless ? '1fr 1fr' : '1fr', gap: '24px', alignItems: 'start', ...panelStyle }}>
            {showAudio    && <AudioOptionsPanel state={arctisState} expandByDefault={true} />}
            {showWireless && <WirelessAudioPanel state={arctisState} />}
          </div>
        )}
        {showBase && (
          <div style={panelStyle}>
            <BaseStationPanel state={arctisState} expandByDefault={true} />
          </div>
        )}
        {showEq && (
          <div style={panelStyle}>
            <EqPanel state={arctisState} expandByDefault={true} />
          </div>
        )}
      </div>
    </div>
  )
}
