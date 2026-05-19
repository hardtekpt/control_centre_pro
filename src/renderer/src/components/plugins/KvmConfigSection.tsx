import { useEffect, useRef, useState } from 'react'
import type { MonitorInputAction, UsbDevice } from '@shared/types'
import { DDC_INPUT_NAMES } from '@shared/types'
import type { Plugin } from '@shared/types'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { useServiceStore } from '../../stores/serviceStore'
import { useKvmStore } from '../../stores/kvmStore'

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
          style={{ border: 'none' }}
        >
          + Add rule
        </button>
      </div>
    </div>
  )
}

// ── Identify pulse animation ──────────────────────────────────────────────────

function PulseIcon(): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--color-accent)',
        flexShrink: 0,
        animation: 'kvm-pulse 1.2s ease-in-out infinite',
      }}
    />
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

interface Props {
  plugin: Plugin
}

type IdentifyPhase = 'idle' | 'waiting'

export function KvmConfigSection({ plugin }: Props): JSX.Element {
  const { setDirty, registerSave } = useSettingsForm()
  const { ddcMonitors } = useServiceStore()
  const { kvmState } = useKvmStore()

  const [identifyPhase, setIdentifyPhase] = useState<IdentifyPhase>('idle')
  const [countdown, setCountdown] = useState(30)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const [savedDeviceId, setSavedDeviceId] = useState('')
  const [savedDeviceName, setSavedDeviceName] = useState('')
  const [draftDeviceId, setDraftDeviceId] = useState('')
  const [draftDeviceName, setDraftDeviceName] = useState('')

  const [savedConnected, setSavedConnected] = useState<MonitorInputAction[]>([])
  const [draftConnected, setDraftConnected] = useState<MonitorInputAction[]>([])

  const [savedDisconnected, setSavedDisconnected] = useState<MonitorInputAction[]>([])
  const [draftDisconnected, setDraftDisconnected] = useState<MonitorInputAction[]>([])

  const draftDeviceIdRef = useRef(draftDeviceId)
  const draftDeviceNameRef = useRef(draftDeviceName)
  const draftConnectedRef = useRef(draftConnected)
  const draftDisconnectedRef = useRef(draftDisconnected)

  useEffect(() => { draftDeviceIdRef.current = draftDeviceId }, [draftDeviceId])
  useEffect(() => { draftDeviceNameRef.current = draftDeviceName }, [draftDeviceName])
  useEffect(() => { draftConnectedRef.current = draftConnected }, [draftConnected])
  useEffect(() => { draftDisconnectedRef.current = draftDisconnected }, [draftDisconnected])

  // Load saved settings on mount
  useEffect(() => {
    window.api.getSettings()
      .then((s) => {
        const devId = s.kvmDeviceInstanceId ?? ''
        const devName = s.kvmDeviceName ?? ''
        const connected = s.kvmConnectedActions ?? []
        const disconnected = s.kvmDisconnectedActions ?? []
        setSavedDeviceId(devId)
        setDraftDeviceId(devId)
        setSavedDeviceName(devName)
        setDraftDeviceName(devName)
        setSavedConnected(connected)
        setDraftConnected(connected)
        setSavedDisconnected(disconnected)
        setDraftDisconnected(disconnected)
      })
      .catch(console.error)
  }, [])

  // Subscribe to identify result from main process
  useEffect(() => {
    const cleanup = window.api.onKvmIdentifyResult((device: UsbDevice | null) => {
      stopCountdown()
      setIdentifyPhase('idle')
      if (device) {
        setDraftDeviceId(device.instanceId)
        setDraftDeviceName(device.friendlyName)
      }
    })
    return () => { cleanup(); stopCountdown() }
  }, [])

  // Dirty tracking
  useEffect(() => {
    const isDirty =
      draftDeviceId !== savedDeviceId ||
      draftDeviceName !== savedDeviceName ||
      JSON.stringify(draftConnected) !== JSON.stringify(savedConnected) ||
      JSON.stringify(draftDisconnected) !== JSON.stringify(savedDisconnected)
    setDirty(isDirty)
  }, [draftDeviceId, savedDeviceId, draftDeviceName, savedDeviceName, draftConnected, savedConnected, draftDisconnected, savedDisconnected, setDirty])

  // Save handler
  useEffect(() => {
    registerSave(async () => {
      const current = await window.api.getSettings()
      await window.api.setSettings({
        ...current,
        kvmEnabled: plugin.enabled,
        kvmDeviceInstanceId: draftDeviceIdRef.current,
        kvmDeviceName: draftDeviceNameRef.current,
        kvmConnectedActions: draftConnectedRef.current,
        kvmDisconnectedActions: draftDisconnectedRef.current,
      })
      setSavedDeviceId(draftDeviceIdRef.current)
      setSavedDeviceName(draftDeviceNameRef.current)
      setSavedConnected(draftConnectedRef.current)
      setSavedDisconnected(draftDisconnectedRef.current)
    })
    return () => registerSave(null)
  }, [registerSave, plugin.enabled])

  const stopCountdown = (): void => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }

  const startIdentify = (): void => {
    setIdentifyPhase('waiting')
    setCountdown(30)
    stopCountdown()
    countdownRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { stopCountdown(); return 0 }
        return n - 1
      })
    }, 1000)
    window.api.kvmIdentifyStart().catch(console.error)
  }

  const cancelIdentify = (): void => {
    stopCountdown()
    setIdentifyPhase('idle')
    window.api.kvmIdentifyCancel().catch(console.error)
  }

  const monitorOptions = ddcMonitors.map((m) => ({ id: m.monitor_id, name: m.name }))
  const getInputsForMonitor = (id: number): string[] =>
    ddcMonitors.find((m) => m.monitor_id === id)?.available_inputs ?? []

  const hasDevice = Boolean(draftDeviceId)
  const liveStateVisible =
    hasDevice &&
    savedDeviceId === draftDeviceId &&
    kvmState?.deviceInstanceId === savedDeviceId
  const liveConnected = kvmState?.connected ?? false

  return (
    <>
      {!hasDevice && identifyPhase === 'idle' && (
        <div className="banner info">
          <div className="banner-content">
            <div className="banner-title">No device configured</div>
            <div className="banner-sub">Use the identify button below to detect your KVM switch automatically.</div>
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
            <div className="ff-label-desc">
              {identifyPhase === 'waiting'
                ? 'Disconnect your KVM switch now…'
                : hasDevice
                  ? 'Present = KVM connected to this PC'
                  : 'No device selected yet'}
            </div>
          </div>

          {identifyPhase === 'waiting' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PulseIcon />
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                  Waiting… {countdown}s
                </span>
              </div>
              <button className="btn-ghost" onClick={cancelIdentify}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hasDevice && (
                <div
                  title={draftDeviceId}
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-code-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '5px 9px',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {draftDeviceName || draftDeviceId}
                </div>
              )}
              {liveStateVisible && (
                <div className="status" style={{ fontSize: '11px' }}>
                  <div className={`status-dot ${liveConnected ? 'connected' : 'disabled'}`} />
                  {liveConnected ? 'Connected' : 'Disconnected'}
                </div>
              )}
              <button className="btn-ghost" onClick={startIdentify}>
                {hasDevice ? 'Re-identify' : 'Identify KVM…'}
              </button>
            </div>
          )}
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

    </>
  )
}
