import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type { MonitorInputAction, UsbDevice } from '@shared/types'
import { DDC_INPUT_NAMES } from '@shared/types'
import type { Plugin } from '@shared/types'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { useServiceStore } from '../../stores/serviceStore'

// ── Custom device dropdown ────────────────────────────────────────────────────

interface DropdownOption {
  value: string
  label: string
}

interface DeviceOptionProps {
  label: string
  value: string
  isSelected: boolean
  onSelect: (value: string) => void
}

function DeviceOption({ label, value, isSelected, onSelect }: DeviceOptionProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const [dist, setDist] = useState(0)

  const handleMouseEnter = (): void => {
    if (labelRef.current && containerRef.current) {
      const overflow = labelRef.current.scrollWidth - containerRef.current.clientWidth
      setDist(overflow > 0 ? overflow + 8 : 0)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`kvm-option${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(value)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setDist(0)}
      style={{ '--kvm-dist': `-${dist}px` } as React.CSSProperties}
    >
      <span ref={labelRef} className={dist > 0 ? 'scrolling' : ''}>
        {label}
      </span>
    </div>
  )
}

interface DeviceSelectProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  placeholder?: string
  loading?: boolean
}

function DeviceSelect({ value, onChange, options, placeholder = '— None selected —', loading }: DeviceSelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const selected = options.find((o) => o.value === value)

  const openDropdown = (): void => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setRect(r)
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <div
        ref={triggerRef}
        className={`kvm-trigger${open ? ' open' : ''}`}
        onClick={openDropdown}
        role="combobox"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown() }
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        <span className="kvm-trigger-text">
          {loading ? 'Loading…' : (selected?.label ?? placeholder)}
        </span>
        <svg className="kvm-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && rect && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="kvm-dropdown"
          style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
        >
          <DeviceOption
            label={placeholder}
            value=""
            isSelected={!value}
            onSelect={(v) => { onChange(v); setOpen(false) }}
          />
          {options.map((o) => (
            <DeviceOption
              key={o.value}
              label={o.label}
              value={o.value}
              isSelected={o.value === value}
              onSelect={(v) => { onChange(v); setOpen(false) }}
            />
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Action row ────────────────────────────────────────────────────────────────

interface ActionRowProps {
  action: MonitorInputAction
  monitorOptions: Array<{ id: number; name: string }>
  getInputsForMonitor: (id: number) => string[]
  onChange: (next: MonitorInputAction) => void
  onRemove: () => void
}

function ActionRow({ action, monitorOptions, getInputsForMonitor, onChange, onRemove }: ActionRowProps): JSX.Element {
  const inputs = getInputsForMonitor(action.monitorId)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <select
        value={action.monitorId}
        onChange={(e) => {
          const nextId = Number(e.target.value)
          const nextInputs = getInputsForMonitor(nextId)
          onChange({ monitorId: nextId, inputValue: nextInputs[0] ?? '' })
        }}
        className="input"
        style={{ flex: '1 1 0', minWidth: 0 }}
      >
        <option value={0} disabled>Select monitor…</option>
        {monitorOptions.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', flexShrink: 0 }}>→</span>
      <select
        value={action.inputValue}
        onChange={(e) => onChange({ ...action, inputValue: e.target.value })}
        className="input"
        style={{ flex: '1 1 0', minWidth: 0 }}
      >
        <option value="" disabled>Select input…</option>
        {inputs.map((hex) => (
          <option key={hex} value={hex}>{DDC_INPUT_NAMES[hex] ?? hex}</option>
        ))}
      </select>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontSize: '16px',
          lineHeight: 1,
          padding: '0 2px',
          flexShrink: 0,
        }}
        title="Remove rule"
      >
        ×
      </button>
    </div>
  )
}

// ── Action list section ───────────────────────────────────────────────────────

interface ActionListSectionProps {
  title: string
  desc: string
  actions: MonitorInputAction[]
  monitorOptions: Array<{ id: number; name: string }>
  getInputsForMonitor: (id: number) => string[]
  onChange: (next: MonitorInputAction[]) => void
}

function ActionListSection({ title, desc, actions, monitorOptions, getInputsForMonitor, onChange }: ActionListSectionProps): JSX.Element {
  const addRow = (): void => {
    const firstMonitor = monitorOptions[0]
    if (!firstMonitor) return
    const inputs = getInputsForMonitor(firstMonitor.id)
    onChange([...actions, { monitorId: firstMonitor.id, inputValue: inputs[0] ?? '' }])
  }

  return (
    <div className="cfg-section">
      <div className="cfg-section-h">
        <h3>{title}</h3>
        <span className="desc">{desc}</span>
      </div>
      {actions.map((action, i) => (
        <div key={i} className="ff" style={{ display: 'block' }}>
          <ActionRow
            action={action}
            monitorOptions={monitorOptions}
            getInputsForMonitor={getInputsForMonitor}
            onChange={(next) => {
              const updated = [...actions]
              updated[i] = next
              onChange(updated)
            }}
            onRemove={() => onChange(actions.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <div style={{ paddingTop: actions.length > 0 ? '4px' : 0 }}>
        <button
          onClick={addRow}
          className="btn-ghost"
          disabled={monitorOptions.length === 0}
        >
          + Add rule
        </button>
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

interface Props {
  plugin: Plugin
}

export function KvmConfigSection({ plugin }: Props): JSX.Element {
  const { setDirty, registerSave } = useSettingsForm()
  const { ddcMonitors } = useServiceStore()

  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)

  const [savedDeviceId, setSavedDeviceId] = useState('')
  const [draftDeviceId, setDraftDeviceId] = useState('')

  const [savedConnected, setSavedConnected] = useState<MonitorInputAction[]>([])
  const [draftConnected, setDraftConnected] = useState<MonitorInputAction[]>([])

  const [savedDisconnected, setSavedDisconnected] = useState<MonitorInputAction[]>([])
  const [draftDisconnected, setDraftDisconnected] = useState<MonitorInputAction[]>([])

  const draftDeviceIdRef = useRef(draftDeviceId)
  const draftConnectedRef = useRef(draftConnected)
  const draftDisconnectedRef = useRef(draftDisconnected)

  useEffect(() => { draftDeviceIdRef.current = draftDeviceId }, [draftDeviceId])
  useEffect(() => { draftConnectedRef.current = draftConnected }, [draftConnected])
  useEffect(() => { draftDisconnectedRef.current = draftDisconnected }, [draftDisconnected])

  const loadDevices = (): void => {
    setLoadingDevices(true)
    window.api.kvmListUsbDevices()
      .then(setUsbDevices)
      .catch(console.error)
      .finally(() => setLoadingDevices(false))
  }

  useEffect(() => {
    window.api.getSettings()
      .then((s) => {
        const devId = s.kvmDeviceInstanceId ?? ''
        const connected = s.kvmConnectedActions ?? []
        const disconnected = s.kvmDisconnectedActions ?? []
        setSavedDeviceId(devId)
        setDraftDeviceId(devId)
        setSavedConnected(connected)
        setDraftConnected(connected)
        setSavedDisconnected(disconnected)
        setDraftDisconnected(disconnected)
      })
      .catch(console.error)

    loadDevices()
  }, [])

  useEffect(() => {
    const isDirty =
      draftDeviceId !== savedDeviceId ||
      JSON.stringify(draftConnected) !== JSON.stringify(savedConnected) ||
      JSON.stringify(draftDisconnected) !== JSON.stringify(savedDisconnected)
    setDirty(isDirty)
  }, [draftDeviceId, savedDeviceId, draftConnected, savedConnected, draftDisconnected, savedDisconnected, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const current = await window.api.getSettings()
      await window.api.setSettings({
        ...current,
        kvmEnabled: plugin.enabled,
        kvmDeviceInstanceId: draftDeviceIdRef.current,
        kvmConnectedActions: draftConnectedRef.current,
        kvmDisconnectedActions: draftDisconnectedRef.current,
      })
      setSavedDeviceId(draftDeviceIdRef.current)
      setSavedConnected(draftConnectedRef.current)
      setSavedDisconnected(draftDisconnectedRef.current)
    })
    return () => registerSave(null)
  }, [registerSave, plugin.enabled])

  const handleReset = async (): Promise<void> => {
    const current = await window.api.getSettings()
    await window.api.setSettings({
      ...current,
      kvmEnabled: false,
      kvmDeviceInstanceId: '',
      kvmConnectedActions: [],
      kvmDisconnectedActions: [],
    })
    setDraftDeviceId('')
    setSavedDeviceId('')
    setDraftConnected([])
    setSavedConnected([])
    setDraftDisconnected([])
    setSavedDisconnected([])
  }

  const monitorOptions = ddcMonitors.map((m) => ({ id: m.monitor_id, name: m.name }))
  const getInputsForMonitor = (id: number): string[] => {
    const m = ddcMonitors.find((mon) => mon.monitor_id === id)
    return m?.available_inputs ?? []
  }

  const deviceOptions: DropdownOption[] = usbDevices.map((d) => ({
    value: d.instanceId,
    label: d.friendlyName,
  }))

  const noDevice = !draftDeviceId

  return (
    <>
      {noDevice && (
        <div className="banner info">
          <div className="banner-content">
            <div className="banner-title">No device configured</div>
            <div className="banner-sub">Select a USB device below to start tracking KVM connection state.</div>
          </div>
        </div>
      )}

      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>KVM Device</h3>
          <span className="desc">USB device that represents the KVM connection</span>
        </div>
        <div className="ff">
          <div className="ff-label">
            <div className="ff-label-title">Tracked device</div>
            <div className="ff-label-desc">Present = KVM connected to this PC</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DeviceSelect
                value={draftDeviceId}
                onChange={setDraftDeviceId}
                options={deviceOptions}
                loading={loadingDevices}
              />
            </div>
            <button
              onClick={loadDevices}
              className="btn-ghost"
              disabled={loadingDevices}
              style={{ flexShrink: 0 }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <ActionListSection
        title="When Connected"
        desc="Display inputs to apply when KVM is on this PC"
        actions={draftConnected}
        monitorOptions={monitorOptions}
        getInputsForMonitor={getInputsForMonitor}
        onChange={setDraftConnected}
      />

      <ActionListSection
        title="When Disconnected"
        desc="Display inputs to apply when KVM is on another PC"
        actions={draftDisconnected}
        monitorOptions={monitorOptions}
        getInputsForMonitor={getInputsForMonitor}
        onChange={setDraftDisconnected}
      />

      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>Plugin Lifecycle</h3>
        </div>
        <div className="ff">
          <div className="ff-label">
            <div className="ff-label-title">Reset configuration</div>
            <div className="ff-label-desc">Clear device selection and all input rules</div>
          </div>
          <button className="btn-ghost danger" onClick={handleReset}>Reset</button>
        </div>
      </div>
    </>
  )
}
