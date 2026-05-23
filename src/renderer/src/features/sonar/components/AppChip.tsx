import { memo } from 'react'
import { accentFor, monogramFor } from '../data/catalogues'
import type { SonarAudioSession } from '@shared/types'

export interface AppChipProps {
  session: SonarAudioSession
  size?: 'sm' | 'md'
  draggable?: boolean
  isDragging?: boolean
  showLabel?: boolean
  onDragStart?: (session: SonarAudioSession) => void
  onDragEnd?: () => void
}

function AppChipComponent({
  session,
  size = 'sm',
  draggable = true,
  isDragging,
  showLabel,
  onDragStart,
  onDragEnd,
}: AppChipProps): JSX.Element {
  const name = session.displayName || session.processName
  const monogram = monogramFor(name)
  const accent = accentFor(session.processName)

  return (
    <div
      className={`sn-app-chip${isDragging ? ' dragging' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.setData(
          'application/sonar-session',
          JSON.stringify({ processId: session.processId, sourceRole: '' }),
        )
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(session)
      }}
      onDragEnd={() => onDragEnd?.()}
      title={name}
      style={{ '--app-accent': accent } as React.CSSProperties}
    >
      <span className={`sn-app-tile sz-${size}`}>{monogram}</span>
      {showLabel && (
        <span
          className="text-xs truncate ml-1"
          style={{ color: 'var(--color-text-primary)', maxWidth: 80 }}
        >
          {name}
        </span>
      )}
    </div>
  )
}

export const AppChip = memo(AppChipComponent)

/** Standalone monogram tile for non-session use (NowActiveCard, rule rows) */
export function MonogramTile({
  name,
  processName,
  size = 'sm',
}: {
  name: string
  processName: string
  size?: 'sm' | 'md'
}): JSX.Element {
  const monogram = monogramFor(name)
  const accent = accentFor(processName)
  return (
    <span
      className={`sn-app-tile sz-${size}`}
      style={{ '--app-accent': accent } as React.CSSProperties}
    >
      {monogram}
    </span>
  )
}
