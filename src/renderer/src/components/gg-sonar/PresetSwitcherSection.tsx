import { useEffect, useState } from 'react'
import type { SonarState, PresetSwitcherRule, OpenApp, ActiveWindowInfo } from '@shared/types'

function generateId(): string {
  return crypto.randomUUID()
}

interface PresetSwitcherSectionProps {
  sonarState: SonarState | null
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36" />
    </svg>
  )
}

export function PresetSwitcherSection({ sonarState }: PresetSwitcherSectionProps): JSX.Element {
  const [rules, setRules] = useState<PresetSwitcherRule[]>([])
  const [activeWindow, setActiveWindow] = useState<string>('')
  const [openApps, setOpenApps] = useState<OpenApp[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loadingApps, setLoadingApps] = useState(false)
  const [newRule, setNewRule] = useState({
    appProcessName: '',
    displayName: '',
    channel: '',
    presetId: '',
  })

  // Load rules on mount
  useEffect(() => {
    window.api.getPresetSwitcherRules().then(setRules).catch(console.error)
  }, [])

  // Subscribe to active window changes
  useEffect(() => {
    const cleanup = window.api.onActiveWindowChange((info: ActiveWindowInfo) => {
      setActiveWindow(info.processName)
    })
    return cleanup
  }, [])

  // Persist rules to main process
  const saveRules = (updatedRules: PresetSwitcherRule[]): void => {
    setRules(updatedRules)
    window.api.setPresetSwitcherRules(updatedRules).catch(console.error)
  }

  const handleToggleRule = (id: string): void => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    saveRules(updated)
  }

  const handleDeleteRule = (id: string): void => {
    saveRules(rules.filter((r) => r.id !== id))
  }

  const handleLoadOpenApps = async (): Promise<void> => {
    setLoadingApps(true)
    try {
      const apps = await window.api.getOpenApps()
      setOpenApps(apps)
    } catch (err) {
      console.error('[getOpenApps] error:', err)
    } finally {
      setLoadingApps(false)
    }
  }

  const handleAddRule = (): void => {
    if (!newRule.appProcessName || !newRule.channel || !newRule.presetId) return

    const rule: PresetSwitcherRule = {
      id: generateId(),
      appProcessName: newRule.appProcessName,
      displayName: newRule.displayName || newRule.appProcessName,
      channel: newRule.channel,
      presetId: newRule.presetId,
      enabled: true,
    }

    saveRules([...rules, rule])
    setNewRule({ appProcessName: '', displayName: '', channel: '', presetId: '' })
    setShowAddForm(false)
  }

  const availableChannels = ['game', 'chatRender', 'chatCapture', 'media', 'aux'] as const
  const presetsForChannel = sonarState?.configs?.filter(
    (c) => c.virtualAudioDevice === newRule.channel
  ) ?? []

  const isAddFormValid =
    newRule.appProcessName && newRule.channel && newRule.presetId

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col gap-3"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header with active window and add button */}
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-medium"
          style={{
            color: activeWindow ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}
        >
          Active: <span className="font-semibold">{activeWindow || '(none detected)'}</span>
        </span>
        <button
          onClick={() => {
            if (!showAddForm) {
              handleLoadOpenApps()
            }
            setShowAddForm(!showAddForm)
          }}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: showAddForm ? 'var(--color-surface-raised)' : 'transparent',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          +
          Add Rule
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Rules list or empty state */}
      {rules.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
          <p
            className="text-xs"
            style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
          >
            No rules configured. Click "Add Rule" to automatically switch presets when apps open.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => {
            const preset = sonarState?.configs?.find((c) => c.id === rule.presetId)
            const channelLabel = rule.channel.charAt(0).toUpperCase() + rule.channel.slice(1)

            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 px-2 py-2 text-xs rounded transition-colors"
                style={{
                  background: 'var(--color-surface-raised)',
                }}
              >
                {/* App name */}
                <div className="flex-shrink-0 w-20">
                  <span
                    style={{ color: 'var(--color-text-primary)' }}
                    title={rule.displayName}
                  >
                    {rule.displayName}
                  </span>
                </div>

                {/* Channel */}
                <div className="flex-shrink-0 w-16">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {channelLabel}
                  </span>
                </div>

                {/* Preset */}
                <div className="flex-1 min-w-0">
                  <span
                    style={{
                      color: preset ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                    title={preset?.name}
                  >
                    {preset?.name || '(missing)'}
                  </span>
                </div>

                {/* Enable toggle */}
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors"
                  style={{
                    background: rule.enabled ? 'var(--color-accent)' : 'transparent',
                    border: `1px solid ${rule.enabled ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    cursor: 'pointer',
                  }}
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                >
                  {rule.enabled && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center transition-colors"
                  style={{
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Delete rule"
                >
                  <TrashIcon />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <div className="flex flex-col gap-2">
            {/* App dropdown with refresh */}
            <div className="flex items-center gap-2">
              <select
                value={newRule.appProcessName}
                onChange={(e) => {
                  const app = openApps.find((a) => a.processName === e.target.value)
                  setNewRule({
                    ...newRule,
                    appProcessName: e.target.value,
                    displayName: app?.displayName || e.target.value,
                  })
                }}
                className="flex-1 px-2 py-1.5 text-xs rounded"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select app…</option>
                {openApps.map((app) => (
                  <option key={app.processName} value={app.processName}>
                    {app.displayName}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleLoadOpenApps()}
                disabled={loadingApps}
                className="flex items-center justify-center px-1.5 py-1.5 rounded transition-opacity flex-shrink-0"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  cursor: loadingApps ? 'not-allowed' : 'pointer',
                  opacity: loadingApps ? 0.6 : 1,
                }}
                title="Refresh app list"
              >
                <RefreshIcon />
              </button>
            </div>

            {/* Channel dropdown */}
            <select
              value={newRule.channel}
              onChange={(e) => {
                setNewRule({ ...newRule, channel: e.target.value, presetId: '' })
              }}
              className="w-full px-2 py-1.5 text-xs rounded"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <option value="">Select channel…</option>
              {availableChannels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </option>
              ))}
            </select>

            {/* Preset dropdown (filtered by channel) */}
            <select
              value={newRule.presetId}
              onChange={(e) => setNewRule({ ...newRule, presetId: e.target.value })}
              disabled={!newRule.channel || presetsForChannel.length === 0}
              className="w-full px-2 py-1.5 text-xs rounded"
              style={{
                background: newRule.channel ? 'var(--color-surface)' : 'var(--color-border)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: newRule.channel && presetsForChannel.length > 0 ? 'pointer' : 'not-allowed',
                opacity: newRule.channel && presetsForChannel.length > 0 ? 1 : 0.6,
              }}
            >
              <option value="">Select preset…</option>
              {presetsForChannel.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>

            {/* Add and cancel buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRule}
                disabled={!isAddFormValid}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded transition-opacity"
                style={{
                  background: isAddFormValid ? 'var(--color-accent)' : 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  cursor: isAddFormValid ? 'pointer' : 'not-allowed',
                  opacity: isAddFormValid ? 1 : 0.5,
                }}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewRule({ appProcessName: '', displayName: '', channel: '', presetId: '' })
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded transition-colors"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
