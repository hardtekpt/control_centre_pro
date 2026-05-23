import { useState } from 'react'
import type { OpenApp, SonarConfig, PresetSwitcherRule } from '@shared/types'
import { CHANNEL_LABELS } from '../../data/catalogues'

const AVAILABLE_CHANNELS = ['game', 'chatRender', 'chatCapture', 'media', 'aux'] as const

interface AddRuleFormProps {
  openApps: OpenApp[]
  loadingApps: boolean
  configs: SonarConfig[]
  existingProcessNames: Set<string>
  onAdd: (rule: Omit<PresetSwitcherRule, 'id'>) => void
  onCancel: () => void
  onRefreshApps: () => void
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36" />
    </svg>
  )
}

export function AddRuleForm({
  openApps,
  loadingApps,
  configs,
  existingProcessNames,
  onAdd,
  onCancel,
  onRefreshApps,
}: AddRuleFormProps): JSX.Element {
  const [appProcessName, setAppProcessName] = useState('')
  const [channel, setChannel] = useState('')
  const [presetId, setPresetId] = useState('')

  const availableApps = openApps.filter((a) => !existingProcessNames.has(a.processName))
  const presetsForChannel = configs.filter((c) => c.virtualAudioDevice === channel && c.isFavorite)
  const isValid = !!appProcessName && !!channel && !!presetId

  function handleAdd(): void {
    if (!isValid) return
    const app = openApps.find((a) => a.processName === appProcessName)
    onAdd({
      appProcessName,
      displayName: app?.displayName ?? appProcessName,
      channel,
      presetId,
      enabled: true,
    })
    setAppProcessName('')
    setChannel('')
    setPresetId('')
  }

  return (
    <div className="sn-add-rule-form expand-in">
      {/* App selector */}
      <div className="flex items-center gap-1.5">
        <select
          className="sn-form-select flex-1"
          value={appProcessName}
          onChange={(e) => setAppProcessName(e.target.value)}
        >
          <option value="">Select app…</option>
          {availableApps.map((a) => (
            <option key={a.processName} value={a.processName}>{a.displayName}</option>
          ))}
        </select>
        <button
          onClick={onRefreshApps}
          disabled={loadingApps}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            cursor: loadingApps ? 'not-allowed' : 'pointer',
            opacity: loadingApps ? 0.5 : 1,
            color: 'var(--color-text-secondary)',
          }}
          title="Refresh running apps"
        >
          <RefreshIcon />
        </button>
      </div>

      {/* Channel selector */}
      <select
        className="sn-form-select"
        value={channel}
        onChange={(e) => { setChannel(e.target.value); setPresetId('') }}
      >
        <option value="">Select channel…</option>
        {AVAILABLE_CHANNELS.map((ch) => (
          <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
        ))}
      </select>

      {/* Preset selector */}
      <select
        className="sn-form-select"
        value={presetId}
        onChange={(e) => setPresetId(e.target.value)}
        disabled={!channel || presetsForChannel.length === 0}
      >
        <option value="">
          {!channel
            ? 'Select a channel first'
            : presetsForChannel.length === 0
              ? 'No presets for this channel'
              : 'Select preset…'}
        </option>
        {presetsForChannel.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <div className="sn-form-row">
        <button className="sn-form-btn-save" disabled={!isValid} onClick={handleAdd}>Add Rule</button>
        <button className="sn-form-btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
