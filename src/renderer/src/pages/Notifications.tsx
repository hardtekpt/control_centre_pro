import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useServiceStore } from '../stores/serviceStore'
import type {
  HeadsetNotificationSettings,
  NotifSimple,
  NotifValue,
  NotifBatteryLow,
  NotifSimpleShape,
  NotifValueShape,
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { IconHeadset } from '../components/notifications/icons'
import { createElement } from 'react'

// ── Save helper ───────────────────────────────────────────────────────────────

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

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex-shrink-0 relative rounded-full transition-colors"
      style={{
        width: 34,
        height: 20,
        background: value ? 'var(--color-accent)' : 'var(--color-border)',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          width: 14,
          height: 14,
          background: value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          top: 3,
          left: 3,
          transform: value ? 'translateX(14px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

// ── Segmented shape picker ────────────────────────────────────────────────────

interface ShapeOption<T extends string> {
  value: T
  label: string
}

function ShapePicker<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T
  options: ShapeOption<T>[]
  disabled?: boolean
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div
      className="flex overflow-hidden rounded flex-shrink-0"
      style={{
        border: `1px solid var(--color-border)`,
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="text-xs py-1 px-2.5 transition-colors"
          style={{
            background: value === opt.value ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: value === opt.value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            borderRight: i < options.length - 1 ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
            minWidth: 54,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
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
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>at</span>
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
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>%</span>
    </div>
  )
}

// ── Notification row ──────────────────────────────────────────────────────────

interface SimpleRowProps {
  label: string
  description?: string
  value: NotifSimple
  shapeOptions?: ShapeOption<NotifSimpleShape>[]
  onChange: (v: NotifSimple) => void
  onPreview: () => void
}

const SIMPLE_SHAPES: ShapeOption<NotifSimpleShape>[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'rect',   label: 'Rect'   },
]

function SimpleRow({ label, description, value, shapeOptions = SIMPLE_SHAPES, onChange, onPreview }: SimpleRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
        {description && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{description}</div>
        )}
      </div>
      <ShapePicker
        value={value.shape}
        options={shapeOptions}
        disabled={!value.enabled}
        onChange={(shape) => onChange({ ...value, shape })}
      />
      <button
        onClick={onPreview}
        className="text-xs px-2 py-1 rounded flex-shrink-0 transition-colors"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          opacity: value.enabled ? 1 : 0.4,
          pointerEvents: value.enabled ? 'auto' : 'none',
        }}
      >
        Preview
      </button>
      <Toggle value={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
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

const VALUE_SHAPES: ShapeOption<NotifValueShape>[] = [
  { value: 'volume', label: 'Slider' },
  { value: 'ring',   label: 'Ring'   },
]

function ValueRow({ label, description, value, onChange, onPreview }: ValueRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
        {description && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{description}</div>
        )}
      </div>
      <ShapePicker
        value={value.shape}
        options={VALUE_SHAPES}
        disabled={!value.enabled}
        onChange={(shape) => onChange({ ...value, shape })}
      />
      <button
        onClick={onPreview}
        className="text-xs px-2 py-1 rounded flex-shrink-0 transition-colors"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          opacity: value.enabled ? 1 : 0.4,
          pointerEvents: value.enabled ? 'auto' : 'none',
        }}
      >
        Preview
      </button>
      <Toggle value={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    </div>
  )
}

interface BatteryLowRowProps {
  value: NotifBatteryLow
  onChange: (v: NotifBatteryLow) => void
  onPreview: () => void
}

const BATTERY_LOW_SHAPES: ShapeOption<'ring' | 'rect'>[] = [
  { value: 'ring', label: 'Ring' },
  { value: 'rect', label: 'Rect' },
]

function BatteryLowRow({ value, onChange, onPreview }: BatteryLowRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Low battery</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Notify when headset battery drops below threshold</div>
      </div>
      <ThresholdInput
        value={value.threshold}
        disabled={!value.enabled}
        onChange={(threshold) => onChange({ ...value, threshold })}
      />
      <ShapePicker
        value={value.shape}
        options={BATTERY_LOW_SHAPES}
        disabled={!value.enabled}
        onChange={(shape) => onChange({ ...value, shape })}
      />
      <button
        onClick={onPreview}
        className="text-xs px-2 py-1 rounded flex-shrink-0 transition-colors"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          opacity: value.enabled ? 1 : 0.4,
          pointerEvents: value.enabled ? 'auto' : 'none',
        }}
      >
        Preview
      </button>
      <Toggle value={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div
      className="rounded-xl px-5 pt-4 pb-2"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ── Notifications page ────────────────────────────────────────────────────────

export function Notifications(): JSX.Element {
  const settings = useServiceStore((s) => s.settings)

  const [headset, setHeadsetRaw] = useState<HeadsetNotificationSettings>(
    settings.notifications?.headset ?? DEFAULT_SETTINGS.notifications.headset
  )

  // Sync if store settings change (e.g. on initial load)
  useEffect(() => {
    if (settings.notifications?.headset) {
      setHeadsetRaw(settings.notifications.headset)
    }
  }, [settings.notifications?.headset])

  const setHeadset = useCallback((next: HeadsetNotificationSettings): void => {
    setHeadsetRaw(next)
    saveHeadsetSettings(next).catch(console.error)
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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <PageIcon />
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Notifications
          </h1>
        </div>
        <p className="text-sm pl-11" style={{ color: 'var(--color-text-secondary)' }}>
          Configure notifications for connected devices. They appear as a floating overlay at the bottom of the screen. Click Preview to test any shape.
        </p>
      </div>

      {/* Headset section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
            {createElement(IconHeadset, { size: 18 })}
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Arctis Nova Pro</span>
        </div>

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
  )
}

function PageIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary)' }}>
      <path d="M7 1.5A4 4 0 0 0 3 5.5v2.5L2 9.5h10l-1-1.5V5.5A4 4 0 0 0 7 1.5z" />
      <path d="M5.5 9.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  )
}
