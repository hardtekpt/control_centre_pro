import { useSonarStore } from '../../../stores/sonarStore'
import type { SonarApiPresetId, UserPresetChip } from '../data/catalogues'
import '../sonar.css'

// ── Preset icons (14 px) ──────────────────────────────────────────────────────

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

export const PRESET_ICONS: Record<SonarApiPresetId, () => JSX.Element> = {
  music:  IconMusic,
  game:   IconGame,
  studio: IconStudio,
  cinema: IconCinema,
  speech: IconSpeech,
  flat:   IconFlat,
}

// ── Component ────────────────────────────────────────────────────────────────

interface PresetChipsProps {
  /** uid of the currently active chip */
  activeUid?: string
  /** When autoPilot is true and a rule matched, the chip with this sonarPresetId shows a green dot */
  autoPresetId?: SonarApiPresetId
  autoPilot?: boolean
  onPick?: (chip: UserPresetChip) => void
}

export function PresetChips({ activeUid, autoPresetId, autoPilot, onPick }: PresetChipsProps): JSX.Element {
  const presetChips = useSonarStore((s) => s.presetChips)

  return (
    <div className="sn-preset-row" role="tablist" aria-label="EQ presets">
      {presetChips.map((chip) => {
        const isActive = chip.uid === activeUid
        const isAuto   = autoPilot === true && chip.sonarPresetId === autoPresetId
        const Icon     = PRESET_ICONS[chip.iconKey]
        return (
          <button
            key={chip.uid}
            role="tab"
            aria-selected={isActive}
            className={`sn-preset-chip${isActive ? ' active' : ''}${isAuto ? ' auto' : ''}`}
            onClick={() => onPick?.(chip)}
            title={isAuto ? 'Auto-selected by rule' : chip.sub}
          >
            <span className="pc-icon"><Icon /></span>
            <span className="pc-label">{chip.label}</span>
            <span className="pc-sub">{chip.sub}</span>
            {isAuto && <span className="pc-auto-dot" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
