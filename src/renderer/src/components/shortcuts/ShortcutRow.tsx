import { useState, useEffect, useCallback } from 'react'
import { KbdPills } from './KbdPills'
import { IconX } from './icons'
import { combinationFromEvent, formatCombo } from '../../lib/shortcuts/keys'
import { actionById, formatActionValue, CATEGORIES } from '../../lib/shortcuts/catalog'
import { useShortcutStore } from '../../stores/shortcutStore'
import { useServiceStore } from '../../stores/serviceStore'
import type { Shortcut } from '../../stores/shortcutStore'

interface ShortcutRowProps {
  shortcut: Shortcut
}

export function ShortcutRow({ shortcut }: ShortcutRowProps): JSX.Element {
  const { update, toggle, remove, findConflict } = useShortcutStore()
  const monitorGroups = useServiceStore((s) => s.settings.monitorGroups ?? [])
  const [capturing, setCapturing] = useState(false)
  const [conflict, setConflict] = useState<Shortcut | undefined>(undefined)

  const action = actionById(shortcut.actionId)
  const category = action ? CATEGORIES.find((c) => c.id === action.cat) : undefined
  const valueLabel = action ? formatActionValue(action, shortcut.value, monitorGroups) : null

  const Icon = action?.icon
  const CatIcon = category?.icon

  const startCapture = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setCapturing(true)
  }, [])

  const stopCapture = useCallback(() => {
    setCapturing(false)
    setConflict(undefined)
  }, [])

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        stopCapture()
        return
      }

      const combo = combinationFromEvent(e)
      if (!combo) return

      const existing = findConflict(combo, shortcut.id)
      if (existing) {
        setConflict(existing)
        return
      }

      update(shortcut.id, { keys: combo })
      stopCapture()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [capturing, shortcut.id, update, findConflict, stopCapture])

  // Close capture on click outside
  useEffect(() => {
    if (!capturing) return
    const handler = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (!target.closest('.kbd-area')) stopCapture()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [capturing, stopCapture])

  const conflictAction = conflict ? actionById(conflict.actionId) : undefined
  const conflictLabel = conflictAction
    ? conflictAction.label + (conflict && conflict.value != null
        ? ' · ' + formatActionValue(conflictAction, conflict.value, monitorGroups)
        : '')
    : ''

  const enabled = shortcut.enabled

  return (
    <div className={`shortcut-row${!enabled ? ' row-disabled' : ''}`}>
      {/* Icon */}
      <div className="row-icon">
        {Icon && <Icon size={16} />}
      </div>

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        <div className="row-title">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{action?.label ?? shortcut.actionId}</span>
          {valueLabel && <span className="row-value-pill">{valueLabel}</span>}
        </div>
        <div className="row-meta">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {CatIcon && <CatIcon size={11} />}
            {category?.label ?? action?.cat}
            {' · '}
            {shortcut.scope === 'global' ? 'Global' : 'When focused'}
          </span>
          {conflict && (
            <span className="row-conflict">
              {' · Conflicts with '}
              <strong>{conflictLabel}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Keybind area */}
      <div
        className={`kbd-area${capturing ? ' capturing' : ''}`}
        onClick={capturing ? undefined : startCapture}
        role="button"
        tabIndex={0}
        aria-label="Click to rebind shortcut"
        onKeyDown={(e) => { if (!capturing && (e.key === 'Enter' || e.key === ' ')) startCapture(e as unknown as React.MouseEvent) }}
      >
        {capturing ? (
          <>
            <span className="capture-dot" />
            <span className="capture-hint">Press keys…</span>
          </>
        ) : (
          <KbdPills keys={shortcut.keys} />
        )}
      </div>

      {/* Toggle */}
      <button
        type="button"
        className="toggle-track"
        onClick={() => toggle(shortcut.id)}
        aria-label={enabled ? 'Disable shortcut' : 'Enable shortcut'}
        style={{
          background: enabled ? 'var(--color-text-primary)' : 'var(--color-border)',
        }}
      >
        <span
          className="toggle-thumb"
          style={{
            transform: enabled ? 'translateX(14px)' : 'translateX(0)',
            background: enabled ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          }}
        />
      </button>

      {/* Delete */}
      <button
        type="button"
        className="row-delete"
        onClick={() => remove(shortcut.id)}
        aria-label="Delete shortcut"
      >
        <IconX size={14} />
      </button>
    </div>
  )
}
