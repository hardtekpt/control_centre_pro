import { useRef, useState, useEffect, memo } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import { notifyDisplayInputChange, notifyDisplayBrightness } from '../../lib/notifyFromEvent'
import type { DdcMonitor } from '@shared/types'

interface DisplayCardProps {
  monitor: DdcMonitor
  syncBrightness?: boolean
  allMonitors?: DdcMonitor[]
}

const INPUT_NAME_MAP: Record<string, string> = {
  '0x01': 'VGA 1',
  '0x02': 'VGA 2',
  '0x03': 'DVI 1',
  '0x04': 'DVI 2',
  '0x0f': 'DisplayPort 1',
  '0x10': 'DisplayPort 2',
  '0x11': 'HDMI 1',
  '0x12': 'HDMI 2',
  '0x1b': 'USB-C',
}

function getInputName(inputHex: string): string {
  const key = inputHex.toLowerCase()
  return INPUT_NAME_MAP[key] || inputHex
}

function MonitorIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function SetPrimaryIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function BrightnessIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function DisplayCardComponent({ monitor, syncBrightness, allMonitors }: DisplayCardProps): JSX.Element {
  const { setDdcMonitors } = useServiceStore()
  const [draftBrightness, setDraftBrightness] = useState<number | null>(null)
  const [confirmedBrightness, setConfirmedBrightness] = useState(monitor.brightness)
  const lockedUntilRef = useRef(0)

  const displayBrightness = draftBrightness ?? confirmedBrightness
  const supportsBrightness = monitor.supports.includes('brightness')
  const supportsInput = monitor.supports.includes('input_source')

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setDraftBrightness(Number(e.currentTarget.value))
  }

  const handleBrightnessRelease = (): void => {
    if (draftBrightness === null) return
    lockedUntilRef.current = Date.now() + 1200
    setConfirmedBrightness(draftBrightness)
    setDraftBrightness(null)

    window.api.ddcSetBrightness(monitor.monitor_id, draftBrightness).catch(console.error)

    if (syncBrightness && allMonitors) {
      const otherMonitors = allMonitors.filter((m) => m.monitor_id !== monitor.monitor_id && m.supports.includes('brightness'))
      otherMonitors.forEach((m) => {
        window.api.ddcSetBrightness(m.monitor_id, draftBrightness).catch(console.error)
      })
    }
  }

  useEffect(() => {
    const now = Date.now()
    if (now >= lockedUntilRef.current) {
      setConfirmedBrightness(monitor.brightness)
    }
  }, [monitor.brightness])

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--color-accent)' }}><MonitorIcon /></span>
        <h3 className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
          {monitor.name}
        </h3>
        {supportsInput && monitor.available_inputs.length > 0 && (
          <select
            id={`input-${monitor.monitor_id}`}
            value={monitor.input_source}
            onChange={(e) => {
              if (e.currentTarget.value) {
                const inputHex = e.currentTarget.value
                const inputName = getInputName(inputHex)
                window.api.ddcSetInputSource(monitor.monitor_id, inputHex).catch(console.error)
                notifyDisplayInputChange(monitor.name, inputName)
              }
            }}
            className="text-xs py-0.5 px-1.5 rounded"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              maxWidth: 100,
            }}
          >
            {monitor.available_inputs.map((input) => (
              <option key={input} value={input}>
                {getInputName(input)}
              </option>
            ))}
          </select>
        )}
        {monitor.is_primary ? (
          <span
            className="text-xs px-1.5 py-0.5 rounded mono shrink-0"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Primary
          </span>
        ) : (
          <button
            onClick={(): void => {
              window.api.ddcSetPrimaryMonitor(monitor.monitor_id).catch(console.error)
            }}
            className="p-1 rounded-md shrink-0"
            title="Set as primary display"
            style={{
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e): void => {
              e.currentTarget.style.color = 'var(--color-text-primary)'
              e.currentTarget.style.background = 'var(--color-surface-raised)'
            }}
            onMouseLeave={(e): void => {
              e.currentTarget.style.color = 'var(--color-text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <SetPrimaryIcon />
          </button>
        )}
      </div>

      {/* Brightness Control */}
      {supportsBrightness ? (
        <div className="flex items-center gap-2 py-1">
          <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}><BrightnessIcon /></span>
          <SliderInput
            value={displayBrightness / 100}
            onChange={(v) => {
              const newValue = Math.round(v * 100)
              handleBrightnessChange({ currentTarget: { value: String(newValue) } } as React.ChangeEvent<HTMLInputElement>)
              lockedUntilRef.current = Date.now() + 1200
              setConfirmedBrightness(newValue)
              setDraftBrightness(null)
              window.api.ddcSetBrightness(monitor.monitor_id, newValue).catch(console.error)
              if (syncBrightness && allMonitors) {
                const otherMonitors = allMonitors.filter((m) => m.monitor_id !== monitor.monitor_id && m.supports.includes('brightness'))
                otherMonitors.forEach((m) => {
                  window.api.ddcSetBrightness(m.monitor_id, newValue).catch(console.error)
                })
              }
            }}
            onDragEnd={(v) => notifyDisplayBrightness(monitor.monitor_id, monitor.name, Math.round(v * 100))}
          />
          <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)', width: 28 }}>
            {displayBrightness}%
          </span>
        </div>
      ) : null}
    </div>
  )
}

export const DisplayCard = memo(DisplayCardComponent)
