import { useEffect, useState } from 'react'
import type { SonarState, PresetSwitcherRule, MonitorInputAction, OpenApp, ActiveWindowInfo, DdcMonitor } from '@shared/types'
import './gg-sonar.css'

const INPUT_NAME_MAP: Record<string, string> = {
  '0x01': 'VGA 1',
  '0x02': 'VGA 2',
  '0x03': 'DVI 1',
  '0x04': 'DVI 2',
  '0x0f': 'DisplayPort 1',
  '0x10': 'DisplayPort 2',
  '0x11': 'HDMI 1',
  '0x12': 'HDMI 2',
  '0x1b': 'USB-C',
}

function inputLabel(hex: string): string {
  return INPUT_NAME_MAP[hex.toLowerCase()] ?? hex
}

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

function MonitorIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function SonarIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

const availableChannels = ['game', 'chatRender', 'chatCapture', 'media', 'aux'] as const

export function PresetSwitcherSection({ sonarState }: PresetSwitcherSectionProps): JSX.Element {
  const [rules, setRules] = useState<PresetSwitcherRule[]>([])
  const [activeWindow, setActiveWindow] = useState<string>('')
  const [openApps, setOpenApps] = useState<OpenApp[]>([])
  const [monitors, setMonitors] = useState<DdcMonitor[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loadingApps, setLoadingApps] = useState(false)
  const [newRule, setNewRule] = useState({
    appProcessName: '',
    displayName: '',
    channel: '',
    presetId: '',
    monitorActions: [] as MonitorInputAction[],
  })
  // In-progress monitor action being built in the form
  const [pendingMonitor, setPendingMonitor] = useState({ monitorId: -1, inputValue: '' })

  useEffect(() => {
    window.api.getPresetSwitcherRules().then(setRules).catch(console.error)
    window.api.ddcGetMonitors().then(setMonitors).catch(console.error)
  }, [])

  // Refresh monitors when DDC state changes
  useEffect(() => {
    const cleanup = window.api.onDdcUpdate((updated: DdcMonitor[]) => {
      setMonitors(updated)
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.api.onActiveWindowChange((info: ActiveWindowInfo) => {
      setActiveWindow(info.processName)
    })
    return cleanup
  }, [])

  const saveRules = (updatedRules: PresetSwitcherRule[]): void => {
    setRules(updatedRules)
    window.api.setPresetSwitcherRules(updatedRules).catch(console.error)
  }

  const handleToggleRule = (id: string): void => {
    saveRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
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

  const handleAddMonitorAction = (): void => {
    if (pendingMonitor.monitorId === -1 || !pendingMonitor.inputValue) return
    setNewRule((r) => ({
      ...r,
      monitorActions: [...r.monitorActions, { monitorId: pendingMonitor.monitorId, inputValue: pendingMonitor.inputValue }],
    }))
    setPendingMonitor({ monitorId: -1, inputValue: '' })
  }

  const handleRemoveMonitorAction = (index: number): void => {
    setNewRule((r) => ({
      ...r,
      monitorActions: r.monitorActions.filter((_, i) => i !== index),
    }))
  }

  const hasSonarAction = !!newRule.channel && !!newRule.presetId
  const hasMonitorAction = newRule.monitorActions.length > 0
  const isAddFormValid = !!newRule.appProcessName && (hasSonarAction || hasMonitorAction)

  const presetsForChannel = sonarState?.configs?.filter(
    (c) => c.virtualAudioDevice === newRule.channel
  ) ?? []

  const handleAddRule = (): void => {
    if (!isAddFormValid) return

    const rule: PresetSwitcherRule = {
      id: generateId(),
      appProcessName: newRule.appProcessName,
      displayName: newRule.displayName || newRule.appProcessName,
      enabled: true,
      ...(newRule.channel ? { channel: newRule.channel } : {}),
      ...(newRule.presetId ? { presetId: newRule.presetId } : {}),
      ...(newRule.monitorActions.length > 0 ? { monitorActions: newRule.monitorActions } : {}),
    }

    saveRules([...rules, rule])
    setNewRule({ appProcessName: '', displayName: '', channel: '', presetId: '', monitorActions: [] })
    setPendingMonitor({ monitorId: -1, inputValue: '' })
    setShowAddForm(false)
  }

  const selectStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
  }

  const disabledSelectStyle: React.CSSProperties = {
    background: 'var(--color-border)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    cursor: 'not-allowed',
    opacity: 0.6,
  }

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col gap-3"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
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
            if (!showAddForm) handleLoadOpenApps()
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
          + Add Rule
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Rules list */}
      {rules.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            No rules configured. Click "Add Rule" to automatically switch audio presets or monitor inputs when apps open.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => {
            const preset = sonarState?.configs?.find((c) => c.id === rule.presetId)

            return (
              <div
                key={rule.id}
                className="flex items-start gap-3 px-3 py-2 text-xs rounded"
                style={{ background: 'var(--color-surface-raised)' }}
              >
                {/* App name + actions */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }} title={rule.displayName}>
                    {rule.displayName}
                  </span>

                  {/* Sonar action */}
                  {rule.channel && rule.presetId && (
                    <span className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                      <SonarIcon />
                      {rule.channel.charAt(0).toUpperCase() + rule.channel.slice(1)}
                      {' → '}
                      <span style={{ color: preset ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {preset?.name ?? '(missing)'}
                      </span>
                    </span>
                  )}

                  {/* Monitor actions */}
                  {rule.monitorActions?.map((action, i) => {
                    const mon = monitors.find((m) => m.monitor_id === action.monitorId)
                    return (
                      <span key={i} className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                        <MonitorIcon />
                        {mon?.name ?? `Monitor ${action.monitorId}`}
                        {' → '}
                        <span style={{ color: 'var(--color-text-primary)' }}>{inputLabel(action.inputValue)}</span>
                      </span>
                    )
                  })}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className="toggle-track"
                  style={{
                    background: rule.enabled ? 'var(--color-text-primary)' : 'var(--color-border)',
                  }}
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                >
                  <span
                    className="toggle-thumb"
                    style={{
                      transform: rule.enabled ? 'translateX(14px)' : 'translateX(0)',
                      background: rule.enabled ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                    }}
                  />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center transition-colors mt-0.5"
                  style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}
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
          <div className="expand-in flex flex-col gap-2">

            {/* App dropdown */}
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
                style={selectStyle}
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
                className="flex items-center justify-center px-1.5 py-1.5 rounded flex-shrink-0"
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

            {/* ── Sonar preset action (optional) ── */}
            <div
              className="flex flex-col gap-1.5 px-2 py-2 rounded"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
            >
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <SonarIcon />
                Sonar preset <span style={{ opacity: 0.6 }}>(optional)</span>
              </span>

              <select
                value={newRule.channel}
                onChange={(e) => setNewRule({ ...newRule, channel: e.target.value, presetId: '' })}
                className="w-full px-2 py-1.5 text-xs rounded"
                style={selectStyle}
              >
                <option value="">No channel selected</option>
                {availableChannels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={newRule.presetId}
                onChange={(e) => setNewRule({ ...newRule, presetId: e.target.value })}
                disabled={!newRule.channel || presetsForChannel.length === 0}
                className="w-full px-2 py-1.5 text-xs rounded"
                style={!newRule.channel || presetsForChannel.length === 0 ? disabledSelectStyle : selectStyle}
              >
                <option value="">
                  {!newRule.channel
                    ? 'Select a channel first'
                    : presetsForChannel.length === 0
                      ? 'No presets for this channel'
                      : 'Select preset…'}
                </option>
                {presetsForChannel.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Monitor input actions (optional) ── */}
            <div
              className="flex flex-col gap-1.5 px-2 py-2 rounded"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
            >
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <MonitorIcon />
                Monitor inputs <span style={{ opacity: 0.6 }}>(optional)</span>
              </span>

              {/* Added monitor actions */}
              {newRule.monitorActions.map((action, i) => {
                const mon = monitors.find((m) => m.monitor_id === action.monitorId)
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="flex-1 text-xs px-2 py-1 rounded" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
                      {mon?.name ?? `Monitor ${action.monitorId}`} → {inputLabel(action.inputValue)}
                    </span>
                    <button
                      onClick={() => handleRemoveMonitorAction(i)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
                      style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )
              })}

              {/* Pending monitor action row */}
              {monitors.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={pendingMonitor.monitorId === -1 ? '' : String(pendingMonitor.monitorId)}
                    onChange={(e) => setPendingMonitor({ monitorId: Number(e.target.value), inputValue: '' })}
                    className="flex-1 px-2 py-1.5 text-xs rounded"
                    style={selectStyle}
                  >
                    <option value="">Select monitor…</option>
                    {monitors
                      .filter((m) => m.supports.includes('input_source'))
                      .map((m) => (
                        <option key={m.monitor_id} value={m.monitor_id}>
                          {m.name}{m.is_primary ? ' (primary)' : ''}
                        </option>
                      ))}
                  </select>

                  <select
                    value={pendingMonitor.inputValue}
                    onChange={(e) => setPendingMonitor((p) => ({ ...p, inputValue: e.target.value }))}
                    disabled={pendingMonitor.monitorId === -1}
                    className="flex-1 px-2 py-1.5 text-xs rounded"
                    style={pendingMonitor.monitorId === -1 ? disabledSelectStyle : selectStyle}
                  >
                    <option value="">Select input…</option>
                    {(monitors.find((m) => m.monitor_id === pendingMonitor.monitorId)?.available_inputs ?? []).map((hex) => (
                      <option key={hex} value={hex}>
                        {inputLabel(hex)}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleAddMonitorAction}
                    disabled={pendingMonitor.monitorId === -1 || !pendingMonitor.inputValue}
                    className="flex-shrink-0 text-xs px-2 py-1.5 rounded font-medium"
                    style={{
                      background: pendingMonitor.monitorId !== -1 && pendingMonitor.inputValue ? 'var(--color-accent)' : 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                      border: 'none',
                      cursor: pendingMonitor.monitorId !== -1 && pendingMonitor.inputValue ? 'pointer' : 'not-allowed',
                      opacity: pendingMonitor.monitorId !== -1 && pendingMonitor.inputValue ? 1 : 0.5,
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  No monitors with input source control detected.
                </span>
              )}
            </div>

            {/* Add and cancel */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRule}
                disabled={!isAddFormValid}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded"
                style={{
                  background: isAddFormValid ? 'var(--color-accent)' : 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  cursor: isAddFormValid ? 'pointer' : 'not-allowed',
                  opacity: isAddFormValid ? 1 : 0.5,
                }}
              >
                Add Rule
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewRule({ appProcessName: '', displayName: '', channel: '', presetId: '', monitorActions: [] })
                  setPendingMonitor({ monitorId: -1, inputValue: '' })
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded"
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
