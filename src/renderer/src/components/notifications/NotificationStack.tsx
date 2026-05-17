import { useState, useEffect } from 'react'
import { useNotificationStore } from '../../stores/notificationStore'
import type { Notification } from '../../stores/notificationStore'
import { NotificationRect, NotificationVolume } from './NotificationRect'
import { NotificationCircle, NotificationCircleRing, NotificationCircleGlyph } from './NotificationCircle'
import './notifications.css'

// ── Phase state machine ───────────────────────────────────────────────────────

type Phase = 'enter' | 'shown' | 'exit'

interface NotifItemProps {
  item: Notification
  onDismiss: (id: number) => void
}

function NotifItem({ item, onDismiss }: NotifItemProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('enter')

  // enter → shown on next frame; start TTL timer
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase('shown'))
    const ttl = item.ttl ?? 2400
    let timer: ReturnType<typeof setTimeout> | undefined
    if (Number.isFinite(ttl)) {
      timer = setTimeout(() => setPhase('exit'), ttl)
    }
    return () => {
      cancelAnimationFrame(frame)
      if (timer !== undefined) clearTimeout(timer)
    }
    // Run only on mount and when the item is replaced in-place (id changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // exit → call dismiss after animation completes
  useEffect(() => {
    if (phase !== 'exit') return
    const t = setTimeout(() => onDismiss(item.id), 320)
    return () => clearTimeout(t)
  }, [phase, item.id, onDismiss])

  const phaseClass = `phase-${phase}`
  const handleClick = (): void => setPhase('exit')

  if (item.kind === 'circle') {
    return (
      <NotificationCircle
        icon={item.icon}
        dot={item.dot}
        className={phaseClass}
        onClick={handleClick}
      />
    )
  }
  if (item.kind === 'ring') {
    return (
      <NotificationCircleRing
        icon={item.icon}
        value={item.value}
        className={phaseClass}
        onClick={handleClick}
      />
    )
  }
  if (item.kind === 'glyph') {
    return (
      <NotificationCircleGlyph
        glyph={item.glyph}
        sub={item.sub}
        className={phaseClass}
        onClick={handleClick}
      />
    )
  }
  if (item.kind === 'volume') {
    return (
      <NotificationVolume
        icon={item.icon}
        label={item.label}
        value={item.value}
        className={phaseClass}
        onClick={handleClick}
      />
    )
  }
  return (
    <NotificationRect
      icon={item.icon}
      title={item.title}
      subtitle={item.subtitle}
      tail={item.tail}
      wide={item.wide}
      className={phaseClass}
      onClick={handleClick}
    />
  )
}

// ── Stack host ────────────────────────────────────────────────────────────────

export function NotificationStack(): JSX.Element {
  const items = useNotificationStore((s) => s.items)
  const dismiss = useNotificationStore((s) => s.dismiss)

  return (
    <div className="notif-stack">
      {items.map((item) => (
        <NotifItem key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  )
}
