interface Props {
  viewKey: string
  children: React.ReactNode
}

export function PageTransition({ viewKey, children }: Props): JSX.Element {
  return (
    <div key={viewKey} style={{ height: '100%' }}>
      {children}
    </div>
  )
}
