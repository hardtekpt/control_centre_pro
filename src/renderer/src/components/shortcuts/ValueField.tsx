import { useServiceStore } from '../../stores/serviceStore'
import type { Action } from '../../lib/shortcuts/catalog'
import { Dropdown } from './Dropdown'
import { NumberField } from './NumberField'

interface ValueFieldProps {
  action: Action | undefined
  value: string | number | undefined
  onChange: (value: string | number) => void
}

export function ValueField({ action, value, onChange }: ValueFieldProps): JSX.Element {
  const { ddcMonitors, settings } = useServiceStore()

  if (!action) {
    return <div className="no-value">Choose an action first</div>
  }
  if (!action.param) {
    return <div className="no-value">— not required —</div>
  }
  if (action.param.kind === 'enum') {
    return (
      <Dropdown
        value={String(value ?? '')}
        options={action.param.options}
        onChange={onChange}
        placeholder={`Select ${action.param.label.toLowerCase()}…`}
      />
    )
  }
  if (action.param.kind === 'compound') {
    const { parts, separator } = action.param
    const current = String(value ?? '').split(separator)
    const makeSetter = (idx: number) => (v: string | number) => {
      const next = [...current]
      next[idx] = String(v)
      onChange(next.join(separator))
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {parts.map((part, idx) => (
          <div key={part.id} style={{ display: 'contents' }}>
            {idx > 0 && (
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, flexShrink: 0 }}>→</span>
            )}
            <Dropdown
              value={current[idx] ?? part.options[0]?.id ?? ''}
              options={part.options}
              onChange={makeSetter(idx)}
              placeholder={`Select ${part.label.toLowerCase()}…`}
            />
          </div>
        ))}
      </div>
    )
  }
  if (action.param.kind === 'monitor-target-number') {
    const numParam = action.param
    // Parse stored "TARGET:NUM" value
    const str = String(value ?? `all:${numParam.default}`)
    const sep = str.lastIndexOf(':')
    const currentTarget = sep === -1 ? 'all' : str.slice(0, sep)
    const currentNum = sep === -1 ? numParam.default : Number(str.slice(sep + 1)) || numParam.default

    const setTarget = (t: string): void => onChange(`${t}:${currentNum}`)
    const setNum = (n: string | number): void => onChange(`${currentTarget}:${n}`)

    const targetOptions = [
      { id: 'all', label: 'All monitors' },
      ...ddcMonitors.map((m) => ({
        id: String(m.monitor_id),
        label: m.is_primary ? `${m.name} (primary)` : m.name,
      })),
      ...(settings.monitorGroups ?? []).map((g) => ({
        id: `g_${g.id}`,
        label: `Group: ${g.name}`,
      })),
    ]

    const numFieldParam = { kind: 'number' as const, label: numParam.label, min: numParam.min, max: numParam.max, step: numParam.step, default: numParam.default, unit: numParam.unit, signed: numParam.signed }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Dropdown
          value={currentTarget}
          options={targetOptions}
          onChange={setTarget}
          placeholder="Select target…"
        />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, flexShrink: 0 }}>→</span>
        <NumberField param={numFieldParam} value={currentNum} onChange={setNum} />
      </div>
    )
  }
  const numParam = action.param
  return (
    <NumberField
      param={numParam}
      value={typeof value === 'number' ? value : numParam.default}
      onChange={onChange}
    />
  )
}
