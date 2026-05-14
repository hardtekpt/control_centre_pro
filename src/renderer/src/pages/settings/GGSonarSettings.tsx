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
            <label
              key={channel}
              className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors"
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
              <input
                type="checkbox"
                checked={visibleChannels.has(channel)}
                onChange={() => handleToggle(channel)}
                className="cursor-pointer"
                style={{
                  width: 16,
                  height: 16,
                  cursor: 'pointer',
                  accentColor: 'var(--color-accent)',
                }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
