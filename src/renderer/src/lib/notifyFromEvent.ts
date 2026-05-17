import type { FC, ReactNode } from 'react'
import { createElement } from 'react'
import type { ArctisState, HeadsetNotificationSettings } from '@shared/types'
import { useNotificationStore } from '../stores/notificationStore'
import { useServiceStore } from '../stores/serviceStore'
import {
  IconLink, IconUnlink,
  IconWireless, IconBluetooth,
  IconBattery, IconBatteryLow, IconBatteryCharging,
  IconMic, IconMicOff,
  IconAnc, IconTransparency,
  IconVolume,
  IconChatMix,
  IconSidetone,
} from '../components/notifications/icons'

// ── Helpers ───────────────────────────────────────────────────────────────────

type IconComp = FC<{ size?: number }>

function push(n: Parameters<ReturnType<typeof useNotificationStore.getState>['push']>[0]): void {
  useNotificationStore.getState().push(n)
}

function getSettings(): HeadsetNotificationSettings {
  return useServiceStore.getState().settings.notifications.headset
}

function icon(Component: IconComp, size = 20): ReactNode {
  return createElement(Component, { size })
}

// ── Previous-state tracking (module-level) ────────────────────────────────────

let _prevWirelessConnected: boolean | null = null
let _prevBtConnected: boolean | null = null
let _prevBatteryHeadset: number | null = null
let _prevBatteryDock: number | null = null
let _prevAncMode: ArctisState['ancMode'] | null = null

/** Seed tracking state without firing a notification — call on app startup if headset already connected */
export function seedArctisTrackingState(state: ArctisState): void {
  _prevWirelessConnected = state.wirelessConnected
  _prevBtConnected = state.btConnected
  _prevBatteryHeadset = state.batteryHeadset
  _prevBatteryDock = state.batteryDock
  _prevAncMode = state.ancMode
}

/** Reset tracked state — call when headset disconnects so reconnect fires correctly */
export function resetArctisTrackingState(): void {
  _prevWirelessConnected = null
  _prevBtConnected = null
  _prevBatteryHeadset = null
  _prevBatteryDock = null
  _prevAncMode = null
}

// ── Connection events ─────────────────────────────────────────────────────────

export function notifyArctisConnected(state: ArctisState): void {
  const cfg = getSettings()
  if (cfg.powerOnOff.enabled) {
    if (cfg.powerOnOff.shape === 'circle') {
      push({ kind: 'circle', key: 'arctis-power', icon: icon(IconLink), ttl: 2400 })
    } else {
      push({
        kind: 'rect', key: 'arctis-power',
        icon: icon(IconLink),
        title: 'Arctis Nova Pro',
        subtitle: 'Connected · ready',
        ttl: 2400,
      })
    }
  }
  // Seed initial state for change tracking
  _prevWirelessConnected = state.wirelessConnected
  _prevBtConnected = state.btConnected
  _prevBatteryHeadset = state.batteryHeadset
  _prevBatteryDock = state.batteryDock
  _prevAncMode = state.ancMode
}

export function notifyArctisDisconnected(): void {
  const cfg = getSettings()
  if (cfg.powerOnOff.enabled) {
    if (cfg.powerOnOff.shape === 'circle') {
      push({ kind: 'circle', key: 'arctis-power', icon: icon(IconUnlink), ttl: 2400 })
    } else {
      push({
        kind: 'rect', key: 'arctis-power',
        icon: icon(IconUnlink),
        title: 'Arctis Nova Pro',
        subtitle: 'Disconnected',
        ttl: 2400,
      })
    }
  }
  resetArctisTrackingState()
}

// ── Arctis HID events ─────────────────────────────────────────────────────────

export function notifyArctisEvent(eventName: string, data: unknown): void {
  const cfg = getSettings()

  switch (eventName) {
    // ── Connectivity ──────────────────────────────────────────────────────────
    case 'ConnectivityEvent': {
      const d = data as { btActive: boolean; btConnected: boolean; btPairing: boolean; wirelessConnected: boolean }

      // Wireless connectivity change
      if (cfg.wireless.enabled && _prevWirelessConnected !== null && d.wirelessConnected !== _prevWirelessConnected) {
        const connected = d.wirelessConnected
        if (cfg.wireless.shape === 'circle') {
          push({
            kind: 'circle', key: 'arctis-wireless',
            icon: icon(connected ? IconWireless : IconUnlink),
            ttl: 2400,
          })
        } else {
          push({
            kind: 'rect', key: 'arctis-wireless',
            icon: icon(IconWireless),
            title: connected ? 'Wireless connected' : 'Wireless disconnected',
            subtitle: connected ? '2.4 GHz link active' : '2.4 GHz link lost',
            ttl: 2400,
          })
        }
      }
      _prevWirelessConnected = d.wirelessConnected

      // Bluetooth connectivity change
      if (cfg.bluetooth.enabled && _prevBtConnected !== null && d.btConnected !== _prevBtConnected) {
        const connected = d.btConnected
        if (cfg.bluetooth.shape === 'circle') {
          push({
            kind: 'circle', key: 'arctis-bt',
            icon: icon(connected ? IconBluetooth : IconUnlink),
            ttl: 2400,
          })
        } else {
          push({
            kind: 'rect', key: 'arctis-bt',
            icon: icon(IconBluetooth),
            title: connected ? 'Bluetooth connected' : 'Bluetooth disconnected',
            subtitle: connected ? 'BT device paired and active' : 'BT device disconnected',
            ttl: 2400,
          })
        }
      }
      _prevBtConnected = d.btConnected
      break
    }

    // ── Battery ───────────────────────────────────────────────────────────────
    case 'BatteryEvent': {
      const d = data as { batteryHeadset: number; batteryDock: number }

      // Low battery threshold crossing (only fires on the way down)
      if (cfg.batteryLow.enabled && _prevBatteryHeadset !== null) {
        const threshold = cfg.batteryLow.threshold
        if (d.batteryHeadset < threshold && _prevBatteryHeadset >= threshold) {
          if (cfg.batteryLow.shape === 'ring') {
            push({
              kind: 'ring', key: 'battery-low',
              icon: icon(IconBatteryLow),
              value: d.batteryHeadset,
              ttl: 4000,
            })
          } else {
            push({
              kind: 'rect', key: 'battery-low',
              icon: icon(IconBatteryLow),
              title: 'Low battery',
              subtitle: `Headset at ${d.batteryHeadset}%`,
              tail: `${d.batteryHeadset}%`,
              ttl: 4000,
            })
          }
        }
      }

      // Charging detection — battery increasing by ≥2 between events
      if (cfg.batteryCharging.enabled && _prevBatteryHeadset !== null) {
        if (d.batteryHeadset >= _prevBatteryHeadset + 2) {
          if (cfg.batteryCharging.shape === 'circle') {
            push({ kind: 'circle', key: 'battery-charging', icon: icon(IconBatteryCharging), ttl: 2400 })
          } else {
            push({
              kind: 'rect', key: 'battery-charging',
              icon: icon(IconBatteryCharging),
              title: 'Charging',
              subtitle: `Headset at ${d.batteryHeadset}%`,
              ttl: 2400,
            })
          }
        }
      }
      _prevBatteryHeadset = d.batteryHeadset

      // Dock inserted / removed (batteryDock 0 ↔ > 0)
      if (cfg.batteryDock.enabled && _prevBatteryDock !== null) {
        const wasInDock = _prevBatteryDock > 0
        const isInDock = d.batteryDock > 0
        if (isInDock !== wasInDock) {
          if (cfg.batteryDock.shape === 'circle') {
            push({
              kind: 'circle', key: 'battery-dock',
              icon: icon(isInDock ? IconBattery : IconBatteryLow),
              ttl: 2400,
            })
          } else {
            push({
              kind: 'rect', key: 'battery-dock',
              icon: icon(IconBattery),
              title: isInDock ? 'Dock inserted' : 'Dock removed',
              subtitle: isInDock ? `Dock at ${d.batteryDock}%` : undefined,
              ttl: 2400,
            })
          }
        }
      }
      _prevBatteryDock = d.batteryDock
      break
    }

    // ── Mic mute ──────────────────────────────────────────────────────────────
    case 'MicMuteEvent': {
      if (!cfg.micMute.enabled) break
      const d = data as { micMuted: boolean }
      if (cfg.micMute.shape === 'circle') {
        push({
          kind: 'circle', key: 'mic-mute',
          icon: icon(d.micMuted ? IconMicOff : IconMic),
          ttl: 1800,
        })
      } else {
        push({
          kind: 'rect', key: 'mic-mute',
          icon: icon(d.micMuted ? IconMicOff : IconMic),
          title: d.micMuted ? 'Mic muted' : 'Mic active',
          subtitle: d.micMuted ? 'Microphone is muted' : 'Microphone is live',
          ttl: 1800,
        })
      }
      break
    }

    // ── ANC mode ──────────────────────────────────────────────────────────────
    case 'AncModeEvent': {
      if (!cfg.ancMode.enabled) break
      const d = data as { ancMode: ArctisState['ancMode'] }
      const mode = d.ancMode

      // Skip if mode hasn't actually changed (e.g. on initial sync)
      if (mode === _prevAncMode) break
      _prevAncMode = mode

      const ancIcon = mode === 'TRANSPARENCY' ? IconTransparency : IconAnc
      const ancTitle =
        mode === 'TRANSPARENCY' ? 'Transparency mode' :
        mode === 'ANC'          ? 'Noise cancellation' :
                                  'ANC off'
      const ancSub =
        mode === 'TRANSPARENCY' ? 'Hear what’s around you' :
        mode === 'ANC'          ? 'Active · ambient suppressed' :
                                  'Passive listening'

      if (cfg.ancMode.shape === 'circle') {
        push({ kind: 'circle', key: 'anc-mode', icon: icon(ancIcon), ttl: 2400 })
      } else {
        push({
          kind: 'rect', key: 'anc-mode',
          icon: icon(ancIcon),
          title: ancTitle,
          subtitle: ancSub,
          ttl: 2400,
        })
      }
      break
    }

    // ── Volume ────────────────────────────────────────────────────────────────
    case 'VolumeEvent': {
      if (!cfg.volume.enabled) break
      const d = data as { volume: number }
      if (cfg.volume.shape === 'volume') {
        push({
          kind: 'volume', key: 'headset-volume',
          icon: icon(IconVolume),
          label: 'Headset volume',
          value: d.volume,
          ttl: 1800,
        })
      } else {
        push({
          kind: 'ring', key: 'headset-volume',
          icon: icon(IconVolume),
          value: d.volume,
          ttl: 1800,
        })
      }
      break
    }

    // ── ChatMix ───────────────────────────────────────────────────────────────
    case 'ChatMixEvent': {
      if (!cfg.chatmix.enabled) break
      const d = data as { chatmixGame: number; chatmixChat: number }
      // Represent chatmix as game-side percentage (0 = all chat, 100 = all game)
      const gameBalance = d.chatmixGame
      if (cfg.chatmix.shape === 'volume') {
        push({
          kind: 'volume', key: 'chatmix',
          icon: icon(IconChatMix),
          label: 'ChatMix · Game',
          value: gameBalance,
          ttl: 1800,
        })
      } else {
        push({
          kind: 'ring', key: 'chatmix',
          icon: icon(IconChatMix),
          value: gameBalance,
          ttl: 1800,
        })
      }
      break
    }

    // ── Sidetone ──────────────────────────────────────────────────────────────
    case 'SidetoneEvent': {
      if (!cfg.sidetone.enabled) break
      const d = data as { sidetone: ArctisState['sidetone'] }
      const levelLabel =
        d.sidetone === 'OFF'    ? 'Off' :
        d.sidetone === 'LOW'    ? 'Low' :
        d.sidetone === 'MEDIUM' ? 'Medium' :
                                  'High'
      if (cfg.sidetone.shape === 'circle') {
        push({ kind: 'circle', key: 'sidetone', icon: icon(IconSidetone), ttl: 2400 })
      } else {
        push({
          kind: 'rect', key: 'sidetone',
          icon: icon(IconSidetone),
          title: 'Sidetone',
          subtitle: levelLabel,
          ttl: 2400,
        })
      }
      break
    }
  }
}
