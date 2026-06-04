import { useCallback } from 'react'
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

// ─── Icons ────────────────────────────────────────────────────────────────────

function BrightnessIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  )
}

function ColorTempIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  )
}

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
  const patchEntity = useHaStore(s => s.patchEntity)
  const attrs = entity.attributes as Record<string, unknown>
  const isOn = entity.state === 'on'

  // All display values read straight from the (optimistically patched) store entity.
  const rawBrightness = typeof attrs.brightness === 'number' ? attrs.brightness as number : 0
  const brightness = rawBrightness / 255

  const minCt = typeof attrs.min_color_temp_kelvin === 'number' ? attrs.min_color_temp_kelvin as number : 2000
  const maxCt = typeof attrs.max_color_temp_kelvin === 'number' ? attrs.max_color_temp_kelvin as number : 6500
  const rawCtK = typeof attrs.color_temp_kelvin === 'number' ? attrs.color_temp_kelvin as number : minCt
  const ctNorm = (rawCtK - minCt) / (maxCt - minCt)

  const colorMode = String(attrs.color_mode ?? '')
  const showColorTemp = colorMode === 'color_temp' || typeof attrs.color_temp_kelvin === 'number'
  const showColor = ['hs', 'rgb', 'xy'].includes(colorMode)
  const effectList = Array.isArray(attrs.effect_list) ? attrs.effect_list as string[] : []
  const currentEffect = typeof attrs.effect === 'string' ? attrs.effect as string : null

  const rgbArr = Array.isArray(attrs.rgb_color) ? attrs.rgb_color as number[] : null
  const colorHex = rgbArr ? rgbToHex(rgbArr[0], rgbArr[1], rgbArr[2]) : '#ffffff'

  const handleToggle = useCallback((): void => {
    patchEntity(cfg.entityId, { state: isOn ? 'off' : 'on' })
    callService('light', isOn ? 'turn_off' : 'turn_on', { entity_id: cfg.entityId })
  }, [cfg.entityId, isOn, patchEntity])

  const handleBrightness = useCallback((v: number): void => {
    const bright = Math.round(v * 255)
    patchEntity(cfg.entityId, { state: 'on', attributes: { brightness: bright } })
    callService('light', 'turn_on', { entity_id: cfg.entityId, brightness: bright })
  }, [cfg.entityId, patchEntity])

  const handleColorTemp = useCallback((v: number): void => {
    const kelvin = Math.round(minCt + v * (maxCt - minCt))
    patchEntity(cfg.entityId, { attributes: { color_temp_kelvin: kelvin } })
    callService('light', 'turn_on', { entity_id: cfg.entityId, color_temp_kelvin: kelvin })
  }, [cfg.entityId, minCt, maxCt, patchEntity])

  const handleColor = useCallback((hex: string): void => {
    const [r, g, b] = hexToRgb(hex)
    patchEntity(cfg.entityId, { attributes: { rgb_color: [r, g, b] } })
    callService('light', 'turn_on', { entity_id: cfg.entityId, rgb_color: [r, g, b] })
  }, [cfg.entityId, patchEntity])

  const handleEffect = useCallback((val: string): void => {
    patchEntity(cfg.entityId, { attributes: { effect: val } })
    callService('light', 'turn_on', { entity_id: cfg.entityId, effect: val })
  }, [cfg.entityId, patchEntity])

  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      {/* Name + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="flex-1 text-xs">{name}</span>
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
        {isOn && effectList.length > 0 && (
          <select
            value={currentEffect ?? 'None'}
            onChange={e => handleEffect(e.target.value)}
            className="text-xs py-0.5 px-1.5 rounded"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <option value="None">No effect</option>
            {effectList.map(ef => <option key={ef} value={ef}>{ef}</option>)}
          </select>
        )}
        <button
          onClick={handleToggle}
          className="toggle-track"
          style={{ background: isOn ? 'var(--color-text-primary)' : 'var(--color-border)' }}
        >
          <span
            className="toggle-thumb"
            style={{
              transform: isOn ? 'translateX(14px)' : 'translateX(0)',
              background: isOn ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            }}
          />
        </button>
      </div>

      {/* Brightness + Color temp sliders side by side */}
      {isOn && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, display: 'flex' }}><BrightnessIcon /></span>
            <SliderInput value={Math.max(0, Math.min(1, brightness))} onChange={handleBrightness} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 28, textAlign: 'right', flexShrink: 0 }}>
              {Math.round(brightness * 100)}%
            </span>
          </div>
          {showColorTemp && maxCt > minCt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, display: 'flex' }}><ColorTempIcon /></span>
              <SliderInput value={Math.max(0, Math.min(1, ctNorm))} onChange={handleColorTemp} />
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 28, textAlign: 'right', flexShrink: 0 }}>
                {Math.round(minCt + ctNorm * (maxCt - minCt))}K
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Climate row ──────────────────────────────────────────────────────────────

function ClimateRow({ cfg, entity }: { cfg: HaHomeCardEntity; entity: HaEntity }): JSX.Element {
  const patchEntity = useHaStore(s => s.patchEntity)
  const attrs = entity.attributes as Record<string, unknown>
  const name = cfg.displayName ?? String(attrs.friendly_name ?? cfg.entityId)
  const currentTemp = typeof attrs.current_temperature === 'number' ? (attrs.current_temperature as number).toFixed(1) : '—'
  const minTemp = typeof attrs.min_temp === 'number' ? attrs.min_temp as number : 10
  const maxTemp = typeof attrs.max_temp === 'number' ? attrs.max_temp as number : 35
  const setpointRaw = typeof attrs.temperature === 'number' ? attrs.temperature as number : minTemp
  const hvacModes = Array.isArray(attrs.hvac_modes) ? attrs.hvac_modes as string[] : []
  const hvacMode = String(entity.state)

  const setpointNorm = (setpointRaw - minTemp) / (maxTemp - minTemp)

  const handleTemp = useCallback((v: number): void => {
    const temp = Math.round((minTemp + v * (maxTemp - minTemp)) * 2) / 2
    patchEntity(cfg.entityId, { attributes: { temperature: temp } })
    callService('climate', 'set_temperature', { entity_id: cfg.entityId, temperature: temp })
  }, [cfg.entityId, minTemp, maxTemp, patchEntity])

  const handleMode = useCallback((mode: string): void => {
    patchEntity(cfg.entityId, { state: mode })
    callService('climate', 'set_hvac_mode', { entity_id: cfg.entityId, hvac_mode: mode })
  }, [cfg.entityId, patchEntity])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="flex-1 text-xs">{name}</span>
        <span className="card-row-label">{currentTemp}°</span>
        {hvacModes.length > 0 && (
          <select
            value={hvacMode}
            onChange={e => handleMode(e.target.value)}
            className="text-xs py-0.5 px-1.5 rounded"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            {hvacModes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="card-row-label" style={{ width: 56 }}>Setpoint</span>
        <SliderInput value={Math.max(0, Math.min(1, setpointNorm))} onChange={handleTemp} />
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 36, textAlign: 'right' }}>
          {(minTemp + setpointNorm * (maxTemp - minTemp)).toFixed(1)}°
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
      <span className="card-row-label text-xs">
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
      <span className="flex-1 text-xs card-row-label">{cfg.displayName ?? cfg.entityId}</span>
      <span className="card-row-label">unavailable</span>
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
