interface MainPageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  bottomSlot?: React.ReactNode
}

export function MainPageHeader({ title, subtitle, actions, bottomSlot }: MainPageHeaderProps): JSX.Element {
  return (
    <div style={{ padding: '18px 20px 0', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              marginBottom: 4,
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
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            {actions}
          </div>
        )}
      </div>
      {bottomSlot}
    </div>
  )
}
