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

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'transform 0.15s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

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
                className="px-5 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Connected Monitors
                </h2>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    cursor: isRefreshing ? 'default' : 'pointer',
                    opacity: isRefreshing ? 0.6 : 1,
                  }}
                >
                  {isRefreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2">
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
  const [expanded, setExpanded] = useState(false)
  const writeLockRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      {/* Header — click to collapse/expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 pt-3 pb-2.5 flex flex-col gap-1.5 text-left"
        style={{
          background: 'var(--color-surface-raised)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* Row 1: name + primary badge + chevron */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
            {monitor.name}
          </p>
          {monitor.is_primary && (
            <span
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
            >
              Primary
            </span>
          )}
          <span className="shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
            <ChevronIcon open={expanded} />
          </span>
        </div>

        {/* Row 2: feature tags */}
        <div className="flex flex-wrap gap-1">
          {sup.map((f) => (
            <span
              key={f}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {f}
            </span>
          ))}
        </div>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div
          className="px-4 py-3 gap-x-6 gap-y-3"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}
        >
            {/* Left column: brightness, contrast, sharpness, audio, rgb gain */}
            <div className="flex flex-col gap-3">
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
              {sup.includes('sharpness') && monitor.sharpness !== null && (
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
              )}
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
                <div className="flex items-center justify-between">
                  <span className="text-xs w-16 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                    Mute
                  </span>
                  <ToggleSetting
                    checked={monitor.muted}
                    onChange={() => {
                      const next = !monitor.muted
                      setMonitor((m) => ({ ...m, muted: next }))
                      window.api.ddcSetMute(monitor.monitor_id, next)
                    }}
                  />
                </div>
              )}
              {sup.includes('rgb_gain') && (
                <>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>RGB Gain</p>
                  {monitor.red_gain !== null && (
                    <SliderRow
                      label="R"
                      labelColor="var(--color-rgb-r)"
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
                      labelColor="var(--color-rgb-g)"
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
                      labelColor="var(--color-rgb-b)"
                      value={monitor.blue_gain}
                      max={monitor.rgb_max}
                      onChange={(v) => {
                        setMonitor((m) => ({ ...m, blue_gain: v }))
                        lockWrite()
                        window.api.ddcSetBlueGain(monitor.monitor_id, v)
                      }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Right column: input source, color temp, power */}
            <div className="flex flex-col gap-3">
              {sup.includes('input_source') && monitor.available_inputs.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Input Source</p>
                  <select
                    value={monitor.input_source}
                    onChange={(e) => {
                      const hex = e.currentTarget.value
                      setMonitor((m) => ({ ...m, input_source: hex }))
                      window.api.ddcSetInputSource(monitor.monitor_id, hex)
                    }}
                    className="w-full text-xs p-1.5 rounded"
                    style={{
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {monitor.available_inputs.map((hex) => (
                      <option key={hex} value={hex}>
                        {DDC_INPUT_NAMES[hex] ?? hex}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sup.includes('color_preset') && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Color Temperature</p>
                  <select
                    value={monitor.color_preset ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.currentTarget.value, 10)
                      if (isNaN(val)) return
                      setMonitor((m) => ({ ...m, color_preset: val }))
                      window.api.ddcSetColorPreset(monitor.monitor_id, val)
                    }}
                    className="w-full text-xs p-1.5 rounded"
                    style={{
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {COLOR_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Power controls */}
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Power</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setMonitor((m) => ({ ...m, power_mode: 2 }))
                      window.api.ddcSetPowerMode(monitor.monitor_id, 2)
                    }}
                    className="text-xs px-2.5 py-1 rounded flex-1"
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
                    className="text-xs px-2.5 py-1 rounded flex-1"
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
              </div>

              {/* Reset controls */}
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Reset</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      if (!window.confirm(`Reset color settings on ${monitor.name}? This cannot be undone.`)) return
                      window.api.ddcColorReset(monitor.monitor_id)
                    }}
                    className="text-xs px-2.5 py-1 rounded flex-1"
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
                    className="text-xs px-2.5 py-1 rounded flex-1"
                    style={{
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Factory Reset
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}
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
    <div className="flex items-center gap-2">
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
          disableWheel
        />
      </div>
      <span
        className="text-xs shrink-0 w-9 text-right mono"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}{unit}
      </span>
    </div>
  )
}
