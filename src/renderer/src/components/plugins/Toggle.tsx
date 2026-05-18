interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'sm' | 'lg'
}

export function Toggle({ checked, onChange, size = 'sm' }: ToggleProps): JSX.Element {
  const isSm = size === 'sm'
  const width = isSm ? '32px' : '40px'
  const height = isSm ? '18px' : '22px'
  const dotSize = isSm ? '14px' : '18px'

  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width,
        height,
        borderRadius: '999px',
        border: 'none',
        background: checked ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.2s',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '999px',
          background: 'white',
          transition: 'transform 0.2s',
          transform: checked ? `translateX(${isSm ? '14px' : '18px'})` : 'translateX(0)',
        }}
      />
    </button>
  )
}
