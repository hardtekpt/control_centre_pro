import type { PresetSwitcherRule, SonarConfig } from '@shared/types'
import { MonogramTile } from '../AppChip'

interface NowActiveCardProps {
  activeProcessName: string
  matchedRule: PresetSwitcherRule | undefined
  autoPilot: boolean
  configs: SonarConfig[]
}

export function NowActiveCard({ activeProcessName, matchedRule, autoPilot, configs }: NowActiveCardProps): JSX.Element {
  const hasActive = !!activeProcessName

  // Resolve preset name from matched rule
  const matchedPresetName = matchedRule?.presetId
    ? (configs.find((c) => c.id === matchedRule.presetId)?.name ?? matchedRule.presetId)
    : undefined

  // Status tag + copy
  let tag: string
  let resultName: string
  let resultSub: string
  if (!hasActive) {
    tag = '→ IDLE'
    resultName = 'No active window'
    resultSub = ''
  } else if (autoPilot && matchedRule && matchedPresetName) {
    tag = '→ APPLIED'
    resultName = matchedPresetName
    resultSub = 'via rule'
  } else if (!autoPilot) {
    tag = '→ MANUAL'
    resultName = 'Auto off'
    resultSub = 'rules paused'
  } else {
    tag = '→ FALLBACK'
    resultName = 'No rule matched'
    resultSub = 'default preset'
  }

  const displayName = activeProcessName
    ? activeProcessName.replace(/\.(exe|app)$/i, '')
    : 'Nothing'

  return (
    <div className="sn-aps-now">
      <div className="sn-aps-label">Now active</div>

      <div className="sn-now-card">
        <div className="sn-now-app">
          <MonogramTile name={displayName} processName={activeProcessName || 'idle'} size="md" />
          <div className="sn-now-meta">
            <div className="sn-now-name" title={activeProcessName}>{displayName || '—'}</div>
            <div className="sn-now-sub">foreground process</div>
          </div>
        </div>

        <div className="sn-now-result">
          <span className="sn-now-result-tag">{tag}</span>
          <span className="sn-now-result-name">{resultName}</span>
          {resultSub && <span className="sn-now-result-sub">{resultSub}</span>}
        </div>
      </div>
    </div>
  )
}
