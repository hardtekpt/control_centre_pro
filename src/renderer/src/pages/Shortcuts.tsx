import { useEffect, useRef, useState, useCallback } from 'react'
import { useShortcutStore } from '../stores/shortcutStore'
import { CATEGORIES, ACTIONS, actionById, formatActionValue } from '../lib/shortcuts/catalog'
import { formatCombo, combinationFromEvent } from '../lib/shortcuts/keys'
import { ShortcutRow } from '../components/shortcuts/ShortcutRow'
import { NewShortcutPanel } from '../components/shortcuts/NewShortcutPanel'
import { IconSearch, IconPlus } from '../components/shortcuts/icons'
import '../components/shortcuts/shortcuts.css'

export function Shortcuts(): JSX.Element {
  const { items, load, findConflict } = useShortcutStore()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load shortcuts on mount
  useEffect(() => {
    window.api.shortcutsGet().then(load).catch(console.error)
  }, [load])

  // Handle focused-scope keydown dispatches
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const combo = combinationFromEvent(e)
      if (!combo) return

      const match = items.find(
        (s) => s.scope === 'focused' && s.enabled && JSON.stringify(s.keys) === JSON.stringify(combo)
      )
      if (match) {
        e.preventDefault()
        void window.api.shortcutsDispatch(match.actionId, match.value)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items])

  // ⌘K / Ctrl+K focuses search; N opens new panel
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (!inInput && e.key === 'n') {
        e.preventDefault()
        setShowNew(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const totalEnabled = items.filter((s) => s.enabled).length

  // Filter + search
  const visible = items.filter((s) => {
    if (filter !== 'all') {
      const act = actionById(s.actionId)
      if (!act || act.cat !== filter) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      const act = actionById(s.actionId)
      const catLabel = act ? CATEGORIES.find((c) => c.id === act.cat)?.label?.toLowerCase() ?? '' : ''
      const valueStr = act ? (formatActionValue(act, s.value) ?? '').toLowerCase() : ''
      const comboStr = formatCombo(s.keys).toLowerCase()
      const label = (act?.label ?? s.actionId).toLowerCase()
      if (!label.includes(q) && !catLabel.includes(q) && !valueStr.includes(q) && !comboStr.includes(q)) {
        return false
      }
    }
    return true
  })

  // Group by category in canonical order
  const groups = CATEGORIES.map((cat) => ({
    cat,
    rows: visible.filter((s) => actionById(s.actionId)?.cat === cat.id),
  })).filter((g) => g.rows.length > 0)

  // Count per category (unfiltered, for chips)
  const countPerCat = (catId: string): number =>
    items.filter((s) => actionById(s.actionId)?.cat === catId).length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-bg)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 20px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                marginBottom: 4,
              }}
            >
              Shortcuts
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {items.length} configured · {totalEnabled} enabled
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            {/* Search */}
            <div className="search-input-wrap">
              <span className="search-icon"><IconSearch size={14} /></span>
              <input
                ref={searchRef}
                className="search-input"
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* New shortcut */}
            <button
              type="button"
              onClick={() => setShowNew(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <IconPlus size={14} />
              New shortcut
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
          <button
            type="button"
            className={`filter-chip${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span className="chip-count">{items.length}</span>
          </button>
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon
            const count = countPerCat(cat.id)
            if (count === 0) return null
            return (
              <button
                key={cat.id}
                type="button"
                className={`filter-chip${filter === cat.id ? ' active' : ''}`}
                onClick={() => setFilter(cat.id)}
              >
                <CatIcon size={12} />
                {cat.label}
                <span className="chip-count">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {/* New shortcut panel */}
        {showNew && (
          <NewShortcutPanel onClose={() => setShowNew(false)} />
        )}

        {visible.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              gap: 8,
            }}
          >
            {search ? `No shortcuts match "${search}"` : 'No shortcuts yet. Click "+ New shortcut" to add one.'}
          </div>
        ) : (
          groups.map(({ cat, rows }) => {
            const CatIcon = cat.icon
            return (
              <div key={cat.id}>
                <div className="category-header">
                  <CatIcon size={13} />
                  <span className="category-header-label">{cat.label}</span>
                  <span className="category-header-count">{rows.length}</span>
                  <span className="category-divider" />
                </div>
                {rows.map((s) => (
                  <ShortcutRow key={s.id} shortcut={s} />
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
