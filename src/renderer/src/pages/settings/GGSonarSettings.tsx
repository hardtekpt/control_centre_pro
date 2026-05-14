import { useEffect, useState } from 'react'
import { useSonarStore } from '../../stores/sonarStore'
import type { SonarChannel, SonarMode, SonarPollingConfig } from '@shared/types'

const CHANNEL_DEFS: { channel: SonarChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'game', label: 'Game' },
  { channel: 'media', label: 'Media' },
  { channel: 'chatRender', label: 'Chat' },
  { channel: 'chatCapture', label: 'Mic' },
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
  const { sonarState, visibleChannels, setChannelVisibility } = useSonarStore()
  const [pollingConfig, setPollingConfig] = useState<SonarPollingConfig | null>(null)
  const [fastInterval, setFastInterval] = useState('')
  const [slowInterval, setSlowInterval] = useState('')
  const [presetSwitcherEnabled, setPresetSwitcherEnabled] = useState(true)

  useEffect(() => {
    // Load current polling config
    window.api.sonarGetPollingConfig()
      .then((config) => {
        setPollingConfig(config)
        setFastInterval(config.fastIntervalMs.toString())
        setSlowInterval(config.slowIntervalMs.toString())
      })
      .catch(console.error)

    // Load preset switcher enabled state
    window.api.getPresetSwitcherEnabled()
      .then(setPresetSwitcherEnabled)
      .catch(console.error)
  }, [])

  function handleToggle(channel: SonarChannel): void {
    setChannelVisibility(channel, !visibleChannels.has(channel))
  }

  function handleModeChange(mode: SonarMode): void {
    window.api.sonarSetMode(mode).catch(console.error)
  }

  async function handleSavePollingConfig(): Promise<void> {
    const fastMs = Math.max(100, parseInt(fastInterval, 10) || 1000)
    const slowMs = Math.max(100, parseInt(slowInterval, 10) || 5000)

    const newConfig: SonarPollingConfig = {
      fastIntervalMs: fastMs,
      slowIntervalMs: slowMs,
    }

    try {
      await window.api.sonarSetPollingConfig(newConfig)
      setPollingConfig(newConfig)
      setFastInterval(fastMs.toString())
      setSlowInterval(slowMs.toString())
    } catch (err) {
      console.error('Failed to save polling config:', err)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-7 tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
        GG Sonar
      </h1>

      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Mixer Mode
        </h2>
        {sonarState && (
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--color-border)', width: 'fit-content' }}>
            {(['classic', 'streamer'] as SonarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className="text-xs px-4 py-2 capitalize transition-colors font-medium"
                style={{
                  background: sonarState.mode === m ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                  color: sonarState.mode === m ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  border: 'none',
                  outline: 'none',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8">
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

      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Preset Switcher
        </h2>
        <button
          type="button"
          onClick={() => {
            const newState = !presetSwitcherEnabled
            setPresetSwitcherEnabled(newState)
            window.api.setPresetSwitcherEnabled(newState).catch(console.error)
          }}
          className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors text-left w-fit"
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
          <Checkbox checked={presetSwitcherEnabled} onChange={() => {}} />
          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            Enable Automatic Preset Switching
          </span>
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          State Polling
        </h2>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Fast Poll Interval (ms)
            </label>
            <input
              type="number"
              min="100"
              step="100"
              value={fastInterval}
              onChange={(e) => setFastInterval(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Updates mode, volumes, and chat mix
            </p>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Slow Poll Interval (ms)
            </label>
            <input
              type="number"
              min="100"
              step="100"
              value={slowInterval}
              onChange={(e) => setSlowInterval(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Updates presets and routing
            </p>
          </div>

          <button
            onClick={handleSavePollingConfig}
            className="w-full py-2 px-3 rounded text-sm font-medium transition-colors"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Save Polling Config
          </button>
        </div>
      </div>
    </div>
  )
}
