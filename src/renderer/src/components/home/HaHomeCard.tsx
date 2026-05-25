import { useRef, useState, useCallback } from 'react'
import { useHaStore } from '../../stores/haStore'
import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import type { HaHomeCardEntity, HaEntity } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function callService(domain: string, service: string, serviceData?: Record<string, unknown>): void {
  window.api.haCallService({ domain, service, serviceData }).catch(console.error)
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function HaIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

// ─── Light row ────────────────────────────────────────────────────────────────

function LightRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const attrs = entity.attributes as Record<string, unknown>
  const isOn = entity.state === 'on'

  // Optimistic brightness
  const brightLock = useRef(0)
  const [localBright, setLocalBright] = useState<number | null>(null)
  const rawBrightness = typeof attrs.brightness === 'number' ? attrs.brightness as number : 0
  const brightness = Date.now() - brightLock.current < 1200
    ? (localBright ?? rawBrightness / 255)
    : rawBrightness / 255

  // Optimistic color temp
  const ctLock = useRef(0)
  const [localCt, setLocalCt] = useState<number | null>(null)
  const minCt = typeof attrs.min_color_temp_kelvin === 'number' ? attrs.min_color_temp_kelvin as number : 2000
  const maxCt = typeof attrs.max_color_temp_kelvin === 'number' ? attrs.max_color_temp_kelvin as number : 6500
  const rawCtK = typeof attrs.color_temp_kelvin === 'number' ? attrs.color_temp_kelvin as number : minCt
  const ctNorm = Date.now() - ctLock.current < 1200
    ? (localCt ?? (rawCtK - minCt) / (maxCt - minCt))
    : (rawCtK - minCt) / (maxCt - minCt)

  const colorMode = String(attrs.color_mode ?? '')
  const showColorTemp = colorMode === 'color_temp' || typeof attrs.color_temp_kelvin === 'number'
  const showColor = ['hs', 'rgb', 'xy'].includes(colorMode)
  const effectList = Array.isArray(attrs.effect_list) ? attrs.effect_list as string[] : []
  const currentEffect = typeof attrs.effect === 'string' ? attrs.effect as string : null

  const rgbArr = Array.isArray(attrs.rgb_color) ? attrs.rgb_color as number[] : null
  const colorHex = rgbArr ? rgbToHex(rgbArr[0], rgbArr[1], rgbArr[2]) : '#ffffff'

  const handleToggle = useCallback((): void => {
    callService('light', isOn ? 'turn_off' : 'turn_on', { entity_id: cfg.entityId })
  }, [cfg.entityId, isOn])

  const handleBrightness = useCallback((v: number): void => {
    setLocalBright(v)
    brightLock.current = Date.now()
    callService('light', 'turn_on', { entity_id: cfg.entityId, brightness: Math.round(v * 255) })
  }, [cfg.entityId])

  const handleColorTemp = useCallback((v: number): void => {
    const kelvin = Math.round(minCt + v * (maxCt - minCt))
    setLocalCt(v)
    ctLock.current = Date.now()
    callService('light', 'turn_on', { entity_id: cfg.entityId, color_temp_kelvin: kelvin })
  }, [cfg.entityId, minCt, maxCt])

  const handleColor = useCallback((hex: string): void => {
    const [r, g, b] = hexToRgb(hex)
    callService('light', 'turn_on', { entity_id: cfg.entityId, rgb_color: [r, g, b] })
  }, [cfg.entityId])

  const handleEffect = useCallback((val: string): void => {
    if (val === 'None') {
      callService('light', 'turn_on', { entity_id: cfg.entityId, effect: 'None' })
    } else {
      callService('light', 'turn_on', { entity_id: cfg.entityId, effect: val })
    }
  }, [cfg.entityId])

  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      {/* Name + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
        {showColor && (
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: colorHex, border: '1px solid var(--color-border)', cursor: 'pointer' }} />
            <input
              type="color"
              value={colorHex}
              onChange={e => handleColor(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            />
          </label>
        )}
        {effectList.length > 0 && (
          <select
            value={currentEffect ?? 'None'}
            onChange={e => handleEffect(e.target.value)}
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, padding: '2px 6px' }}
          >
            <option value="None">No effect</option>
            {effectList.map(ef => <option key={ef} value={ef}>{ef}</option>)}
          </select>
        )}
        <button
          onClick={handleToggle}
          style={{
            width: 32,
            height: 18,
            borderRadius: 9,
            border: 'none',
            cursor: 'pointer',
            background: isOn ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 150ms ease',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 2,
            left: isOn ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--color-text-primary)',
            transition: 'left 150ms ease',
          }} />
        </button>
      </div>

      {/* Brightness slider */}
      {isOn && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="card-row-label" style={{ width: 56 }}>Brightness</span>
          <SliderInput value={brightness} onChange={handleBrightness} />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 30, textAlign: 'right' }}>
            {Math.round(brightness * 100)}%
          </span>
        </div>
      )}

      {/* Color temp slider */}
      {isOn && showColorTemp && maxCt > minCt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="card-row-label" style={{ width: 56 }}>Color temp</span>
          <SliderInput value={Math.max(0, Math.min(1, ctNorm))} onChange={handleColorTemp} />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 30, textAlign: 'right' }}>
            {Math.round(minCt + ctNorm * (maxCt - minCt))}K
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Climate row ──────────────────────────────────────────────────────────────

function ClimateRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const currentTemp = typeof attrs.current_temperature === 'number' ? (attrs.current_temperature as number).toFixed(1) : '—'
  const minTemp = typeof attrs.min_temp === 'number' ? attrs.min_temp as number : 10
  const maxTemp = typeof attrs.max_temp === 'number' ? attrs.max_temp as number : 35
  const setpointRaw = typeof attrs.temperature === 'number' ? attrs.temperature as number : minTemp
  const hvacModes = Array.isArray(attrs.hvac_modes) ? attrs.hvac_modes as string[] : []
  const hvacMode = String(entity.state)

  const tempLock = useRef(0)
  const [localSetpoint, setLocalSetpoint] = useState<number | null>(null)
  const setpointNorm = (setpointRaw - minTemp) / (maxTemp - minTemp)
  const displayNorm = Date.now() - tempLock.current < 1200
    ? (localSetpoint ?? setpointNorm)
    : setpointNorm

  const displaySetpoint = minTemp + displayNorm * (maxTemp - minTemp)

  const handleTemp = useCallback((v: number): void => {
    const temp = Math.round((minTemp + v * (maxTemp - minTemp)) * 2) / 2
    setLocalSetpoint(v)
    tempLock.current = Date.now()
    callService('climate', 'set_temperature', { entity_id: cfg.entityId, temperature: temp })
  }, [cfg.entityId, minTemp, maxTemp])

  const handleMode = useCallback((mode: string): void => {
    callService('climate', 'set_hvac_mode', { entity_id: cfg.entityId, hvac_mode: mode })
  }, [cfg.entityId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {currentTemp}°
        </span>
        {hvacModes.length > 0 && (
          <select
            value={hvacMode}
            onChange={e => handleMode(e.target.value)}
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, padding: '2px 6px' }}
          >
            {hvacModes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="card-row-label" style={{ width: 56 }}>Setpoint</span>
        <SliderInput value={Math.max(0, Math.min(1, displayNorm))} onChange={handleTemp} />
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 36, textAlign: 'right' }}>
          {displaySetpoint.toFixed(1)}°
        </span>
      </div>
    </div>
  )
}

// ─── Sensor row ───────────────────────────────────────────────────────────────

function SensorRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const unit = typeof attrs.unit_of_measurement === 'string' ? attrs.unit_of_measurement as string : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {entity.state}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

// ─── Scene row ────────────────────────────────────────────────────────────────

function SceneRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const handleActivate = useCallback((): void => {
    callService('scene', 'turn_on', { entity_id: cfg.entityId })
  }, [cfg.entityId])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
      <button
        className="btn-ghost"
        onClick={handleActivate}
        style={{ fontSize: 11, padding: '2px 10px' }}
      >
        Activate
      </button>
    </div>
  )
}

// ─── Service call row ─────────────────────────────────────────────────────────

function ServiceCallRow({ cfg }: { cfg: HaHomeCardEntity }): JSX.Element {
  const name = cfg.displayName ?? `${cfg.serviceDomain}.${cfg.serviceName}`
  const handleCall = useCallback((): void => {
    if (!cfg.serviceDomain || !cfg.serviceName) return
    callService(cfg.serviceDomain, cfg.serviceName)
  }, [cfg.serviceDomain, cfg.serviceName])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</span>
      <button
        className="btn-ghost"
        onClick={handleCall}
        style={{ fontSize: 11, padding: '2px 10px' }}
      >
        Call
      </button>
    </div>
  )
}

// ─── Entity row dispatcher ────────────────────────────────────────────────────

function EntityRow({ cfg, entities }: { cfg: HaHomeCardEntity; entities: HaEntity[] }): JSX.Element | null {
  if (cfg.type === 'service_call') return <ServiceCallRow cfg={cfg} />
  const entity = entities.find(e => e.entity_id === cfg.entityId)
  if (!entity) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', opacity: 0.5 }}>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)' }}>{cfg.displayName ?? cfg.entityId}</span>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>unavailable</span>
    </div>
  )
  if (cfg.type === 'light') return <LightRow cfg={cfg} entity={entity} />
  if (cfg.type === 'climate') return <ClimateRow cfg={cfg} entity={entity} />
  if (cfg.type === 'scene') return <SceneRow cfg={cfg} entity={entity} />
  return <SensorRow cfg={cfg} entity={entity} />
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function HaHomeCard(): JSX.Element {
  const haState = useHaStore(s => s.haState)
  const entities = useServiceStore(s => s.settings.haHomeCardEntities)

  const isConnected = haState?.status === 'connected'
  const liveEntities = haState?.entities ?? []

  return (
    <div className="card card-surface">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: 'var(--color-accent)' }}><HaIcon /></span>
        <span className="card-title">Home Assistant</span>
        <div
          title={isConnected ? 'Connected' : 'Disconnected'}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isConnected ? 'var(--color-status-ok)' : 'var(--color-text-secondary)',
            opacity: isConnected ? 1 : 0.4,
            flexShrink: 0,
          }}
        />
      </div>

      {/* Entity rows */}
      <div>
        {entities.map((cfg, i) => (
          <EntityRow key={cfg.entityId + i} cfg={cfg} entities={liveEntities} />
        ))}
        {entities.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            No entities configured. Add some in Settings → Plugins → Home Assistant.
          </span>
        )}
      </div>
    </div>
  )
}
