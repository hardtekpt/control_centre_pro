import { useState, useRef, useEffect, useCallback } from 'react'
import type { ComponentType } from 'react'
import { IconChevron, IconCheck } from './icons'

export interface DropdownOption {
  id: string
  label: string
  icon?: ComponentType<{ size?: number }>
  sub?: string
}

interface DropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  prefixIcon?: ComponentType<{ size?: number }>
}

export function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  prefixIcon: PrefixIcon,
}: DropdownProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<string>('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)

  const close = useCallback(() => {
    setOpen(false)
    setHighlighted('')
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    setHighlighted(value || options[0]?.id || '')
    setOpen(true)
  }, [disabled, value, options])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent): void => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return
      close()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open, close])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = options.findIndex((o) => o.id === highlighted)
      setHighlighted(options[Math.min(idx + 1, options.length - 1)]?.id ?? '')
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = options.findIndex((o) => o.id === highlighted)
      setHighlighted(options[Math.max(idx - 1, 0)]?.id ?? '')
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted) { onChange(highlighted); close() }
    }
  }, [open, highlighted, options, onChange, close, openMenu])

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className={`dropdown-trigger${open ? ' open' : ''}`}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        {PrefixIcon && (
          <span style={{ color: 'var(--color-text-secondary)', display: 'flex', flexShrink: 0 }}>
            <PrefixIcon size={14} />
          </span>
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : <span style={{ color: 'var(--color-text-tertiary)' }}>{placeholder}</span>}
        </span>
        <span className="dd-chevron" style={{ display: 'flex' }}>
          <IconChevron size={14} />
        </span>
      </button>

      {open && (
        <div ref={menuRef} className="dropdown-menu" onKeyDown={handleKeyDown}>
          {options.map((opt) => {
            const Icon = opt.icon
            const isSelected = opt.id === value
            const isHighlighted = opt.id === highlighted
            return (
              <div
                key={opt.id}
                className={`dropdown-item${isHighlighted ? ' highlighted' : ''}`}
                onPointerEnter={() => setHighlighted(opt.id)}
                onPointerDown={(e) => { e.preventDefault(); onChange(opt.id); close() }}
              >
                {Icon && (
                  <span style={{ color: 'var(--color-text-secondary)', display: 'flex', flexShrink: 0 }}>
                    <Icon size={14} />
                  </span>
                )}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {opt.sub && <span className="dd-sub">{opt.sub}</span>}
                {isSelected && (
                  <span style={{ color: 'var(--color-text-secondary)', display: 'flex', flexShrink: 0 }}>
                    <IconCheck size={14} />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
