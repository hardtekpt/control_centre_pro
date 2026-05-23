import { useSonarStore } from '../../../stores/sonarStore'
import { STATIC_PRESETS, type StaticPresetId } from '../data/catalogues'
import '../sonar.css'

// ── Preset icons (14 px, same glyphs as reference gg-sonar-icons.jsx) ───────

function IconMusic(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="16" r="2.2" />
    </svg>
  )
}

function IconGame(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="7" width="19" height="10" rx="4" />
      <path d="M7 12h3M8.5 10.5v3" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="17" cy="13" r="1" fill="currentColor" />
    </svg>
  )
}

function IconStudio(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v6M8 14v6M14 4v10M14 18v2" />
      <circle cx="8" cy="11.5" r="1.5" fill="currentColor" />
      <circle cx="14" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconCinema(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M3 15h18M8 5v14M16 5v14" />
    </svg>
  )
}

function IconSpeech(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h2M8 9v6M11 7v10M14 10v4M17 12h3" />
    </svg>
  )
}

function IconFlat(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h18" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

const PRESET_ICONS: Record<StaticPresetId, () => JSX.Element> = {
  music:  IconMusic,
  game:   IconGame,
  studio: IconStudio,
  cinema: IconCinema,
  speech: IconSpeech,
  flat:   IconFlat,
}

// ── Component ────────────────────────────────────────────────────────────────

interface PresetChipsProps {
  /** Highlighted chip */
  active?: StaticPresetId
  /** When autoPilot is true and a rule matched, this preset shows a green dot */
  autoPreset?: StaticPresetId
  autoPilot?: boolean
  onPick?: (id: StaticPresetId) => void
}

export function PresetChips({ active, autoPreset, autoPilot, onPick }: PresetChipsProps): JSX.Element {
  const visiblePresets = useSonarStore((s) => s.visiblePresets)

  const visibleList = STATIC_PRESETS.filter((p) => visiblePresets.has(p.id))

  return (
    <div className="sn-preset-row" role="tablist" aria-label="EQ presets">
      {visibleList.map((p) => {
        const isActive = p.id === active
        const isAuto   = autoPilot === true && p.id === autoPreset
        const Icon     = PRESET_ICONS[p.id]
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={isActive}
            className={`sn-preset-chip${isActive ? ' active' : ''}${isAuto ? ' auto' : ''}`}
            onClick={() => onPick?.(p.id)}
            title={isAuto ? 'Auto-selected by rule' : p.sub}
          >
            <span className="pc-icon"><Icon /></span>
            <span className="pc-label">{p.label}</span>
            <span className="pc-sub">{p.sub}</span>
            {isAuto && <span className="pc-auto-dot" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
