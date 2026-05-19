import { useEffect, useState } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, ToggleSetting, SettingsPageWrapper } from '../../components/SettingsComponents'
import type { AppSettings, DdcMonitor } from '@shared/types'

export function DDCSettings(): JSX.Element {
  const { ddcMonitors, setSettings: setStoreSettings } = useServiceStore()
  const [monitors, setMonitors] = useState<DdcMonitor[]>(ddcMonitors)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { setDirty, registerSave } = useSettingsForm()

  const [savedInterval, setSavedInterval] = useState<number | null>(null)
  const [draftInterval, setDraftInterval] = useState('')
  const [savedSyncBrightness, setSavedSyncBrightness] = useState(false)
  const [draftSyncBrightness, setDraftSyncBrightness] = useState(false)

  useEffect(() => {
    setMonitors(ddcMonitors)
  }, [ddcMonitors])

  useEffect(() => {
    Promise.all([
      window.api.ddcGetPollInterval(),
      window.api.getSettings()
    ]).then(([sec, settings]) => {
      setSavedInterval(sec)
      setDraftInterval(sec.toString())
      setSavedSyncBrightness(settings.ddcSyncBrightness)
      setDraftSyncBrightness(settings.ddcSyncBrightness)
    }).catch(console.error)
  }, [])

  const intervalDirty = savedInterval !== null && draftInterval !== savedInterval.toString()
  const syncBrightnessDirty = draftSyncBrightness !== savedSyncBrightness

  useEffect(() => {
    setDirty(intervalDirty || syncBrightnessDirty)
  }, [intervalDirty, syncBrightnessDirty, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const parsed = parseInt(draftInterval, 10)
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 3600) {
        await window.api.ddcSetPollInterval(parsed)
        setSavedInterval(parsed)
      }

      if (draftSyncBrightness !== savedSyncBrightness) {
        const current = await window.api.getSettings()
        const updated = { ...current, ddcSyncBrightness: draftSyncBrightness }
        await window.api.setSettings(updated)
        setStoreSettings(updated)
        setSavedSyncBrightness(draftSyncBrightness)
      }
    })
    return () => registerSave(null)
  }, [draftInterval, draftSyncBrightness, savedSyncBrightness, registerSave, setStoreSettings])

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
    <SettingsPageWrapper>
      <PageHeader title="DDC Display Control" description="Manage your connected displays" />

      <div className="mb-4">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-sm px-4 py-2 rounded font-medium transition-colors"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            border: 'none',
            cursor: isRefreshing ? 'default' : 'pointer',
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh Monitors'}
        </button>
      </div>

      {monitors.length > 0 && (
        <SettingSection title="Connected Monitors">
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {monitors.map((monitor) => (
              <div
                key={monitor.monitor_id}
                className="p-3.5 rounded"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="mb-2.5">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {monitor.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Monitor {monitor.monitor_id}
                  </p>
                </div>

                {monitor.supports.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    {monitor.supports.includes('brightness') && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Brightness</span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                          {monitor.brightness}%
                        </span>
                      </div>
                    )}
                    {monitor.supports.includes('contrast') && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Contrast</span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                          {monitor.contrast}%
                        </span>
                      </div>
                    )}
                    {monitor.supports.includes('input_source') && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Input</span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                          {monitor.input_source || '—'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {monitor.supports.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    {monitor.supports.map((feature) => (
                      <span
                        key={feature}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: 'var(--color-surface)',
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
        </SettingSection>
      )}

      {monitors.length === 0 && (
        <SettingSection>
          <div className="px-5 py-3.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No DDC-capable monitors detected. Make sure your displays support DDC/CI protocol.
          </div>
        </SettingSection>
      )}

      <SettingSection title="State Polling">
        <SettingRow
          label="Refresh Interval"
          description="How often the app polls displays for changes (10–3600 seconds)"
          stacked
          last
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={3600}
              value={draftInterval}
              onChange={(e) => setDraftInterval(e.target.value)}
              className="text-sm px-3 py-2 rounded w-32 font-mono"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                outline: 'none',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>seconds</span>
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Features">
        <SettingRow
          label="Sync Brightness"
          description="When enabled, adjusting brightness on one monitor will sync to all connected monitors"
          last
        >
          <ToggleSetting
            checked={draftSyncBrightness}
            onChange={() => setDraftSyncBrightness(!draftSyncBrightness)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Debug Information">
        <div className="px-5 py-3.5">
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Raw monitor data
          </p>
          <div
            className="p-3 rounded text-xs font-mono overflow-auto"
            style={{
              background: 'var(--color-code-bg)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              maxHeight: '240px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.5',
            }}
          >
            {monitors.length > 0 ? JSON.stringify(monitors, null, 2) : 'No monitor data available'}
          </div>
        </div>
      </SettingSection>

      <SettingSection>
        <div className="px-5 py-3.5">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            DDC/CI (Display Data Channel/Command Interface) allows software control of display brightness and other features. Not all monitors support this protocol.
          </p>
        </div>
      </SettingSection>
    </SettingsPageWrapper>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}): JSX.Element {
  return (
    <button
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--color-accent)' : 'var(--color-border)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 150ms',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          transition: 'left 150ms',
          display: 'block',
        }}
      />
    </button>
  )
}
