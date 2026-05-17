import { useRef, useState, useEffect } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import type { DdcMonitor } from '@shared/types'

interface DisplayCardProps {
  monitor: DdcMonitor
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

export function DisplayCard({ monitor }: DisplayCardProps): JSX.Element {
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
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)' }}><MonitorIcon /></span>
        <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {monitor.name}
        </h3>
      </div>

      {/* Brightness Control */}
      {supportsBrightness ? (
        <div className="mb-3">
          <label htmlFor={`brightness-${monitor.monitor_id}`} className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Brightness
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`brightness-${monitor.monitor_id}`}
              type="range"
              min="0"
              max="100"
              value={displayBrightness}
              onChange={handleBrightnessChange}
              onPointerUp={handleBrightnessRelease}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleBrightnessRelease()
              }}
              className="flex-1"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span className="mono text-xs w-12 text-right" style={{ color: 'var(--color-text-secondary)' }}>
              {displayBrightness}%
            </span>
          </div>
        </div>
      ) : null}

      {/* Input Control */}
      {supportsInput && monitor.available_inputs.length > 0 ? (
        <select
          id={`input-${monitor.monitor_id}`}
          value={monitor.input_source}
          onChange={(e) => {
            if (e.currentTarget.value) {
              window.api.ddcSetInputSource(monitor.monitor_id, e.currentTarget.value).catch(console.error)
            }
          }}
          className="w-full text-xs p-1.5 rounded"
          style={{
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {monitor.available_inputs.map((input) => (
            <option key={input} value={input}>
              {getInputName(input)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}
