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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
    <div className="flex flex-col gap-3">
      {/* Header with active window and add button */}
      <div className="flex items-center justify-between px-1">
        <span
          className="text-sm"
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
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-colors"
          style={{
            background: showAddForm ? 'var(--color-surface-raised)' : 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          <PlusIcon />
          Add Rule
        </button>
      </div>

      {/* Rules list or empty state */}
      {rules.length === 0 ? (
        <div
          className="rounded-lg flex flex-col items-center justify-center gap-4 p-6 text-center"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="w-10 h-10 rounded flex items-center justify-center"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <line x1="12" y1="16" x2="12" y2="8" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No preset rules configured
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
            >
              Add a rule to automatically switch presets when you open an app.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => {
            const preset = sonarState?.configs?.find((c) => c.id === rule.presetId)
            const channelLabel = rule.channel.charAt(0).toUpperCase() + rule.channel.slice(1)

            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* App name */}
                <div className="flex-shrink-0 w-24">
                  <span
                    className="text-sm font-medium truncate block"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {rule.displayName}
                  </span>
                </div>

                {/* Channel */}
                <div className="flex-shrink-0 w-24">
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {channelLabel}
                  </span>
                </div>

                {/* Preset */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-sm truncate block"
                    style={{
                      color: preset ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {preset?.name || '(missing)'}
                  </span>
                </div>

                {/* Enable toggle */}
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors"
                  style={{
                    background: rule.enabled ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                >
                  {rule.enabled && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-500 hover:bg-opacity-10"
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
        <div
          className="rounded-md p-3 flex flex-col gap-3"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Select an app
            </span>
            <button
              onClick={() => handleLoadOpenApps()}
              disabled={loadingApps}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-opacity"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: loadingApps ? 'not-allowed' : 'pointer',
                opacity: loadingApps ? 0.6 : 1,
              }}
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>

          {/* App dropdown */}
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
            className="w-full px-2 py-1.5 text-sm rounded"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            <option value="">Select an app...</option>
            {openApps.map((app) => (
              <option key={app.processName} value={app.processName}>
                {app.displayName}
              </option>
            ))}
          </select>

          {/* Channel dropdown */}
          <select
            value={newRule.channel}
            onChange={(e) => {
              setNewRule({ ...newRule, channel: e.target.value, presetId: '' })
            }}
            className="w-full px-2 py-1.5 text-sm rounded"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            <option value="">Select a channel...</option>
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
            className="w-full px-2 py-1.5 text-sm rounded"
            style={{
              background: newRule.channel ? 'var(--color-surface-raised)' : 'var(--color-border)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              cursor: newRule.channel && presetsForChannel.length > 0 ? 'pointer' : 'not-allowed',
              opacity: newRule.channel && presetsForChannel.length > 0 ? 1 : 0.6,
            }}
          >
            <option value="">Select a preset...</option>
            {presetsForChannel.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>

          {/* Add button and cancel */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRule}
              disabled={!isAddFormValid}
              className="flex-1 px-3 py-2 text-sm font-medium rounded transition-opacity"
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
              className="flex-1 px-3 py-2 text-sm rounded transition-colors"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
