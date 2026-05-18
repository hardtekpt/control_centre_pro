import type { ParamSchema } from '../../lib/shortcuts/catalog'
import { IconPlus, IconMinus } from './icons'

interface NumberFieldProps {
  param: Extract<ParamSchema, { kind: 'number' }>
  value: number
  onChange: (value: number) => void
}

export function NumberField({ param, value, onChange }: NumberFieldProps): JSX.Element {
  const atMin = value <= param.min
  const atMax = value >= param.max
  const display = `${param.signed ?? ''}${value}${param.unit ?? ''}`

  return (
    <div className="number-field">
      <button
        type="button"
        className="nf-step"
        disabled={atMin}
        onPointerDown={() => !atMin && onChange(Math.max(param.min, value - param.step))}
        aria-label="Decrease"
      >
        <IconMinus size={14} />
      </button>
      <span className="nf-value">{display}</span>
      <button
        type="button"
        className="nf-step"
        disabled={atMax}
        onPointerDown={() => !atMax && onChange(Math.min(param.max, value + param.step))}
        aria-label="Increase"
      >
        <IconPlus size={14} />
      </button>
    </div>
  )
}
