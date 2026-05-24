import { useState, useEffect, useCallback } from 'react'
import { CATEGORIES, ACTIONS, SCOPES, actionById, formatActionValue, defaultValueFor } from '../../lib/shortcuts/catalog'
import type { Action } from '../../lib/shortcuts/catalog'
import { Dropdown } from './Dropdown'
import { ValueField } from './ValueField'
import { KbdPills } from './KbdPills'
import { IconWarn } from './icons'
import { combinationFromEvent, formatCombo } from '../../lib/shortcuts/keys'
import { useShortcutStore } from '../../stores/shortcutStore'
import { useServiceStore } from '../../stores/serviceStore'
import type { ShortcutScope } from '../../stores/shortcutStore'

interface NewShortcutPanelProps {
  onClose: () => void
}

export function NewShortcutPanel({ onClose }: NewShortcutPanelProps): JSX.Element {
  const { create, findConflict } = useShortcutStore()
  const monitorGroups = useServiceStore((s) => s.settings.monitorGroups ?? [])

  const [catId, setCatId] = useState<string>('')
  const [actionId, setActionId] = useState<string>('')
  const [value, setValue] = useState<string | number | undefined>(undefined)
  const [keys, setKeys] = useState<string[]>([])
  const [scope, setScope] = useState<ShortcutScope>('global')
  const [capturing, setCapturing] = useState(false)
  const [conflictShortcut, setConflictShortcut] = useState<ReturnType<typeof findConflict>>(undefined)

  const action: Action | undefined = actionId ? actionById(actionId) : undefined

  const catActions = catId ? ACTIONS.filter((a) => a.cat === catId) : []

  const handleCatChange = (id: string): void => {
    setCatId(id)
    setActionId('')
    setValue(undefined)
  }

  const handleActionChange = (id: string): void => {
    setActionId(id)
    const a = actionById(id)
    setValue(a ? defaultValueFor(a) : undefined)
  }

  const canSave =
    !!actionId &&
    keys.length > 0 &&
    (action?.param ? value != null : true) &&
    !conflictShortcut

  const handleSave = (): void => {
    if (!canSave || !action) return
    create({
      actionId,
      value: action.param ? value : undefined,
      keys,
      scope,
    })
    onClose()
  }

  // Check conflict whenever keys change
  useEffect(() => {
    if (keys.length === 0) { setConflictShortcut(undefined); return }
    setConflictShortcut(findConflict(keys))
  }, [keys, findConflict])

  const startCapture = useCallback(() => setCapturing(true), [])

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') { setCapturing(false); return }

      const combo = combinationFromEvent(e)
      if (!combo) return

      setKeys(combo)
      setCapturing(false)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [capturing])

  const conflictAction = conflictShortcut ? actionById(conflictShortcut.actionId) : undefined
  const conflictLabel = conflictAction
    ? conflictAction.label + (conflictShortcut?.value != null
        ? ' · ' + formatActionValue(conflictAction, conflictShortcut.value, monitorGroups)
        : '')
    : ''

  return (
    <div className="new-panel">
      {/* Category */}
      <div style={{ gridArea: 'category' }}>
        <span className="field-label">Category</span>
        <Dropdown
          value={catId}
          options={CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            icon: c.icon,
            sub: c.blurb,
          }))}
          onChange={handleCatChange}
          placeholder="Select category…"
        />
      </div>

      {/* Action */}
      <div style={{ gridArea: 'action' }}>
        <span className="field-label">Action</span>
        <Dropdown
          value={actionId}
          options={catActions.map((a) => ({ id: a.id, label: a.label, icon: a.icon }))}
          onChange={handleActionChange}
          placeholder="Select action…"
          disabled={!catId}
        />
      </div>

      {/* Value */}
      <div style={{ gridArea: 'value' }}>
        <span className="field-label">Value</span>
        <ValueField action={action} value={value} onChange={setValue} />
      </div>

      {/* Shortcut (keybind capture) */}
      <div style={{ gridArea: 'shortcut' }}>
        <span className="field-label">Shortcut</span>
        <div
          className={`keybind-field${capturing ? ' active' : ''}`}
          onClick={startCapture}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startCapture() }}
        >
          {capturing ? (
            <>
              <span className="capture-dot" />
              <span className="capture-hint">Press keys…</span>
            </>
          ) : keys.length > 0 ? (
            <KbdPills keys={keys} />
          ) : (
            <span className="keybind-placeholder">Click to record…</span>
          )}
        </div>
      </div>

      {/* Scope */}
      <div style={{ gridArea: 'scope' }}>
        <span className="field-label">Scope</span>
        <Dropdown
          value={scope}
          options={SCOPES.map((s) => ({ id: s.id, label: s.label, sub: s.blurb }))}
          onChange={(v) => setScope(v as ShortcutScope)}
        />
      </div>

      {/* Actions */}
      <div style={{ gridArea: 'actions', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: '6px 14px',
            border: 'none',
            borderRadius: 8,
            background: canSave ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: canSave ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            cursor: canSave ? 'pointer' : 'not-allowed',
            transition: 'background .12s, color .12s',
          }}
        >
          Save shortcut
        </button>
      </div>

      {/* Conflict warning */}
      {conflictShortcut && (
        <div
          style={{
            gridArea: 'warn',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--color-warn)',
            fontSize: 12,
            padding: '4px 2px',
          }}
        >
          <IconWarn size={14} />
          <span>
            <strong>{formatCombo(keys)}</strong>
            {' is already bound to '}
            <strong>{conflictLabel}</strong>
            {'. Pick a different combo.'}
          </span>
        </div>
      )}
    </div>
  )
}
