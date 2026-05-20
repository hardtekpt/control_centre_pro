import type { ArctisState, HeadsetNotificationSettings, SonarNotificationSettings, DisplayNotificationSettings, SerializedNotification } from '@shared/types'
import { useServiceStore } from '../stores/serviceStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function push(spec: Omit<SerializedNotification, never>): void {
  window.api.notifPush(spec).catch(console.error)
}

function getSettings(): HeadsetNotificationSettings {
  return useServiceStore.getState().settings.notifications.headset
}

function getDurationMs(): number {
  return useServiceStore.getState().settings.notifications.durationMs
}

function getSonarSettings(): SonarNotificationSettings {
  return useServiceStore.getState().settings.notifications.sonar
}

function getDisplaySettings(): DisplayNotificationSettings {
  return useServiceStore.getState().settings.notifications.display
}

// ── Previous-state tracking (module-level) ────────────────────────────────────

let _prevWirelessConnected: boolean | null = null
let _prevBtStatus: ArctisState['btStatus'] | null = null
let _prevBatteryHeadset: number | null = null
let _prevBatteryDock: number | null = null
let _prevAncMode: ArctisState['ancMode'] | null = null
let _prevBaseStationConnected: boolean | null = null

/** Seed tracking state without firing a notification — call on app startup if headset already connected */
export function seedArctisTrackingState(state: ArctisState): void {
  _prevWirelessConnected = state.wirelessConnected
  _prevBtStatus = state.btStatus
  _prevBatteryHeadset = state.batteryHeadset
  _prevBatteryDock = state.batteryDock
  _prevAncMode = state.ancMode
  _prevBaseStationConnected = state.baseStationConnected
}

/** Reset tracked state — call when headset disconnects so reconnect fires correctly */
export function resetArctisTrackingState(): void {
  _prevWirelessConnected = null
  _prevBtStatus = null
  _prevBatteryHeadset = null
  _prevBatteryDock = null
  _prevAncMode = null
  _prevBaseStationConnected = null
}

// ── Connection events ─────────────────────────────────────────────────────────

export function notifyArctisConnected(state: ArctisState): void {
  const cfg = getSettings()
  if (cfg.powerOnOff.enabled) {
    if (cfg.powerOnOff.shape === 'circle') {
      push({ kind: 'circle', key: 'arctis-power', iconId: 'link', ttl: 2400 })
    } else {
      push({
        kind: 'rect', key: 'arctis-power',
        iconId: 'link',
        title: 'Arctis Nova Pro',
        subtitle: 'Connected · ready',
        ttl: 2400,
      })
    }
  }
  _prevWirelessConnected = state.wirelessConnected
  _prevBtStatus = state.btStatus
  _prevBatteryHeadset = state.batteryHeadset
  _prevBatteryDock = state.batteryDock
  _prevAncMode = state.ancMode
}

export function notifyArctisDisconnected(): void {
  const cfg = getSettings()
  if (cfg.powerOnOff.enabled) {
    if (cfg.powerOnOff.shape === 'circle') {
      push({ kind: 'circle', key: 'arctis-power', iconId: 'unlink', ttl: 2400 })
    } else {
      push({
        kind: 'rect', key: 'arctis-power',
        iconId: 'unlink',
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
      const d = data as { wirelessConnected: boolean; headsetPowered: boolean | null; btStatus: ArctisState['btStatus'] }

      if (cfg.wireless.enabled && _prevWirelessConnected !== null && d.wirelessConnected !== _prevWirelessConnected) {
        const connected = d.wirelessConnected
        if (cfg.wireless.shape === 'circle') {
          push({ kind: 'circle', key: 'arctis-wireless', iconId: connected ? 'wireless' : 'unlink', ttl: 2400 })
        } else {
          push({
            kind: 'rect', key: 'arctis-wireless',
            iconId: 'wireless',
            title: connected ? 'Wireless connected' : 'Wireless disconnected',
            subtitle: connected ? '2.4 GHz link active' : '2.4 GHz link lost',
            ttl: 2400,
          })
        }
      }
      _prevWirelessConnected = d.wirelessConnected

      const wasConnected = _prevBtStatus === 'CONNECTED'
      const isConnected  = d.btStatus === 'CONNECTED'
      if (cfg.bluetooth.enabled && _prevBtStatus !== null && isConnected !== wasConnected) {
        if (cfg.bluetooth.shape === 'circle') {
          push({ kind: 'circle', key: 'arctis-bt', iconId: isConnected ? 'bluetooth' : 'unlink', ttl: 2400 })
        } else {
          push({
            kind: 'rect', key: 'arctis-bt',
            iconId: 'bluetooth',
            title: isConnected ? 'Bluetooth connected' : 'Bluetooth disconnected',
            subtitle: isConnected ? 'BT device paired and active' : 'BT device disconnected',
            ttl: 2400,
          })
        }
      }
      _prevBtStatus = d.btStatus
      break
    }

    // ── Battery ───────────────────────────────────────────────────────────────
    case 'BatteryEvent': {
      const d = data as { batteryHeadset: number; batteryDock: number }

      if (cfg.batteryLow.enabled && _prevBatteryHeadset !== null) {
        const threshold = cfg.batteryLow.threshold
        if (d.batteryHeadset < threshold && _prevBatteryHeadset >= threshold) {
          if (cfg.batteryLow.shape === 'ring') {
            push({ kind: 'ring', key: 'battery-low', iconId: 'battery-low', value: d.batteryHeadset, ttl: 4000 })
          } else {
            push({
              kind: 'rect', key: 'battery-low',
              iconId: 'battery-low',
              title: 'Low battery',
              subtitle: `Headset at ${d.batteryHeadset}%`,
              tail: `${d.batteryHeadset}%`,
              ttl: 4000,
            })
          }
        }
      }

      if (cfg.batteryCharging.enabled && _prevBatteryHeadset !== null) {
        if (d.batteryHeadset >= _prevBatteryHeadset + 2) {
          if (cfg.batteryCharging.shape === 'circle') {
            push({ kind: 'circle', key: 'battery-charging', iconId: 'battery-charging', ttl: 2400 })
          } else {
            push({
              kind: 'rect', key: 'battery-charging',
              iconId: 'battery-charging',
              title: 'Charging',
              subtitle: `Headset at ${d.batteryHeadset}%`,
              ttl: 2400,
            })
          }
        }
      }
      _prevBatteryHeadset = d.batteryHeadset

      if (cfg.batteryDock.enabled && _prevBatteryDock !== null) {
        const wasInDock = _prevBatteryDock > 0
        const isInDock = d.batteryDock > 0
        if (isInDock !== wasInDock) {
          if (cfg.batteryDock.shape === 'circle') {
            push({ kind: 'circle', key: 'battery-dock', iconId: isInDock ? 'battery' : 'battery-low', ttl: 2400 })
          } else {
            push({
              kind: 'rect', key: 'battery-dock',
              iconId: 'battery',
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
        push({ kind: 'circle', key: 'mic-mute', iconId: d.micMuted ? 'mic-off' : 'mic', ttl: 1800 })
      } else {
        push({
          kind: 'rect', key: 'mic-mute',
          iconId: d.micMuted ? 'mic-off' : 'mic',
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

      if (mode === _prevAncMode) break
      _prevAncMode = mode

      const ancIconId = mode === 'TRANSPARENCY' ? 'transparency' : 'anc'
      const ancTitle =
        mode === 'TRANSPARENCY' ? 'Transparency mode' :
        mode === 'ANC'          ? 'Noise cancellation' :
                                  'ANC off'
      const ancSub =
        mode === 'TRANSPARENCY' ? 'Hear what’s around you' :
        mode === 'ANC'          ? 'Active · ambient suppressed' :
                                  'Passive listening'

      if (cfg.ancMode.shape === 'circle') {
        push({ kind: 'circle', key: 'anc-mode', iconId: ancIconId, ttl: 2400 })
      } else {
        push({ kind: 'rect', key: 'anc-mode', iconId: ancIconId, title: ancTitle, subtitle: ancSub, ttl: 2400 })
      }
      break
    }

    // ── Volume ────────────────────────────────────────────────────────────────
    case 'VolumeEvent': {
      if (!cfg.volume.enabled) break
      const d = data as { volume: number }
      if (cfg.volume.shape === 'volume') {
        push({ kind: 'volume', key: 'headset-volume', iconId: 'volume', label: 'Headset volume', value: d.volume, ttl: 1800 })
      } else {
        push({ kind: 'ring', key: 'headset-volume', iconId: 'volume', value: d.volume, ttl: 1800 })
      }
      break
    }

    // ── ChatMix ───────────────────────────────────────────────────────────────
    case 'ChatMixEvent': {
      if (!cfg.chatmix.enabled) break
      const d = data as { chatmixGame: number; chatmixChat: number }
      const gameBalance = d.chatmixGame
      if (cfg.chatmix.shape === 'volume') {
        push({ kind: 'volume', key: 'chatmix', iconId: 'chatmix', label: 'ChatMix · Game', value: gameBalance, ttl: 1800 })
      } else {
        push({ kind: 'ring', key: 'chatmix', iconId: 'chatmix', value: gameBalance, ttl: 1800 })
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
        push({ kind: 'circle', key: 'sidetone', iconId: 'sidetone', ttl: 2400 })
      } else {
        push({ kind: 'rect', key: 'sidetone', iconId: 'sidetone', title: 'Sidetone', subtitle: levelLabel, ttl: 2400 })
      }
      break
    }

    // ── Base Station Connection ────────────────────────────────────────────
    case 'DeviceDisconnectedEvent':
    case 'DeviceReconnectedEvent': {
      const d = data as { baseStationConnected: boolean }
      // Only notify if state actually changed and prev state is known (avoid notifications on app startup)
      if (_prevBaseStationConnected !== null && d.baseStationConnected !== _prevBaseStationConnected) {
        const cfg = getSettings()
        if (cfg.powerOnOff.enabled) {
          const connected = d.baseStationConnected
          if (cfg.powerOnOff.shape === 'circle') {
            push({ kind: 'circle', key: 'arctis-base-station', iconId: connected ? 'link' : 'unlink', ttl: 2400 })
          } else {
            push({
              kind: 'rect', key: 'arctis-base-station',
              iconId: 'link',
              title: 'Arctis Nova Pro',
              subtitle: connected ? 'Base station reconnected' : 'Base station disconnected',
              ttl: 2400,
            })
          }
        }
      }
      _prevBaseStationConnected = d.baseStationConnected
      break
    }
  }
}

// ── Sonar notifications ───────────────────────────────────────────────────────

export function notifySonarPresetChange(presetName: string): void {
  const cfg = getSonarSettings()
  const ttl = getDurationMs()
  if (cfg.presetChange.enabled) {
    if (cfg.presetChange.shape === 'circle') {
      push({ kind: 'circle', key: 'sonar-preset', iconId: 'sonar', ttl })
    } else {
      push({
        kind: 'rect',
        key: 'sonar-preset',
        iconId: 'sonar',
        title: 'GG Sonar',
        subtitle: `Preset: ${presetName}`,
        ttl,
      })
    }
  }
}

// ── Display notifications ─────────────────────────────────────────────────────

export function notifyDisplayInputChange(displayName: string, inputName: string): void {
  const cfg = getDisplaySettings()
  const ttl = getDurationMs()
  if (cfg.inputSourceChange.enabled) {
    if (cfg.inputSourceChange.shape === 'circle') {
      push({ kind: 'circle', key: 'display-input', iconId: 'monitor', ttl })
    } else {
      push({
        kind: 'rect',
        key: 'display-input',
        iconId: 'monitor',
        title: displayName,
        subtitle: `Input: ${inputName}`,
        ttl,
      })
    }
  }
}
