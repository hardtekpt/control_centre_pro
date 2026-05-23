import { useState } from 'react'
import { STATIC_PRESETS, type StaticPresetId } from '../data/catalogues'
import '../sonar.css'

interface PresetChipsProps {
  /** Highlighted chip (treated as a local display hint — visual only, not wired to API) */
  active?: StaticPresetId
  /** When autoPilot is true and a rule matched, this preset shows a green dot */
  autoPreset?: StaticPresetId
  autoPilot?: boolean
}

export function PresetChips({ active, autoPreset, autoPilot }: PresetChipsProps): JSX.Element {
  const [localActive, setLocalActive] = useState<StaticPresetId | undefined>(active)

  const effectiveActive = active ?? localActive

  return (
    <div className="sn-preset-row" role="tablist" aria-label="EQ presets">
      {STATIC_PRESETS.map((p) => {
        const isActive = p.id === effectiveActive
        const isAuto = autoPilot === true && p.id === autoPreset
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={isActive}
            className={`sn-preset-chip${isActive ? ' active' : ''}`}
            onClick={() => setLocalActive(p.id)}
            title={isAuto ? 'Auto-selected by rule' : p.sub}
          >
            <span className="pc-label">{p.label}</span>
            <span className="pc-sub">{p.sub}</span>
            {isAuto && <span className="pc-auto-dot" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
