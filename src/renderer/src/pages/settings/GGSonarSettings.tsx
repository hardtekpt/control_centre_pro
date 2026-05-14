import { useSonarStore } from '../../stores/sonarStore'
import type { SonarChannel } from '@shared/types'

const CHANNEL_DEFS: { channel: SonarChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'game', label: 'Game' },
  { channel: 'chatRender', label: 'Chat' },
  { channel: 'chatCapture', label: 'Mic' },
  { channel: 'media', label: 'Media' },
  { channel: 'aux', label: 'Aux' },
]

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex-shrink-0 flex items-center justify-center rounded transition-colors"
      style={{
        width: 16,
        height: 16,
        background: checked ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

export function GGSonarSettings(): JSX.Element {
  const { visibleChannels, setChannelVisibility } = useSonarStore()

  function handleToggle(channel: SonarChannel): void {
    setChannelVisibility(channel, !visibleChannels.has(channel))
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-7 tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
        GG Sonar
      </h1>

      <div>
        <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Visible Channels
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {CHANNEL_DEFS.map(({ channel, label }) => (
            <button
              key={channel}
              type="button"
              onClick={() => handleToggle(channel)}
              className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors text-left"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-raised)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-surface)'
              }}
            >
              <Checkbox checked={visibleChannels.has(channel)} onChange={() => handleToggle(channel)} />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
