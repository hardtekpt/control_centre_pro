import { useState, useCallback, useEffect, useRef, createElement, type ReactNode } from 'react'
import { useServiceStore } from '../stores/serviceStore'
import type {
  HeadsetNotificationSettings,
  SonarNotificationSettings,
  DisplayNotificationSettings,
  NotifSimple,
  NotifValue,
  NotifBatteryLow,
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { IconHeadset } from '../components/notifications/icons'
import { MainPageHeader, type FilterChipDef } from '../components/MainPageHeader'
import { Toggle } from '../components/plugins/Toggle'

// ── Save helpers ──────────────────────────────────────────────────────────────

async function saveHeadsetSettings(headset: HeadsetNotificationSettings): Promise<void> {
  const current = await window.api.getSettings()
  await window.api.setSettings({
    ...current,
    notifications: { ...current.notifications, headset },
  })
  useServiceStore.getState().setSettings({
    ...current,
    notifications: { ...current.notifications, headset },
  })
}

async function saveSonarSettings(sonar: SonarNotificationSettings): Promise<void> {
  const current = await window.api.getSettings()
  await window.api.setSettings({
    ...current,
    notifications: { ...current.notifications, sonar },
  })
  useServiceStore.getState().setSettings({
    ...current,
    notifications: { ...current.notifications, sonar },
  })
}

async function saveDisplaySettings(display: DisplayNotificationSettings): Promise<void> {
  const current = await window.api.getSettings()
  await window.api.setSettings({
    ...current,
    notifications: { ...current.notifications, display },
  })
  useServiceStore.getState().setSettings({
    ...current,
    notifications: { ...current.notifications, display },
  })
}

// ── Shape icon toggle ─────────────────────────────────────────────────────────

function ShapeIconButton({
  shape,
  disabled,
  onClick,
}: {
  shape: string
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  const isCircular = shape === 'circle' || shape === 'ring'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={isCircular ? 'Circle notification — click to switch to Rect' : 'Rect notification — click to switch to Circle'}
      style={{
        background: 'none',
        border: 'none',
        padding: 2,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 0.6,
        color: 'var(--color-text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderRadius: 4,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = disabled ? '0.35' : '0.6' }}
    >
      {isCircular ? (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="10" cy="10" r="7" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="2" y="5" width="16" height="10" rx="2.5" />
        </svg>
      )}
    </button>
  )
}

// ── Threshold input ───────────────────────────────────────────────────────────

function ThresholdInput({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}): JSX.Element {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = (): void => {
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n >= 1 && n <= 99) {
      onChange(n)
    } else {
      setDraft(String(value))
    }
  }

  return (
    <div
      className="flex items-center gap-1 flex-shrink-0"
      style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <span className="card-row-label">at</span>
      <input
        type="number"
        min={1}
        max={99}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="mono rounded text-xs text-center"
        style={{
          width: 42,
          padding: '2px 4px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
      />
      <span className="card-row-label">%</span>
    </div>
  )
}

// ── Notification row ──────────────────────────────────────────────────────────

interface SimpleRowProps {
  label: string
  description?: string
  value: NotifSimple
  onChange: (v: NotifSimple) => void
  onPreview: () => void
}

function SimpleRow({ label, description, value, onChange, onPreview }: SimpleRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <button
          onClick={onPreview}
          disabled={!value.enabled}
          className="card-title text-left transition-colors"
          style={{
            color: value.enabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: value.enabled ? 'pointer' : 'default',
            padding: 0,
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
            textDecorationThickness: '1px',
            textUnderlineOffset: '3px',
          }}
          onMouseEnter={(e) => {
            if (value.enabled) {
              e.currentTarget.style.textDecorationColor = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecorationColor = 'transparent';
          }}
        >
          {label}
        </button>
        {description && (
          <div className="card-row-label mt-0.5">{description}</div>
        )}
      </div>
      <ShapeIconButton
        shape={value.shape}
        disabled={!value.enabled}
        onClick={() => onChange({ ...value, shape: value.shape === 'circle' ? 'rect' : 'circle' })}
      />
      <Toggle checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    </div>
  )
}

interface ValueRowProps {
  label: string
  description?: string
  value: NotifValue
  onChange: (v: NotifValue) => void
  onPreview: () => void
}

function ValueRow({ label, description, value, onChange, onPreview }: ValueRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <button
          onClick={onPreview}
          disabled={!value.enabled}
          className="card-title text-left transition-colors"
          style={{
            color: value.enabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: value.enabled ? 'pointer' : 'default',
            padding: 0,
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
            textDecorationThickness: '1px',
            textUnderlineOffset: '3px',
          }}
          onMouseEnter={(e) => {
            if (value.enabled) {
              e.currentTarget.style.textDecorationColor = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecorationColor = 'transparent';
          }}
        >
          {label}
        </button>
        {description && (
          <div className="card-row-label mt-0.5">{description}</div>
        )}
      </div>
      <ShapeIconButton
        shape={value.shape}
        disabled={!value.enabled}
        onClick={() => onChange({ ...value, shape: value.shape === 'ring' ? 'volume' : 'ring' })}
      />
      <Toggle checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    </div>
  )
}

interface BatteryLowRowProps {
  value: NotifBatteryLow
  onChange: (v: NotifBatteryLow) => void
  onPreview: () => void
}

function BatteryLowRow({ value, onChange, onPreview }: BatteryLowRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <button
          onClick={onPreview}
          disabled={!value.enabled}
          className="card-title text-left transition-colors"
          style={{
            color: value.enabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: value.enabled ? 'pointer' : 'default',
            padding: 0,
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
            textDecorationThickness: '1px',
            textUnderlineOffset: '3px',
          }}
          onMouseEnter={(e) => {
            if (value.enabled) {
              e.currentTarget.style.textDecorationColor = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecorationColor = 'transparent';
          }}
        >
          Low battery
        </button>
        <div className="card-row-label mt-0.5">Notify when headset battery drops below threshold</div>
      </div>
      <ThresholdInput
        value={value.threshold}
        disabled={!value.enabled}
        onChange={(threshold) => onChange({ ...value, threshold })}
      />
      <ShapeIconButton
        shape={value.shape}
        disabled={!value.enabled}
        onClick={() => onChange({ ...value, shape: value.shape === 'ring' ? 'rect' : 'ring' })}
      />
      <Toggle checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="card pb-1">
      <h2 className="card-field-label mb-2">{title}</h2>
      {children}
    </div>
  )
}

// ── Notifications page ────────────────────────────────────────────────────────

export function Notifications(): JSX.Element {
  const settings = useServiceStore((s) => s.settings)
  const services = useServiceStore((s) => s.services)
  const notifService = services.find((s) => s.id === 'notifications')

  const [headset, setHeadsetRaw] = useState<HeadsetNotificationSettings>(
    settings.notifications?.headset ?? DEFAULT_SETTINGS.notifications.headset
  )
  const [sonar, setSonarRaw] = useState<SonarNotificationSettings>(
    settings.notifications?.sonar ?? DEFAULT_SETTINGS.notifications.sonar
  )
  const [display, setDisplayRaw] = useState<DisplayNotificationSettings>(
    settings.notifications?.display ?? DEFAULT_SETTINGS.notifications.display
  )

  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Sync if store settings change (e.g. on initial load)
  useEffect(() => {
    if (settings.notifications?.headset) {
      setHeadsetRaw(settings.notifications.headset)
    }
  }, [settings.notifications?.headset])

  useEffect(() => {
    if (settings.notifications?.sonar) {
      setSonarRaw(settings.notifications.sonar)
    }
  }, [settings.notifications?.sonar])

  useEffect(() => {
    if (settings.notifications?.display) {
      setDisplayRaw(settings.notifications.display)
    }
  }, [settings.notifications?.display])

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !inInput) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const setHeadset = useCallback((next: HeadsetNotificationSettings): void => {
    setHeadsetRaw(next)
    saveHeadsetSettings(next).catch(console.error)
  }, [])

  const setSonar = useCallback((next: SonarNotificationSettings): void => {
    setSonarRaw(next)
    saveSonarSettings(next).catch(console.error)
  }, [])

  const setDisplay = useCallback((next: DisplayNotificationSettings): void => {
    setDisplayRaw(next)
    saveDisplaySettings(next).catch(console.error)
  }, [])

  // ── Preview helpers — route through overlay window via IPC ──────────────────

  const previewPowerOn = (): void => {
    const cfg = headset.powerOnOff
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-power', iconId: 'link', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-power', iconId: 'link', title: 'Arctis Nova Pro', subtitle: 'Connected · ready', ttl: 2400 })
    }
  }

  const previewPowerOff = (): void => {
    const cfg = headset.powerOnOff
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-power', iconId: 'unlink', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-power', iconId: 'unlink', title: 'Arctis Nova Pro', subtitle: 'Disconnected', ttl: 2400 })
    }
  }

  const previewWireless = (): void => {
    const cfg = headset.wireless
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-wireless', iconId: 'wireless', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-wireless', iconId: 'wireless', title: 'Wireless connected', subtitle: '2.4 GHz link active', ttl: 2400 })
    }
  }

  const previewBluetooth = (): void => {
    const cfg = headset.bluetooth
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-bt', iconId: 'bluetooth', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-bt', iconId: 'bluetooth', title: 'Bluetooth connected', subtitle: 'BT device paired and active', ttl: 2400 })
    }
  }

  const previewBatteryLow = (): void => {
    const cfg = headset.batteryLow
    if (cfg.shape === 'ring') {
      window.api.notifPush({ kind: 'ring', key: 'preview-battery-low', iconId: 'battery-low', value: cfg.threshold - 1, ttl: 4000 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-battery-low', iconId: 'battery-low', title: 'Low battery', subtitle: `Headset at ${cfg.threshold - 1}%`, tail: `${cfg.threshold - 1}%`, ttl: 4000 })
    }
  }

  const previewCharging = (): void => {
    const cfg = headset.batteryCharging
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-charging', iconId: 'battery-charging', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-charging', iconId: 'battery-charging', title: 'Charging', subtitle: 'Headset at 45%', ttl: 2400 })
    }
  }

  const previewDock = (): void => {
    const cfg = headset.batteryDock
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-dock', iconId: 'battery', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-dock', iconId: 'battery', title: 'Dock inserted', subtitle: 'Dock at 100%', ttl: 2400 })
    }
  }

  const previewAnc = (): void => {
    const cfg = headset.ancMode
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-anc', iconId: 'anc', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-anc', iconId: 'anc', title: 'Noise cancellation', subtitle: 'Active · ambient suppressed', ttl: 2400 })
    }
  }

  const previewMicMute = (): void => {
    const cfg = headset.micMute
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-mic', iconId: 'mic-off', ttl: 1800 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-mic', iconId: 'mic-off', title: 'Mic muted', subtitle: 'Microphone is muted', ttl: 1800 })
    }
  }

  const previewVolume = (): void => {
    const cfg = headset.volume
    if (cfg.shape === 'volume') {
      window.api.notifPush({ kind: 'volume', key: 'preview-vol', iconId: 'volume', label: 'Headset volume', value: 72, ttl: 1800 })
    } else {
      window.api.notifPush({ kind: 'ring', key: 'preview-vol', iconId: 'volume', value: 72, ttl: 1800 })
    }
  }

  const previewChatmix = (): void => {
    const cfg = headset.chatmix
    if (cfg.shape === 'volume') {
      window.api.notifPush({ kind: 'volume', key: 'preview-chatmix', iconId: 'chatmix', label: 'ChatMix · Game', value: 65, ttl: 1800 })
    } else {
      window.api.notifPush({ kind: 'ring', key: 'preview-chatmix', iconId: 'chatmix', value: 65, ttl: 1800 })
    }
  }

  const previewSidetone = (): void => {
    const cfg = headset.sidetone
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-sidetone', iconId: 'sidetone', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-sidetone', iconId: 'sidetone', title: 'Sidetone', subtitle: 'Medium', ttl: 2400 })
    }
  }

  const previewSonarPresetChange = (): void => {
    const cfg = sonar.presetChange
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-sonar-preset', iconId: 'sonar', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-sonar-preset', iconId: 'sonar', title: 'GG Sonar', subtitle: 'Preset: Balanced', ttl: 2400 })
    }
  }

  const previewDisplayInputChange = (): void => {
    const cfg = display.inputSourceChange
    if (cfg.shape === 'circle') {
      window.api.notifPush({ kind: 'circle', key: 'preview-display-input', iconId: 'monitor', ttl: 2400 })
    } else {
      window.api.notifPush({ kind: 'rect', key: 'preview-display-input', iconId: 'monitor', title: 'Display', subtitle: 'Input: HDMI 1', ttl: 2400 })
    }
  }

  // Count enabled notifications per device
  const countEnabled = (section: 'headset' | 'sonar' | 'display'): number => {
    let count = 0
    if (section === 'headset') {
      count += headset.powerOnOff.enabled ? 1 : 0
      count += headset.wireless.enabled ? 1 : 0
      count += headset.bluetooth.enabled ? 1 : 0
      count += headset.batteryLow.enabled ? 1 : 0
      count += headset.batteryCharging.enabled ? 1 : 0
      count += headset.batteryDock.enabled ? 1 : 0
      count += headset.ancMode.enabled ? 1 : 0
      count += headset.micMute.enabled ? 1 : 0
      count += headset.volume.enabled ? 1 : 0
      count += headset.chatmix.enabled ? 1 : 0
      count += headset.sidetone.enabled ? 1 : 0
    } else if (section === 'sonar') {
      count += sonar.presetChange.enabled ? 1 : 0
    } else if (section === 'display') {
      count += display.inputSourceChange.enabled ? 1 : 0
    }
    return count
  }

  // Count total enabled
  const totalEnabled = countEnabled('headset') + countEnabled('sonar') + countEnabled('display')

  // Filter sections by search
  const matchesSearch = (text: string): boolean => {
    if (!search.trim()) return true
    return text.toLowerCase().includes(search.toLowerCase())
  }

  const showHeadset = (filter === 'all' || filter === 'headset') && matchesSearch('arctis nova pro')
  const showSonar = (filter === 'all' || filter === 'sonar') && matchesSearch('gg sonar')
  const showDisplay = (filter === 'all' || filter === 'display') && matchesSearch('display')

  const notifChips: FilterChipDef[] = [
    { id: 'all',     label: 'All',            count: countEnabled('headset') + countEnabled('sonar') + countEnabled('display') },
    { id: 'headset', label: 'Arctis Nova Pro', count: countEnabled('headset') },
    { id: 'sonar',   label: 'GG Sonar',        count: countEnabled('sonar') },
    { id: 'display', label: 'Display',          count: countEnabled('display') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <MainPageHeader
        title="Notifications"
        subtitle={`${totalEnabled} enabled${notifService ? ` · ${notifService.enabled ? 'Service active' : 'Service disabled'}` : ''}`}
        chips={notifChips}
        activeChip={filter}
        onChipSelect={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchRef={searchRef}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <div className="flex flex-col gap-5 p-5">

        {/* Headset section */}
        {showHeadset && (
        <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
            {createElement(IconHeadset, { size: 18 })}
          </div>
          <span className="card-title">Arctis Nova Pro</span>
        </div>

        {/* Grid layout for sections */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '0.75rem' }}>
          {/* Connectivity */}
          <Section title="Connectivity">
            <SimpleRow
              label="Power on / off"
              description="Headset connected to or disconnected from Control Centre"
              value={headset.powerOnOff}
              onChange={(v) => setHeadset({ ...headset, powerOnOff: v })}
              onPreview={headset.powerOnOff.enabled ? previewPowerOn : previewPowerOff}
            />
            <SimpleRow
              label="Wireless"
              description="2.4 GHz link established or dropped"
              value={headset.wireless}
              onChange={(v) => setHeadset({ ...headset, wireless: v })}
              onPreview={previewWireless}
            />
            <SimpleRow
              label="Bluetooth"
              description="BT device paired and connected or disconnected"
              value={headset.bluetooth}
              onChange={(v) => setHeadset({ ...headset, bluetooth: v })}
              onPreview={previewBluetooth}
            />
          </Section>

          {/* Battery */}
          <Section title="Battery">
            <BatteryLowRow
              value={headset.batteryLow}
              onChange={(v) => setHeadset({ ...headset, batteryLow: v })}
              onPreview={previewBatteryLow}
            />
            <SimpleRow
              label="Charging started"
              description="Detected when headset battery level increases"
              value={headset.batteryCharging}
              onChange={(v) => setHeadset({ ...headset, batteryCharging: v })}
              onPreview={previewCharging}
            />
            <SimpleRow
              label="Dock inserted / removed"
              description="Fires when dock battery goes from 0 to active or back"
              value={headset.batteryDock}
              onChange={(v) => setHeadset({ ...headset, batteryDock: v })}
              onPreview={previewDock}
            />
          </Section>

          {/* ANC */}
          <Section title="ANC Mode">
            <SimpleRow
              label="ANC mode changed"
              description="Noise cancellation, Transparency, or ANC off"
              value={headset.ancMode}
              onChange={(v) => setHeadset({ ...headset, ancMode: v })}
              onPreview={previewAnc}
            />
          </Section>

          {/* Mic */}
          <Section title="Microphone">
            <SimpleRow
              label="Mic mute / unmute"
              description="Hardware mute button pressed"
              value={headset.micMute}
              onChange={(v) => setHeadset({ ...headset, micMute: v })}
              onPreview={previewMicMute}
            />
          </Section>

          {/* Volume */}
          <Section title="Volume">
            <ValueRow
              label="Headset volume"
              description="Hardware volume dial turned"
              value={headset.volume}
              onChange={(v) => setHeadset({ ...headset, volume: v })}
              onPreview={previewVolume}
            />
            <ValueRow
              label="ChatMix"
              description="Game / chat balance dial adjusted"
              value={headset.chatmix}
              onChange={(v) => setHeadset({ ...headset, chatmix: v })}
              onPreview={previewChatmix}
            />
          </Section>

          {/* Sidetone */}
          <Section title="Sidetone">
            <SimpleRow
              label="Sidetone level changed"
              description="Off, Low, Medium, or High"
              value={headset.sidetone}
              onChange={(v) => setHeadset({ ...headset, sidetone: v })}
              onPreview={previewSidetone}
            />
          </Section>
        </div>
      </div>
        )}

        {/* Sonar section */}
        {showSonar && (
        <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9z" />
              <path d="M9 5v8l6 0" />
            </svg>
          </div>
          <span className="card-title">GG Sonar</span>
        </div>

        {/* Grid layout for sections */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '0.75rem' }}>
          {/* Presets */}
          <Section title="Presets">
            <SimpleRow
              label="Preset changed"
              description="Audio profile switched to a different preset"
              value={sonar.presetChange}
              onChange={(v) => setSonar({ ...sonar, presetChange: v })}
              onPreview={previewSonarPresetChange}
            />
          </Section>
        </div>
      </div>
        )}

        {/* Display section */}
        {showDisplay && (
        <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="2" y1="17" x2="22" y2="17" />
            </svg>
          </div>
          <span className="card-title">Display</span>
        </div>

        {/* Grid layout for sections */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '0.75rem' }}>
          {/* Input source */}
          <Section title="Input">
            <SimpleRow
              label="Input source changed"
              description="Display switched to a different input (HDMI, DisplayPort, etc.)"
              value={display.inputSourceChange}
              onChange={(v) => setDisplay({ ...display, inputSourceChange: v })}
              onPreview={previewDisplayInputChange}
            />
          </Section>
        </div>
      </div>
        )}

        {/* Empty state */}
        {!showHeadset && !showSonar && !showDisplay && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            gap: 8,
          }}
        >
          {search ? `No notifications match "${search}"` : 'No notifications found.'}
        </div>
        )}
        </div>
      </div>
    </div>
  )
}

