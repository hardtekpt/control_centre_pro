import { useState, useMemo } from 'react'
import type { Plugin, PluginCategory } from '@shared/types'
import { PluginCard } from './PluginCard'

interface PluginGridProps {
  plugins: Plugin[]
  onPluginSelect: (pluginId: string) => void
  onTogglePlugin: (pluginId: string) => void
}

const PLUGIN_CATEGORIES: Array<{ id: 'all' | PluginCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'communication', label: 'Communication' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'smart-home', label: 'Smart Home' },
  { id: 'media', label: 'Media' },
  { id: 'peripheral', label: 'Peripheral' },
]

export function PluginGrid({ plugins, onPluginSelect, onTogglePlugin }: PluginGridProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | PluginCategory>('all')

  const filtered = useMemo(() => {
    let result = plugins

    // Filter by search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.blurb.toLowerCase().includes(q)
      )
    }

    // Filter by category
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.category === activeFilter)
    }

    return [...result].sort((a, b) => a.name.localeCompare(b.name))
  }, [plugins, search, activeFilter])

  const connectedCount = plugins.filter((p) => p.status === 'connected').length

  return (
    <div>
      {/* Header */}
      <div className="pl-header">
        <div className="titles">
          <h1
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Plugins
          </h1>
          <p
            style={{
              margin: '2px 0 0 0',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {connectedCount} connected · {plugins.length} installed
          </p>
        </div>
        <div className="actions">
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-search input"
            style={{
              width: '220px',
            }}
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="pl-filters">
        {PLUGIN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`pl-chip ${activeFilter === cat.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No plugins match your search</p>
        </div>
      ) : (
        <div className="pl-grid">
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onClick={() => onPluginSelect(plugin.id)}
              onToggleClick={(e) => {
                e.stopPropagation()
                onTogglePlugin(plugin.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
