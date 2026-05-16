import { useRef, useState } from 'react'
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

export function DisplayCard({ monitor }: DisplayCardProps): JSX.Element {
  const { setDdcMonitors } = useServiceStore()
  const [draftBrightness, setDraftBrightness] = useState<number | null>(null)
  const lockedUntilRef = useRef(0)

  const displayBrightness = draftBrightness ?? monitor.brightness
  const supportsBrightness = monitor.supports.includes('brightness')
  const supportsInput = monitor.supports.includes('input_source')

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setDraftBrightness(Number(e.currentTarget.value))
  }

  const handleBrightnessRelease = (): void => {
    if (draftBrightness === null) return
    lockedUntilRef.current = Date.now() + 1200
    setDraftBrightness(null)
    window.api.ddcSetBrightness(monitor.monitor_id, draftBrightness).catch(console.error)
  }

  const handleDdcUpdate = (monitors: DdcMonitor[]): void => {
    const now = Date.now()
    if (now < lockedUntilRef.current) {
      return
    }
    setDdcMonitors(monitors)
  }

  const _unused = handleDdcUpdate

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {monitor.name}
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Monitor {monitor.monitor_id}
        </p>
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
