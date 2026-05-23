import { useState } from 'react'
import type { SonarConfig } from '@shared/types'
import type { SonarApiPresetId, UserPresetChip } from '../../features/sonar/data/catalogues'
import { SONAR_API_PRESET_LABELS, CHANNEL_LABELS } from '../../features/sonar/data/catalogues'
import { PRESET_ICONS } from '../../features/sonar/components/PresetChips'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconUp(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}
function IconDown(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function IconEdit(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
function IconTrash(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
function IconPlus(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHIP_CHANNELS = ['master', 'game', 'chatRender', 'chatCapture', 'media', 'aux'] as const
type ChipChannel = typeof CHIP_CHANNELS[number]

const API_PRESET_IDS: SonarApiPresetId[] = ['music', 'game', 'studio', 'cinema', 'speech', 'flat']

function generateUid(): string {
  return `chip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Inline chip edit form ─────────────────────────────────────────────────────

interface EditFormProps {
  draft: Partial<UserPresetChip>
  onChange: (d: Partial<UserPresetChip>) => void
  onCancel: () => void
  onApply: () => void
  applyLabel: string
  configs: SonarConfig[]
}

function ChipEditForm({ draft, onChange, onCancel, onApply, applyLabel, configs }: EditFormProps): JSX.Element {
  const channel = draft.virtualAudioDevice ?? ''
  const presetsForChannel = configs.filter((c) => c.virtualAudioDevice === channel)

  // Resolve selected config id from stored configName so the <select> stays in sync
  const selectedConfigId = presetsForChannel.find((c) => c.name === draft.configName)?.id ?? ''

  function handleChannelChange(ch: string): void {
    onChange({ ...draft, virtualAudioDevice: ch, configName: '' })
  }

  function handleConfigChange(configId: string): void {
    const config = configs.find((c) => c.id === configId)
    if (!config) return
    onChange({
      ...draft,
      configName: config.name,
      label: draft.label?.trim() ? draft.label : config.name,
      sub: draft.sub?.trim() ? draft.sub : (CHANNEL_LABELS[config.virtualAudioDevice] ?? config.virtualAudioDevice),
    })
  }

  const labelTrimmed = draft.label?.trim() ?? ''
  const canApply = labelTrimmed !== '' && !!draft.configName && !!draft.virtualAudioDevice

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.12s',
  }
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  }

  return (
    <div style={{
      margin: '0 0 2px',
      padding: '10px 12px',
      background: 'var(--color-surface-raised)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Channel + Preset selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={labelStyle}>Channel</label>
          <select
            style={selectStyle}
            value={channel}
            onChange={(e) => handleChannelChange(e.target.value)}
          >
            <option value="">Select channel…</option>
            {CHIP_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={labelStyle}>Preset</label>
          <select
            style={{ ...selectStyle, opacity: !channel ? 0.5 : 1 }}
            value={selectedConfigId}
            disabled={!channel}
            onChange={(e) => handleConfigChange(e.target.value)}
          >
            <option value="">
              {!channel
                ? 'Select a channel first'
                : presetsForChannel.length === 0
                  ? 'No presets available'
                  : 'Select preset…'}
            </option>
            {presetsForChannel.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Icon picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelStyle, minWidth: 40 }}>Icon</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {API_PRESET_IDS.map((id) => {
            const Icon = PRESET_ICONS[id]
            const selected = draft.iconKey === id
            return (
              <button
                key={id}
                title={SONAR_API_PRESET_LABELS[id]}
                onClick={() => onChange({ ...draft, iconKey: id })}
                style={{
                  width: 28, height: 28,
                  borderRadius: 6,
                  border: selected ? '1.5px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                  background: selected ? 'var(--color-text-primary)' : 'var(--color-surface)',
                  color: selected ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  transition: 'background 0.1s, border-color 0.1s, color 0.1s',
                  flexShrink: 0,
                }}
              >
                <Icon />
              </button>
            )
          })}
        </div>
      </div>

      {/* Label + Sub row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={labelStyle}>Label</label>
          <input
            style={inputStyle}
            value={draft.label ?? ''}
            placeholder="e.g. Music"
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={labelStyle}>Sub-label</label>
          <input
            style={inputStyle}
            value={draft.sub ?? ''}
            placeholder="e.g. game channel"
            onChange={(e) => onChange({ ...draft, sub: e.target.value })}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={!canApply}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: 'none',
            background: canApply ? 'var(--color-text-primary)' : 'var(--color-border)',
            color: canApply ? 'var(--color-bg)' : 'var(--color-text-tertiary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: canApply ? 'pointer' : 'not-allowed',
            transition: 'background 0.1s',
          }}
        >
          {applyLabel}
        </button>
      </div>
    </div>
  )
}

// ── Individual chip row ───────────────────────────────────────────────────────

interface ChipRowProps {
  chip: UserPresetChip
  canMoveUp: boolean
  canMoveDown: boolean
  isEditing: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}

function ChipRow({ chip, canMoveUp, canMoveDown, isEditing, onMoveUp, onMoveDown, onEdit, onDelete }: ChipRowProps): JSX.Element {
  const Icon = PRESET_ICONS[chip.iconKey]
  const channelLabel = CHANNEL_LABELS[chip.virtualAudioDevice] ?? chip.virtualAudioDevice

  const btnBase: React.CSSProperties = {
    width: 24, height: 24,
    borderRadius: 5,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--color-text-tertiary)',
    transition: 'color 0.1s, background 0.1s',
    flexShrink: 0,
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 7,
        background: isEditing ? 'var(--color-surface-raised)' : 'transparent',
        transition: 'background 0.1s',
        marginBottom: 1,
      }}
      onMouseEnter={(e) => {
        if (!isEditing) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-row-hover)'
      }}
      onMouseLeave={(e) => {
        if (!isEditing) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Icon preview */}
      <span style={{
        width: 28, height: 28,
        borderRadius: 6,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-raised)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--color-text-primary)',
        flexShrink: 0,
      }}>
        <Icon />
      </span>

      {/* Label + sub */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
          {chip.label}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--color-text-secondary)',
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 1,
          letterSpacing: '0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {chip.sub || <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
        </div>
      </div>

      {/* Channel · Preset badge */}
      <span style={{
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        color: 'var(--color-text-tertiary)',
        border: '1px solid var(--color-border)',
        borderRadius: 999,
        padding: '1px 6px',
        flexShrink: 0,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}>
        {channelLabel} · {chip.configName}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <button
          style={{ ...btnBase, opacity: canMoveUp ? 1 : 0.25, cursor: canMoveUp ? 'pointer' : 'not-allowed' }}
          onClick={canMoveUp ? onMoveUp : undefined}
          title="Move up"
          disabled={!canMoveUp}
        >
          <IconUp />
        </button>
        <button
          style={{ ...btnBase, opacity: canMoveDown ? 1 : 0.25, cursor: canMoveDown ? 'pointer' : 'not-allowed' }}
          onClick={canMoveDown ? onMoveDown : undefined}
          title="Move down"
          disabled={!canMoveDown}
        >
          <IconDown />
        </button>
        <button
          style={{
            ...btnBase,
            background: isEditing ? 'var(--color-surface)' : 'transparent',
            color: isEditing ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          }}
          onClick={onEdit}
          title="Edit"
        >
          <IconEdit />
        </button>
        <button
          style={{ ...btnBase }}
          onClick={onDelete}
          title="Remove"
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-warn)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--color-row-hover)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

// ── PresetChipsList (exported) ────────────────────────────────────────────────

export interface PresetChipsListProps {
  chips: UserPresetChip[]
  onChange: (chips: UserPresetChip[]) => void
  configs: SonarConfig[]
}

export function PresetChipsList({ chips, onChange, configs }: PresetChipsListProps): JSX.Element {
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<UserPresetChip>>({})
  const [addingNew, setAddingNew] = useState(false)
  const [newDraft, setNewDraft] = useState<Partial<UserPresetChip>>({})

  // ── Reorder ──────────────────────────────────────────────────────────────────

  function moveUp(uid: string): void {
    const idx = chips.findIndex((c) => c.uid === uid)
    if (idx <= 0) return
    const next = [...chips]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  function moveDown(uid: string): void {
    const idx = chips.findIndex((c) => c.uid === uid)
    if (idx < 0 || idx >= chips.length - 1) return
    const next = [...chips]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function startEdit(chip: UserPresetChip): void {
    if (editingUid === chip.uid) { cancelEdit(); return }
    setAddingNew(false)
    setNewDraft({})
    setEditingUid(chip.uid)
    setEditDraft({ ...chip })
  }

  function cancelEdit(): void {
    setEditingUid(null)
    setEditDraft({})
  }

  function applyEdit(): void {
    if (!editDraft.uid || !editDraft.label?.trim() || !editDraft.configName || !editDraft.virtualAudioDevice) return
    onChange(chips.map((c) =>
      c.uid === editDraft.uid
        ? { ...c, ...editDraft, label: editDraft.label!.trim() } as UserPresetChip
        : c,
    ))
    setEditingUid(null)
    setEditDraft({})
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  function deleteChip(uid: string): void {
    onChange(chips.filter((c) => c.uid !== uid))
    if (editingUid === uid) cancelEdit()
  }

  // ── Add ──────────────────────────────────────────────────────────────────────

  function startAdd(): void {
    cancelEdit()
    setNewDraft({ iconKey: 'music', label: '', sub: '' })
    setAddingNew(true)
  }

  function cancelAdd(): void {
    setAddingNew(false)
    setNewDraft({})
  }

  function applyAdd(): void {
    const label = newDraft.label?.trim() ?? ''
    if (!label || !newDraft.configName || !newDraft.virtualAudioDevice) return
    const chip: UserPresetChip = {
      uid:               generateUid(),
      configName:        newDraft.configName,
      virtualAudioDevice: newDraft.virtualAudioDevice,
      label,
      sub:               newDraft.sub ?? '',
      iconKey:           newDraft.iconKey ?? 'music',
    }
    onChange([...chips, chip])
    setAddingNew(false)
    setNewDraft({})
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isEmpty = chips.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {isEmpty && !addingNew && (
        <div style={{
          padding: '16px 12px',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--color-text-tertiary)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.04em',
        }}>
          No preset chips. Add one below.
        </div>
      )}

      {chips.map((chip, idx) => (
        <div key={chip.uid}>
          <ChipRow
            chip={chip}
            canMoveUp={idx > 0}
            canMoveDown={idx < chips.length - 1}
            isEditing={editingUid === chip.uid}
            onMoveUp={() => moveUp(chip.uid)}
            onMoveDown={() => moveDown(chip.uid)}
            onEdit={() => startEdit(chip)}
            onDelete={() => deleteChip(chip.uid)}
          />
          {editingUid === chip.uid && (
            <ChipEditForm
              draft={editDraft}
              onChange={setEditDraft}
              onCancel={cancelEdit}
              onApply={applyEdit}
              applyLabel="Apply"
              configs={configs}
            />
          )}
        </div>
      ))}

      {addingNew && (
        <ChipEditForm
          draft={newDraft}
          onChange={setNewDraft}
          onCancel={cancelAdd}
          onApply={applyAdd}
          applyLabel="Add"
          configs={configs}
        />
      )}

      {!addingNew && (
        <button
          onClick={startAdd}
          style={{
            marginTop: chips.length > 0 ? 6 : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '7px 12px',
            borderRadius: 7,
            border: '1px dashed var(--color-border)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            transition: 'background 0.12s, border-color 0.12s, color 0.12s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--color-row-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-strong)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'
          }}
        >
          <IconPlus />
          Add preset chip
        </button>
      )}
    </div>
  )
}
