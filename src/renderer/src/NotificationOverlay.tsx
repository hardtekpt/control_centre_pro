import { useEffect, useRef, createElement } from 'react'
import type { FC } from 'react'
import { useNotificationStore } from './stores/notificationStore'
import type { NotificationInput } from './stores/notificationStore'
import { NotificationStack } from './components/notifications/NotificationStack'
import {
  IconLink, IconUnlink,
  IconWireless, IconBluetooth,
  IconBattery, IconBatteryLow, IconBatteryCharging,
  IconMic, IconMicOff,
  IconAnc, IconTransparency,
  IconVolume, IconChatMix, IconSidetone,
  IconSonar, IconMonitor,
} from './components/notifications/icons'
import type { SerializedNotification } from '@shared/types'
import './styles/globals.css'
import './components/notifications/notifications.css'

// ── Icon registry ─────────────────────────────────────────────────────────────

type IconComp = FC<{ size?: number }>

const ICON_MAP: Record<string, IconComp> = {
  'link':             IconLink,
  'unlink':           IconUnlink,
  'wireless':         IconWireless,
  'bluetooth':        IconBluetooth,
  'battery':          IconBattery,
  'battery-low':      IconBatteryLow,
  'battery-charging': IconBatteryCharging,
  'mic':              IconMic,
  'mic-off':          IconMicOff,
  'anc':              IconAnc,
  'transparency':     IconTransparency,
  'volume':           IconVolume,
  'chatmix':          IconChatMix,
  'sidetone':         IconSidetone,
  'sonar':            IconSonar,
  'monitor':          IconMonitor,
}

function deserialize(spec: SerializedNotification): NotificationInput | null {
  const IconComp = spec.iconId ? ICON_MAP[spec.iconId] : undefined
  const icon = IconComp ? createElement(IconComp, { size: 20 }) : null

  switch (spec.kind) {
    case 'rect':
      if (!spec.title || !icon) return null
      return { kind: 'rect', key: spec.key, icon, title: spec.title, subtitle: spec.subtitle, tail: spec.tail, wide: spec.wide, ttl: spec.ttl }
    case 'volume':
      if (!icon) return null
      return { kind: 'volume', key: spec.key, icon, label: spec.label, value: spec.value ?? 0, ttl: spec.ttl }
    case 'circle':
      if (!icon) return null
      return { kind: 'circle', key: spec.key, icon, dot: spec.dot, ttl: spec.ttl }
    case 'ring':
      if (!icon) return null
      return { kind: 'ring', key: spec.key, icon, value: spec.value ?? 0, ttl: spec.ttl }
    case 'glyph':
      if (!spec.glyph) return null
      return { kind: 'glyph', key: spec.key, glyph: spec.glyph, sub: spec.sub, ttl: spec.ttl }
    default:
      return null
  }
}

// ── Overlay component ─────────────────────────────────────────────────────────

export default function NotificationOverlay(): JSX.Element {
  const items = useNotificationStore((s) => s.items)
  const push = useNotificationStore((s) => s.push)
  const hadItemsRef = useRef(false)

  // Overlay window must have a transparent body — globals.css sets a solid background
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
  }, [])

  // Apply theme from persisted settings
  useEffect(() => {
    window.api.getSettings().then((settings) => {
      let resolved = settings.theme
      if (resolved === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      if (resolved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
    }).catch(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
  }, [])

  // Receive and deserialize incoming notifications
  useEffect(() => {
    return window.api.onNotifReceive((spec) => {
      const notif = deserialize(spec)
      if (notif) push(notif)
    })
  }, [push])

  // Hide overlay window once all notifications have cleared
  useEffect(() => {
    if (items.length > 0) {
      hadItemsRef.current = true
    } else if (hadItemsRef.current) {
      hadItemsRef.current = false
      window.api.notifAllDismissed().catch(() => {})
    }
  }, [items.length])

  // Smart mouse passthrough — transparent areas forward clicks; .notif cards capture them
  useEffect(() => {
    let overNotif = false

    const handleMouseMove = (e: MouseEvent): void => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const nowOver = !!el?.closest('.notif')
      if (nowOver !== overNotif) {
        overNotif = nowOver
        window.api.notifSetIgnoreMouse(!nowOver).catch(() => {})
      }
    }

    const handleMouseLeave = (): void => {
      if (overNotif) {
        overNotif = false
        window.api.notifSetIgnoreMouse(true).catch(() => {})
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return <NotificationStack />
}
