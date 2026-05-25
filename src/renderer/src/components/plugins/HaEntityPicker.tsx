import { useState } from 'react'
import type { HaEntity, HaHomeCardEntity, HaHomeCardEntityType } from '@shared/types'

interface Props {
  entities: HaEntity[]
  configured: HaHomeCardEntity[]
  onAdd: (entity: HaHomeCardEntity) => void
  onClose: () => void
}

function inferType(entityId: string): HaHomeCardEntityType {
  const domain = entityId.split('.')[0]
  if (domain === 'light') return 'light'
  if (domain === 'climate') return 'climate'
  if (domain === 'scene') return 'scene'
  return 'sensor'
}

const DOMAIN_ORDER = ['light', 'climate', 'scene', 'sensor', 'binary_sensor']

function groupByDomain(entities: HaEntity[]): Map<string, HaEntity[]> {
  const map = new Map<string, HaEntity[]>()
  for (const e of entities) {
    const domain = e.entity_id.split('.')[0]
    const key = DOMAIN_ORDER.includes(domain) ? domain : 'other'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  const ordered = new Map<string, HaEntity[]>()
  for (const d of [...DOMAIN_ORDER, 'other']) {
    if (map.has(d)) ordered.set(d, map.get(d)!)
  }
  return ordered
}

export function HaEntityPicker({ entities, configured, onAdd, onClose }: Props): JSX.Element {
  const [search, setSearch] = useState('')
  const [svcDomain, setSvcDomain] = useState('')
  const [svcName, setSvcName] = useState('')
  const [svcLabel, setSvcLabel] = useState('')

  const configuredIds = new Set(configured.map(c => c.entityId))

  const filtered = search.trim()
    ? entities.filter(e => {
        const q = search.toLowerCase()
        return e.entity_id.toLowerCase().includes(q) ||
          String(e.attributes?.friendly_name ?? '').toLowerCase().includes(q)
      })
    : entities

  const grouped = groupByDomain(filtered)

  const addServiceCall = (): void => {
    if (!svcDomain.trim() || !svcName.trim()) return
    onAdd({
      entityId: `${svcDomain.trim()}.${svcName.trim()}`,
      displayName: svcLabel.trim() || `${svcDomain}.${svcName}`,
      type: 'service_call',
      serviceDomain: svcDomain.trim(),
      serviceName: svcName.trim(),
    })
    setSvcDomain('')
    setSvcName('')
    setSvcLabel('')
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        background: 'var(--color-surface)',
        marginTop: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 360,
      }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search entities…"
          className="input"
          style={{ flex: 1, fontSize: 12, padding: '3px 8px' }}
          autoFocus
        />
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Entity list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {[...grouped.entries()].map(([domain, domainEntities]) => (
          <div key={domain}>
            <div style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-raised)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              {domain}
            </div>
            {domainEntities.map(e => {
              const alreadyAdded = configuredIds.has(e.entity_id)
              const friendlyName = String(e.attributes?.friendly_name ?? e.entity_id)
              return (
                <div
                  key={e.entity_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {friendlyName}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                      {e.entity_id}
                    </div>
                  </div>
                  <button
                    className="btn-ghost"
                    disabled={alreadyAdded}
                    onClick={() => onAdd({
                      entityId: e.entity_id,
                      displayName: friendlyName,
                      type: inferType(e.entity_id),
                    })}
                    style={{ fontSize: 11, padding: '2px 8px', opacity: alreadyAdded ? 0.4 : 1 }}
                  >
                    {alreadyAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        ))}

        {/* Service call section */}
        <div>
          <div style={{
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-raised)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            Service Call
          </div>
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={svcDomain}
                onChange={e => setSvcDomain(e.target.value)}
                placeholder="Domain (e.g. input_boolean)"
                className="input mono"
                style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
              />
              <input
                type="text"
                value={svcName}
                onChange={e => setSvcName(e.target.value)}
                placeholder="Service (e.g. turn_on)"
                className="input mono"
                style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={svcLabel}
                onChange={e => setSvcLabel(e.target.value)}
                placeholder="Label (optional)"
                className="input"
                style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
              />
              <button
                className="btn-ghost"
                onClick={addServiceCall}
                disabled={!svcDomain.trim() || !svcName.trim()}
                style={{ fontSize: 11, padding: '2px 10px' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
