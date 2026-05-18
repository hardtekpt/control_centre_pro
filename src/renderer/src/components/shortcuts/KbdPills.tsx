import { Fragment } from 'react'

interface KbdPillsProps {
  keys: string[]
}

export function KbdPills({ keys }: KbdPillsProps): JSX.Element {
  if (keys.length === 0) {
    return <span className="kbd unset">unset</span>
  }
  return (
    <>
      {keys.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kbd-plus">+</span>}
          <span className="kbd">{k}</span>
        </Fragment>
      ))}
    </>
  )
}
