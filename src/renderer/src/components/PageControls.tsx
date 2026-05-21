import './page-controls.css'

// ── Search icon ────────────────────────────────────────────────────────────────

function IconSearch({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

// ── PageSearchBar ──────────────────────────────────────────────────────────────

export function PageSearchBar({
  value,
  onChange,
  inputRef,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (v: string) => void
  inputRef?: React.RefObject<HTMLInputElement>
  placeholder?: string
}): JSX.Element {
  return (
    <div className="search-input-wrap">
      <span className="search-icon"><IconSearch size={14} /></span>
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ── PageFilterChips ────────────────────────────────────────────────────────────

export interface FilterChipDef {
  id: string
  label: string
  count?: number
  icon?: React.ReactNode
}

export function PageFilterChips({
  chips,
  active,
  onSelect,
}: {
  chips: FilterChipDef[]
  active: string
  onSelect: (id: string) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`filter-chip${active === chip.id ? ' active' : ''}`}
          onClick={() => onSelect(chip.id)}
        >
          {chip.icon}
          {chip.label}
          {chip.count !== undefined && (
            <span className="chip-count">{chip.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── PageDivider ────────────────────────────────────────────────────────────────

export function PageDivider(): JSX.Element {
  return (
    <div style={{ height: 1, background: 'var(--color-border)', margin: '14px 0 0' }} />
  )
}
