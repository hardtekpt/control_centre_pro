import { useEffect, useState, useRef } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import {
  PageHeader,
  SettingSection,
  SettingRow,
  ToggleSetting,
  SettingsPageWrapper,
} from '../../components/SettingsComponents'
import { SliderInput } from '../../components/SliderInput'
import { DDC_INPUT_NAMES } from '@shared/types'
import type { DdcMonitor } from '@shared/types'

// ─── Color preset constants (VCP 0x14) ──────────────────────────────────────
const COLOR_PRESETS = [
  { label: 'sRGB', value: 0x01 },
  { label: '5000K', value: 0x04 },
  { label: '6500K', value: 0x05 },
  { label: '9300K', value: 0x08 },
]

// ─── Main settings page ──────────────────────────────────────────────────────

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
    Promise.all([window.api.ddcGetPollInterval(), window.api.getSettings()])
      .then(([sec, settings]) => {
        setSavedInterval(sec)
        setDraftInterval(sec.toString())
        setSavedSyncBrightness(settings.ddcSyncBrightness)
        setDraftSyncBrightness(settings.ddcSyncBrightness)
      })
      .catch(console.error)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="DDC Display Control" description="Manage your connected displays" />
      <div className="flex-1 overflow-y-auto">
        <SettingsPageWrapper>
          {monitors.length > 0 && (
            <SettingSection>
              <div
                className="px-5 py-3.5 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Connected Monitors
                </h2>
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
              <div className="px-5 py-4 flex flex-col gap-4">
                {monitors.map((monitor) => (
                  <MonitorCard key={monitor.monitor_id} monitor={monitor} />
                ))}
              </div>
            </SettingSection>
          )}

          {monitors.length === 0 && (
            <SettingSection>
              <div className="px-5 py-8 flex flex-col items-center gap-2">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No DDC-capable monitors detected.
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Make sure your displays support DDC/CI and it is enabled in their OSD menu.
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-sm px-4 py-2 rounded font-medium mt-2"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-bg)',
                    border: 'none',
                    cursor: isRefreshing ? 'default' : 'pointer',
                    opacity: isRefreshing ? 0.6 : 1,
                  }}
                >
                  {isRefreshing ? 'Scanning…' : 'Scan for Monitors'}
                </button>
              </div>
            </SettingSection>
          )}

          <SettingSection title="Features">
            <SettingRow label="Refresh Interval">
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
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  seconds
                </span>
              </div>
            </SettingRow>
            <SettingRow
              label="Sync Brightness"
              description="Adjusting brightness on one monitor syncs to all connected monitors"
              last
            >
              <ToggleSetting
                checked={draftSyncBrightness}
                onChange={() => setDraftSyncBrightness(!draftSyncBrightness)}
              />
            </SettingRow>
          </SettingSection>
        </SettingsPageWrapper>
      </div>
    </div>
  )
}

// ─── Per-monitor card ────────────────────────────────────────────────────────

function MonitorCard({ monitor: initial }: { monitor: DdcMonitor }): JSX.Element {
  const [monitor, setMonitor] = useState(initial)
  const writeLockRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accept upstream updates only when not mid-drag (write lock active)
  useEffect(() => {
    if (!writeLockRef.current) {
      setMonitor(initial)
    }
  }, [initial])

  function lockWrite(): void {
    if (writeLockRef.current) clearTimeout(writeLockRef.current)
    writeLockRef.current = setTimeout(() => {
      writeLockRef.current = null
      setMonitor(initial)
    }, 1200)
  }

  const sup = monitor.supports

  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--color-surface-raised)' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {monitor.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Monitor {monitor.monitor_id}
            {monitor.vcp_version ? ` · VCP ${monitor.vcp_version}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {monitor.is_primary && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg)',
              }}
            >
              Primary
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>

        {/* Basic: brightness + contrast */}
        {(sup.includes('brightness') || sup.includes('contrast')) && (
          <FeatureSection label="Basic">
            {sup.includes('brightness') && (
              <SliderRow
                label="Brightness"
                value={monitor.brightness}
                max={100}
                unit="%"
                onChange={(v) => {
                  setMonitor((m) => ({ ...m, brightness: v }))
                  lockWrite()
                  window.api.ddcSetBrightness(monitor.monitor_id, v)
                }}
              />
            )}
            {sup.includes('contrast') && (
              <SliderRow
                label="Contrast"
                value={monitor.contrast}
                max={100}
                unit="%"
                onChange={(v) => {
                  setMonitor((m) => ({ ...m, contrast: v }))
                  lockWrite()
                  window.api.ddcSetContrast(monitor.monitor_id, v)
                }}
              />
            )}
          </FeatureSection>
        )}

        {/* Input source */}
        {sup.includes('input_source') && (
          <FeatureSection label="Input">
            <InputSourceSelector monitor={monitor} onSelect={(hex) => {
              setMonitor((m) => ({ ...m, input_source: hex }))
              window.api.ddcSetInputSource(monitor.monitor_id, hex)
            }} />
          </FeatureSection>
        )}

        {/* Color: preset + RGB gain */}
        {(sup.includes('color_preset') || sup.includes('rgb_gain')) && (
          <FeatureSection label="Color">
            {sup.includes('color_preset') && (
              <div className="py-1">
                <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Color Temperature
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setMonitor((m) => ({ ...m, color_preset: p.value }))
                        window.api.ddcSetColorPreset(monitor.monitor_id, p.value)
                      }}
                      className="text-xs px-3 py-1.5 rounded transition-colors"
                      style={{
                        background:
                          monitor.color_preset === p.value
                            ? 'var(--color-accent)'
                            : 'var(--color-surface)',
                        color:
                          monitor.color_preset === p.value
                            ? 'var(--color-bg)'
                            : 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sup.includes('rgb_gain') && (
              <div className="py-1 mt-1.5 space-y-2">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  RGB Gain
                </p>
                {monitor.red_gain !== null && (
                  <SliderRow
                    label="R"
                    labelColor="#e87070"
                    value={monitor.red_gain}
                    max={monitor.rgb_max}
                    onChange={(v) => {
                      setMonitor((m) => ({ ...m, red_gain: v }))
                      lockWrite()
                      window.api.ddcSetRedGain(monitor.monitor_id, v)
                    }}
                  />
                )}
                {monitor.green_gain !== null && (
                  <SliderRow
                    label="G"
                    labelColor="#6db96d"
                    value={monitor.green_gain}
                    max={monitor.rgb_max}
                    onChange={(v) => {
                      setMonitor((m) => ({ ...m, green_gain: v }))
                      lockWrite()
                      window.api.ddcSetGreenGain(monitor.monitor_id, v)
                    }}
                  />
                )}
                {monitor.blue_gain !== null && (
                  <SliderRow
                    label="B"
                    labelColor="#7090d8"
                    value={monitor.blue_gain}
                    max={monitor.rgb_max}
                    onChange={(v) => {
                      setMonitor((m) => ({ ...m, blue_gain: v }))
                      lockWrite()
                      window.api.ddcSetBlueGain(monitor.monitor_id, v)
                    }}
                  />
                )}
              </div>
            )}
          </FeatureSection>
        )}

        {/* Image: sharpness */}
        {sup.includes('sharpness') && monitor.sharpness !== null && (
          <FeatureSection label="Image">
            <SliderRow
              label="Sharpness"
              value={monitor.sharpness}
              max={monitor.sharpness_max}
              onChange={(v) => {
                setMonitor((m) => ({ ...m, sharpness: v }))
                lockWrite()
                window.api.ddcSetSharpness(monitor.monitor_id, v)
              }}
            />
          </FeatureSection>
        )}

        {/* Audio: volume + mute */}
        {(sup.includes('volume') || sup.includes('mute')) && (
          <FeatureSection label="Audio">
            {sup.includes('volume') && monitor.volume !== null && (
              <SliderRow
                label="Volume"
                value={monitor.volume}
                max={100}
                unit="%"
                onChange={(v) => {
                  setMonitor((m) => ({ ...m, volume: v }))
                  lockWrite()
                  window.api.ddcSetVolume(monitor.monitor_id, v)
                }}
              />
            )}
            {sup.includes('mute') && monitor.muted !== null && (
              <div className="py-1 flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Mute
                </span>
                <button
                  onClick={() => {
                    const next = !monitor.muted
                    setMonitor((m) => ({ ...m, muted: next }))
                    window.api.ddcSetMute(monitor.monitor_id, next)
                  }}
                  className="text-xs px-3 py-1.5 rounded transition-colors"
                  style={{
                    background: monitor.muted ? 'var(--color-accent)' : 'var(--color-surface)',
                    color: monitor.muted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {monitor.muted ? 'Muted' : 'Unmuted'}
                </button>
              </div>
            )}
          </FeatureSection>
        )}

        {/* Power */}
        <FeatureSection label="Power">
          <div className="py-1 flex items-center gap-2">
            <button
              onClick={() => {
                setMonitor((m) => ({ ...m, power_mode: 2 }))
                window.api.ddcSetPowerMode(monitor.monitor_id, 2)
              }}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Standby
            </button>
            <button
              onClick={() => {
                if (!window.confirm(`Turn off ${monitor.name}?`)) return
                setMonitor((m) => ({ ...m, power_mode: 4 }))
                window.api.ddcSetPowerMode(monitor.monitor_id, 4)
              }}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Turn Off
            </button>
          </div>
        </FeatureSection>

        {/* Info */}
        {(monitor.usage_time_hours !== null || monitor.vcp_version !== null) && (
          <CollapsibleSection label="Info">
            <div className="py-1 space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {monitor.usage_time_hours !== null && (
                <div className="flex justify-between">
                  <span>Usage Time</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {monitor.usage_time_hours.toLocaleString()} hrs
                  </span>
                </div>
              )}
              {monitor.vcp_version !== null && (
                <div className="flex justify-between">
                  <span>VCP Version</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{monitor.vcp_version}</span>
                </div>
              )}
              <div className="flex gap-1 flex-wrap pt-1">
                {monitor.supports.map((f) => (
                  <span
                    key={f}
                    className="px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-surface-raised)' }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Reset (danger zone) */}
        <CollapsibleSection label="Reset" danger>
          <div className="py-1 flex items-center gap-2">
            <button
              onClick={() => {
                if (!window.confirm(`Reset color settings on ${monitor.name}? This cannot be undone.`)) return
                window.api.ddcColorReset(monitor.monitor_id)
              }}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Reset Colors
            </button>
            <button
              onClick={() => {
                if (!window.confirm(`Factory reset ${monitor.name}? This will reset ALL monitor settings and cannot be undone.`)) return
                window.api.ddcFactoryReset(monitor.monitor_id)
              }}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: 'var(--color-surface)',
                color: '#c0392b',
                border: '1px solid #c0392b44',
                cursor: 'pointer',
              }}
            >
              Factory Reset
            </button>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}

// ─── Feature section header ──────────────────────────────────────────────────

function FeatureSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="px-4 py-3">
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.06em' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── Collapsible section (for Info and Reset) ────────────────────────────────

function CollapsibleSection({
  label,
  danger = false,
  children,
}: {
  label: string
  danger?: boolean
  children: React.ReactNode
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="px-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-3 text-xs font-semibold uppercase tracking-wide"
        style={{
          color: danger ? '#c0392b88' : 'var(--color-text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          letterSpacing: '0.06em',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

// ─── Slider row ──────────────────────────────────────────────────────────────

function SliderRow({
  label,
  labelColor,
  value,
  max,
  unit = '',
  onChange,
}: {
  label: string
  labelColor?: string
  value: number
  max: number
  unit?: string
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span
        className="text-xs shrink-0 w-16"
        style={{ color: labelColor ?? 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <div className="flex-1">
        <SliderInput
          value={max > 0 ? value / max : 0}
          onChange={(v) => onChange(Math.round(v * max))}
        />
      </div>
      <span
        className="text-xs shrink-0 w-10 text-right mono"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}{unit}
      </span>
    </div>
  )
}

// ─── Input source selector ───────────────────────────────────────────────────

function InputSourceSelector({
  monitor,
  onSelect,
}: {
  monitor: DdcMonitor
  onSelect: (hex: string) => void
}): JSX.Element {
  return (
    <div className="flex gap-1.5 flex-wrap py-1">
      {monitor.available_inputs.map((hex) => (
        <button
          key={hex}
          onClick={() => onSelect(hex)}
          className="text-xs px-3 py-1.5 rounded transition-colors"
          style={{
            background:
              monitor.input_source === hex ? 'var(--color-accent)' : 'var(--color-surface)',
            color:
              monitor.input_source === hex ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          {DDC_INPUT_NAMES[hex] ?? hex}
        </button>
      ))}
    </div>
  )
}
