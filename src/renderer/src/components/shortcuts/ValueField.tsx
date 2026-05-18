import type { Action } from '../../lib/shortcuts/catalog'
import { Dropdown } from './Dropdown'
import { NumberField } from './NumberField'

interface ValueFieldProps {
  action: Action | undefined
  value: string | number | undefined
  onChange: (value: string | number) => void
}

export function ValueField({ action, value, onChange }: ValueFieldProps): JSX.Element {
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
  const numParam = action.param
  return (
    <NumberField
      param={numParam}
      value={typeof value === 'number' ? value : numParam.default}
      onChange={onChange}
    />
  )
}
