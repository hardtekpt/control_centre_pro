import './page-controls.css'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FilterChipDef {
  id: string
  label: string
  count?: number
  icon?: React.ReactNode
}

interface MainPageHeaderProps {
  title: string
  subtitle?: string
  chips?: FilterChipDef[]
  activeChip?: string
  onChipSelect?: (id: string) => void
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement>
  trailingActions?: React.ReactNode
}

// ── Search icon ────────────────────────────────────────────────────────────────

function IconSearch(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

// ── MainPageHeader ─────────────────────────────────────────────────────────────
//
// Vertical layout (top to bottom):
//   [title + subtitle (left)]  [search + trailing (right)]   ← title row
//   [chips ········]                                          (optional chips row)
//   ───────────────────────────                               (divider — when chips present)

export function MainPageHeader({
  title,
  subtitle,
  chips,
  activeChip,
  onChipSelect,
  searchValue,
  onSearchChange,
  searchRef,
  trailingActions,
}: MainPageHeaderProps): JSX.Element {
  const hasSearch = searchValue !== undefined || trailingActions
  const hasChips = chips && chips.length > 0

  return (
    <div style={{ padding: '18px 20px 0', flexShrink: 0 }}>
      {/* Title row: title/subtitle left, search/trailing right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              marginBottom: subtitle ? 4 : 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Search + trailing actions */}
        {hasSearch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2, flexShrink: 0 }}>
            {searchValue !== undefined && (
              <div className="search-input-wrap">
                <span className="search-icon"><IconSearch /></span>
                <input
                  ref={searchRef}
                  className="search-input"
                  type="text"
                  placeholder="Search…"
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                />
              </div>
            )}
            {trailingActions}
          </div>
        )}
      </div>

      {/* Chips row + divider */}
      {hasChips && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`filter-chip${activeChip === chip.id ? ' active' : ''}`}
                onClick={() => onChipSelect?.(chip.id)}
              >
                {chip.icon}
                {chip.label}
                {chip.count !== undefined && (
                  <span className="chip-count">{chip.count}</span>
                )}
              </button>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0 0' }} />
        </>
      )}

      {/* Divider when only search (no chips) */}
      {!hasChips && hasSearch && (
        <div style={{ height: 1, background: 'var(--color-border)', margin: '14px 0 0' }} />
      )}
    </div>
  )
}
