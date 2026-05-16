import { useEffect, useState } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import type { DdcMonitor } from '@shared/types'

export function DDCSettings(): JSX.Element {
  const { ddcMonitors } = useServiceStore()
  const [monitors, setMonitors] = useState<DdcMonitor[]>(ddcMonitors)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { setDirty, registerSave } = useSettingsForm()

  const [savedInterval, setSavedInterval] = useState<number | null>(null)
  const [draftInterval, setDraftInterval] = useState('')

  useEffect(() => {
    setMonitors(ddcMonitors)
  }, [ddcMonitors])

  useEffect(() => {
    window.api.ddcGetPollInterval().then((sec) => {
      setSavedInterval(sec)
      setDraftInterval(sec.toString())
    }).catch(console.error)
  }, [])

  const intervalDirty = savedInterval !== null && draftInterval !== savedInterval.toString()

  useEffect(() => {
    setDirty(intervalDirty)
  }, [intervalDirty, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const parsed = parseInt(draftInterval, 10)
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 3600) {
        await window.api.ddcSetPollInterval(parsed)
        setSavedInterval(parsed)
      }
    })
    return () => registerSave(null)
  }, [draftInterval, registerSave])

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true)
    try {
      await window.api.ddcGetMonitors()
    } catch (err) {
      console.error('Failed to refresh monitors:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-7 tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
        DDC Display Control
      </h1>

      {monitors.length > 0 ? (
        <>
          <div className="space-y-4 mb-6">
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Connected Monitors
              </h2>
              <div className="space-y-2">
                {monitors.map((monitor) => (
                  <div
                    key={monitor.monitor_id}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {monitor.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          Monitor {monitor.monitor_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Brightness: {monitor.brightness}%
                      </span>
                    </div>
                    {monitor.supports.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {monitor.supports.map((feature) => (
                          <span
                            key={feature}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: 'var(--color-surface-raised)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-4 rounded-lg mb-6" style={{ background: 'var(--color-surface)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No DDC-capable monitors detected. Make sure your displays support DDC/CI protocol.
          </p>
        </div>
      )}

      <div className="flex gap-3 mb-8">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-sm px-4 py-2 rounded font-medium transition-colors"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            cursor: isRefreshing ? 'default' : 'pointer',
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Monitors'}
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Refresh Interval
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          How often the app polls displays for changes in the background (10–3600 seconds).
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={10}
            max={3600}
            value={draftInterval}
            onChange={(e) => setDraftInterval(e.target.value)}
            className="text-sm px-3 py-1.5 rounded w-28"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              outline: 'none',
            }}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>seconds</span>
        </div>
      </div>

      <div className="p-4 rounded-lg" style={{ background: 'var(--color-surface)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          DDC/CI (Display Data Channel/Command Interface) allows software control of display brightness and other features. Not all monitors support this protocol.
        </p>
      </div>
    </div>
  )
}
