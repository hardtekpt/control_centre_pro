import { useRef } from 'react'
import { SwitchTransition, CSSTransition } from 'react-transition-group'

const DURATION = 180 // must match --anim-page-duration

interface Props {
  viewKey: string
  children: React.ReactNode
}

export function PageTransition({ viewKey, children }: Props): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null)

  return (
    <SwitchTransition mode="out-in">
      <CSSTransition
        key={viewKey}
        nodeRef={nodeRef}
        classNames="page-transition"
        timeout={DURATION}
        unmountOnExit
      >
        <div ref={nodeRef} style={{ height: '100%' }}>
          {children}
        </div>
      </CSSTransition>
    </SwitchTransition>
  )
}
