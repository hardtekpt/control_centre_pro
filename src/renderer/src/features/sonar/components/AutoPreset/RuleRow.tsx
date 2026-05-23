import { useState } from 'react'
import type { PresetSwitcherRule, SonarConfig } from '@shared/types'
import { MonogramTile } from '../AppChip'
import { CHANNEL_LABELS } from '../../data/catalogues'

const AVAILABLE_CHANNELS = ['game', 'chatRender', 'chatCapture', 'media', 'aux'] as const

interface RuleRowProps {
  rule: PresetSwitcherRule
  isActive: boolean
  configs: SonarConfig[]
  onUpdate: (updated: PresetSwitcherRule) => void
  onRemove: () => void
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function EditIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export function RuleRow({ rule, isActive, configs, onUpdate, onRemove }: RuleRowProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editChannel, setEditChannel] = useState(rule.channel ?? '')
  const [editPresetId, setEditPresetId] = useState(rule.presetId ?? '')

  const presetName = rule.presetId
    ? (configs.find((c) => c.id === rule.presetId)?.name ?? rule.presetId)
    : '—'

  const channelLabel = rule.channel
    ? (CHANNEL_LABELS[rule.channel] ?? rule.channel)
    : '—'

  const presetsForChannel = configs.filter((c) => c.virtualAudioDevice === editChannel && c.isFavorite)

  function handleSave(): void {
    if (!editChannel || !editPresetId) return
    onUpdate({ ...rule, channel: editChannel, presetId: editPresetId })
    setEditing(false)
  }

  function handleCancel(): void {
    setEditChannel(rule.channel ?? '')
    setEditPresetId(rule.presetId ?? '')
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`sn-rule-row${isActive ? ' matched' : ''}`}>
        <MonogramTile name={rule.displayName} processName={rule.appProcessName} size="sm" />
        <span className="sn-rule-app-name" title={rule.displayName}>{rule.displayName}</span>
        <span className="sn-rule-arrow">→</span>
        <span
          className="sn-rule-preset-btn"
          title={`${channelLabel} / ${presetName}`}
          style={{ cursor: 'default' }}
        >
          {channelLabel} / {presetName}
        </span>
        <button
          className="sn-rule-edit-btn"
          onClick={() => { setEditing((v) => !v); setEditChannel(rule.channel ?? ''); setEditPresetId(rule.presetId ?? '') }}
          title="Edit rule"
        >
          <EditIcon />
        </button>
        <button className="sn-rule-del" onClick={onRemove} title="Remove rule">
          <TrashIcon />
        </button>
      </div>

      {editing && (
        <div className="sn-rule-edit-form expand-in">
          <select
            className="sn-form-select"
            value={editChannel}
            onChange={(e) => { setEditChannel(e.target.value); setEditPresetId('') }}
          >
            <option value="">Select channel…</option>
            {AVAILABLE_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
            ))}
          </select>
          <select
            className="sn-form-select"
            value={editPresetId}
            onChange={(e) => setEditPresetId(e.target.value)}
            disabled={!editChannel || presetsForChannel.length === 0}
          >
            <option value="">
              {!editChannel ? 'Select a channel first' : presetsForChannel.length === 0 ? 'No presets' : 'Select preset…'}
            </option>
            {presetsForChannel.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="sn-form-row">
            <button
              className="sn-form-btn-save"
              disabled={!editChannel || !editPresetId}
              onClick={handleSave}
            >
              Save
            </button>
            <button className="sn-form-btn-cancel" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
