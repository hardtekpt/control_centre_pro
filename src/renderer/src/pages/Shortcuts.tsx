import { useEffect, useRef, useState } from 'react'
import { useShortcutStore } from '../stores/shortcutStore'
import { CATEGORIES, ACTIONS, actionById, formatActionValue } from '../lib/shortcuts/catalog'
import { formatCombo } from '../lib/shortcuts/keys'
import { ShortcutRow } from '../components/shortcuts/ShortcutRow'
import { NewShortcutPanel } from '../components/shortcuts/NewShortcutPanel'
import { IconPlus } from '../components/shortcuts/icons'
import { MainPageHeader, type FilterChipDef } from '../components/MainPageHeader'
import '../components/shortcuts/shortcuts.css'

export function Shortcuts(): JSX.Element {
  const { items, load, findConflict } = useShortcutStore()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Reload shortcuts when this page mounts (picks up any changes made outside the app)
  useEffect(() => {
    window.api.shortcutsGet().then(load).catch(console.error)
  }, [load])

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <MainPageHeader
        title="Shortcuts"
        subtitle={`${items.length} configured · ${totalEnabled} enabled`}
        chips={[
          { id: 'all', label: 'All', count: items.length },
          ...CATEGORIES
            .filter((cat) => countPerCat(cat.id) > 0)
            .map((cat): FilterChipDef => ({
              id: cat.id,
              label: cat.label,
              count: countPerCat(cat.id),
              icon: <cat.icon size={12} />,
            })),
        ]}
        activeChip={filter}
        onChipSelect={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchRef={searchRef}
        trailingActions={
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
        }
      />

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
