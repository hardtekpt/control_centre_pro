import type { Plugin } from '@shared/types'
import { StatusPill } from './StatusPill'

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

interface PluginCardProps {
  plugin: Plugin
  onClick: () => void
  onToggleClick: (e: React.MouseEvent) => void
}

export function PluginCard({ plugin, onClick, onToggleClick }: PluginCardProps): JSX.Element {
  const isInstalled = plugin.status !== 'not-installed'

  return (
    <button className="pl-card" onClick={onClick}>
      <div className="glyph">{plugin.glyph}</div>
      <div className="name">{plugin.name}</div>
      <div className="toggle-wrap" onClick={onToggleClick}>
        {isInstalled ? (
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={(e) => e.stopPropagation()}
            style={{
              width: '32px',
              height: '18px',
              cursor: 'pointer',
              accentColor: 'var(--color-accent)',
            }}
          />
        ) : (
          <button
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            Install
          </button>
        )}
      </div>
      <div className="author">{plugin.author}</div>
      <div className="blurb">{plugin.blurb}</div>
      <div className="footer">
        <StatusPill status={plugin.status} />
        {isInstalled && (
          <div className="chevron">
            <ChevronRightIcon />
          </div>
        )}
      </div>
    </button>
  )
}
