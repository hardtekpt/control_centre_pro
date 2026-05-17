import { useState, useEffect } from 'react'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { DEFAULT_SETTINGS } from '@shared/types'

export function NotificationsSettings(): JSX.Element {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [durationMs, setDurationMs] = useState(DEFAULT_SETTINGS.notifications.durationMs)
  const { setDirty, registerSave } = useSettingsForm()

  useEffect(() => {
    window.api.getSettings().then(setSettings).catch(console.error)
  }, [])

  useEffect(() => {
    setDurationMs(settings.notifications.durationMs)
  }, [settings.notifications.durationMs])

  // Mark dirty when draft differs from saved value
  useEffect(() => {
    setDirty(durationMs !== settings.notifications.durationMs)
  }, [durationMs, settings.notifications.durationMs, setDirty])

  // Register save handler
  useEffect(() => {
    registerSave(async () => {
      const current = await window.api.getSettings()
      await window.api.setSettings({
        ...current,
        notifications: { ...current.notifications, durationMs },
      })
      setSettings({
        ...current,
        notifications: { ...current.notifications, durationMs },
      })
    })
    return () => registerSave(null)
  }, [durationMs, registerSave])

  const handleChange = (ms: number) => {
    if (ms >= 500 && ms <= 10000) {
      setDurationMs(ms)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Notification Display Duration
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Control how long notifications appear on screen before automatically dismissing.
        </p>
      </div>

      {/* Duration section */}
      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Duration (milliseconds)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={500}
                max={10000}
                step={100}
                value={durationMs}
                onChange={(e) => handleChange(Number(e.target.value))}
                className="flex-1"
                style={{ cursor: 'pointer' }}
              />
              <div
                className="mono text-sm px-3 py-1.5 rounded"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  minWidth: 70,
                  textAlign: 'center',
                }}
              >
                {durationMs}ms
              </div>
            </div>
            <div className="text-xs mt-2 flex gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <span>500ms</span>
              <span>·</span>
              <span>2400ms (default)</span>
              <span>·</span>
              <span>10000ms</span>
            </div>
          </div>

          {/* Presets */}
          <div className="pt-2">
            <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Quick (500ms)', value: 500 },
                { label: 'Short (1200ms)', value: 1200 },
                { label: 'Normal (2400ms)', value: 2400 },
                { label: 'Long (4000ms)', value: 4000 },
                { label: 'Very long (8000ms)', value: 8000 },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleChange(preset.value)}
                  className="text-xs px-3 py-1.5 rounded transition-colors"
                  style={{
                    background:
                      durationMs === preset.value
                        ? 'var(--color-accent)'
                        : 'var(--color-surface-raised)',
                    color:
                      durationMs === preset.value
                        ? 'var(--color-bg)'
                        : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div
        className="rounded-lg px-4 py-3"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          This setting applies to all notifications in Control Centre. Sticky notifications (e.g. error alerts) will still require manual dismissal.
        </p>
      </div>
    </div>
  )
}
