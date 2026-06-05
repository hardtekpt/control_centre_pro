import { useState, useEffect, useMemo } from 'react'
import type { PresetSwitcherRule, SonarState, OpenApp, ActiveWindowInfo } from '@shared/types'
import { Toggle } from '../../../../components/plugins/Toggle'
import { RuleRow } from './RuleRow'
import { AddRuleForm } from './AddRuleForm'
import '../../sonar.css'
import '../../../../components/gg-sonar/gg-sonar.css'

function generateId(): string {
  return crypto.randomUUID()
}

function LightningIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

interface AutoPresetSectionProps {
  sonarState: SonarState | null
  onAutoPresetChange?: (configId: string | undefined, autoPilot: boolean) => void
}

export function AutoPresetSection({ sonarState, onAutoPresetChange }: AutoPresetSectionProps): JSX.Element {
  const [rules, setRules] = useState<PresetSwitcherRule[]>([])
  const [autoPilot, setAutoPilot] = useState(false)
  const [activeProcessName, setActiveProcessName] = useState('')
  const [openApps, setOpenApps] = useState<OpenApp[]>([])
  const [loadingApps, setLoadingApps] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Load initial state
  useEffect(() => {
    window.api.getPresetSwitcherRules().then(setRules).catch(console.error)
    window.api.getPresetSwitcherEnabled().then(setAutoPilot).catch(console.error)
  }, [])

  // Subscribe to active window changes
  useEffect(() => {
    const cleanup = window.api.onActiveWindowChange((info: ActiveWindowInfo) => {
      setActiveProcessName(info.processName)
    })
    return cleanup
  }, [])

  // Subscribe to preset switcher enable/disable changes (from settings)
  useEffect(() => {
    const cleanup = window.api.onPresetSwitcherEnabledChange(setAutoPilot)
    return cleanup
  }, [])

  const configs = sonarState?.configs ?? []

  // Find matched rule for current active app
  const matchedRule = useMemo(
    () => rules.find((r) => r.enabled && r.appProcessName === activeProcessName),
    [rules, activeProcessName],
  )

  const existingProcessNames = useMemo(
    () => new Set(rules.map((r) => r.appProcessName)),
    [rules],
  )

  // Notify parent of autoPilot / matched-preset changes so PresetChips can show the green dot
  useEffect(() => {
    if (!onAutoPresetChange) return
    onAutoPresetChange(
      autoPilot && matchedRule?.presetId ? matchedRule.presetId : undefined,
      autoPilot,
    )
  }, [autoPilot, matchedRule, onAutoPresetChange])

  function saveRules(updated: PresetSwitcherRule[]): void {
    setRules(updated)
    window.api.setPresetSwitcherRules(updated).catch(console.error)
  }

  function handleToggleAuto(): void {
    const next = !autoPilot
    setAutoPilot(next)
    window.api.setPresetSwitcherEnabled(next).catch(console.error)
  }

  function handleUpdateRule(id: string, updated: PresetSwitcherRule): void {
    saveRules(rules.map((r) => (r.id === id ? updated : r)))
  }

  function handleRemoveRule(id: string): void {
    saveRules(rules.filter((r) => r.id !== id))
  }

  function handleAddRule(partial: Omit<PresetSwitcherRule, 'id'>): void {
    saveRules([...rules, { ...partial, id: generateId() }])
    setShowAddForm(false)
  }

  async function handleRefreshApps(): Promise<void> {
    setLoadingApps(true)
    try {
      setOpenApps(await window.api.getOpenApps())
    } catch (err) {
      console.error('[getOpenApps]', err)
    } finally {
      setLoadingApps(false)
    }
  }

  function handleShowAddForm(): void {
    if (!showAddForm) handleRefreshApps()
    setShowAddForm(true)
  }

  const activeDisplayName = activeProcessName
    ? activeProcessName.replace(/\.(exe|app)$/i, '')
    : null

  return (
    <div className="sn-aps">
      {/* Titlebar */}
      <div className="sn-aps-titlebar">
        <span className="sn-aps-ic"><LightningIcon /></span>
        <span className="sn-aps-title">Auto preset</span>
        {activeDisplayName && (
          <span className="sn-aps-active-app">{activeDisplayName}</span>
        )}

        <span className={`sn-aps-pill${autoPilot ? ' on' : ''}`}>
          {autoPilot && <span className="sn-aps-pulse-dot" />}
          {autoPilot ? 'AUTO ON' : 'AUTO OFF'}
        </span>

        {/* Toggle switch */}
        <Toggle checked={autoPilot} onChange={handleToggleAuto} size="sm" />
      </div>

      {/* Body: rules grid */}
      <div className="sn-aps-body">
        <div className="sn-aps-rules">
          <div className="sn-rules-header">
            <span className="sn-aps-label">Rules</span>
            <span className="sn-rules-count">{rules.length}</span>
            {!autoPilot && <span className="sn-rules-paused">paused</span>}
          </div>

          <div className="sn-rules-grid">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                isActive={autoPilot && rule.appProcessName === activeProcessName && rule.enabled}
                configs={configs}
                onUpdate={(updated) => handleUpdateRule(rule.id, updated)}
                onRemove={() => handleRemoveRule(rule.id)}
              />
            ))}

            {showAddForm ? (
              <AddRuleForm
                openApps={openApps}
                loadingApps={loadingApps}
                configs={configs}
                existingProcessNames={existingProcessNames}
                onAdd={handleAddRule}
                onCancel={() => setShowAddForm(false)}
                onRefreshApps={handleRefreshApps}
              />
            ) : (
              <button
                className="sn-add-rule-btn"
                onClick={handleShowAddForm}
                disabled={!sonarState?.available}
                title={sonarState?.available ? undefined : 'Sonar not connected'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {existingProcessNames.size > 0 && rules.length >= 10
                  ? 'Limit reached'
                  : 'Add rule'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
