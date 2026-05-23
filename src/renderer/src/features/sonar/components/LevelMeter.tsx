import { memo } from 'react'

export interface LevelMeterProps {
  /** 0-100 */
  peak: number
  muted?: boolean
  segments?: number
  height?: number
}

function LevelMeterComponent({ peak, muted, segments = 18, height = 200 }: LevelMeterProps): JSX.Element {
  const active = muted ? 0 : Math.round(Math.sqrt(Math.max(0, peak) / 100) * segments)

  const cells: JSX.Element[] = []
  for (let i = 0; i < segments; i++) {
    const fromTop = i
    const isActive = fromTop >= segments - active
    let zone = 'm-norm'
    if (fromTop < 2) zone = 'm-clip'
    else if (fromTop < 6) zone = 'm-hot'
    cells.push(
      <div
        key={i}
        className={`sn-m-cell ${zone}${isActive ? ' on' : ''}`}
      />,
    )
  }

  return (
    <div className="sn-meter" style={{ height }}>
      {cells}
    </div>
  )
}

export const LevelMeter = memo(LevelMeterComponent)
