interface Props {
  viewKey: string
  children: React.ReactNode
  /**
   * Fill mode: stretch to fill a bounded parent (flex column) instead of
   * growing with content. Use when the page manages its own internal scroll
   * (sticky header + overflow-y-auto body), as the settings pages do.
   */
  fill?: boolean
}

export function PageTransition({ viewKey, children, fill = false }: Props): JSX.Element {
  return (
    <div
      key={viewKey}
      className="page-enter"
      style={fill ? { flex: 1, minHeight: 0 } : { minHeight: '100%' }}
    >
      {children}
    </div>
  )
}
