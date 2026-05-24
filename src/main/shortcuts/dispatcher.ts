import { exec } from 'child_process'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { AppSettings, DdcMonitor, SerializedNotification } from '../../shared/types'
import type { ServiceManager } from '../services/serviceManager'
import type { SonarService } from '../services/sonarService'
import type { DdcService } from '../services/apis/ddc/service'

let _mainWindow: BrowserWindow | null = null
let _serviceManager: ServiceManager | null = null
let _sonarService: SonarService | null = null
let _ddcService: DdcService | null = null
let _showMainWindow: (() => void) | null = null
let _getSettings: (() => AppSettings) | null = null
let _pushNotif: ((spec: SerializedNotification) => void) | null = null

export function initDispatcher(
  mainWindow: BrowserWindow,
  serviceManager: ServiceManager,
  sonarService: SonarService,
  ddcService: DdcService,
  showMainWindow: () => void,
  getSettings: () => AppSettings,
  pushNotif: (spec: SerializedNotification) => void,
): void {
  _mainWindow = mainWindow
  _serviceManager = serviceManager
  _sonarService = sonarService
  _ddcService = ddcService
  _showMainWindow = showMainWindow
  _getSettings = getSettings
  _pushNotif = pushNotif
}

function notifyBrightness(monitors: DdcMonitor[], brightnessMap: Map<number, number>): void {
  const cfg = _getSettings?.().notifications?.display?.brightness
  if (!cfg?.enabled) return
  const ttl = _getSettings?.().notifications?.durationMs ?? 2400
  for (const m of monitors) {
    const value = brightnessMap.get(m.monitor_id) ?? m.brightness
    if (cfg.shape === 'volume') {
      _pushNotif?.({ kind: 'volume', key: `display-brightness-${m.monitor_id}`, iconId: 'monitor', label: `Monitor ${m.monitor_id}`, value, ttl })
    } else {
      _pushNotif?.({ kind: 'ring', key: `display-brightness-${m.monitor_id}`, iconId: 'monitor', value, ttl })
    }
  }
}

/**
 * Resolve a monitor-target string to an array of DdcMonitor objects.
 * target = "all" → all monitors
 * target = "1" | "2" | … → single monitor by ID
 * target = "g_<groupId>" → monitors in that group
 * Fallback (legacy plain number value): all monitors
 */
function resolveTarget(target: string, monitors: DdcMonitor[]): DdcMonitor[] {
  if (target === 'all') return monitors
  if (target.startsWith('g_')) {
    const groupId = target.slice(2)
    const groups = _getSettings?.().monitorGroups ?? []
    const group = groups.find((g) => g.id === groupId)
    if (!group) return []
    return monitors.filter((m) => group.monitorIds.includes(m.monitor_id))
  }
  const id = Number(target)
  if (Number.isNaN(id)) return monitors
  return monitors.filter((m) => m.monitor_id === id)
}

/**
 * Parse a "TARGET:NUMBER" compound value from brightness shortcuts.
 * Backwards-compatible: a plain number string (no colon) → target = "all".
 */
function parseTargetNumber(value: unknown, fallback: number): { target: string; num: number } {
  const str = String(value ?? '')
  const sep = str.lastIndexOf(':')
  if (sep === -1) {
    // Legacy plain-number value
    return { target: 'all', num: Number(str) || fallback }
  }
  return { target: str.slice(0, sep), num: Number(str.slice(sep + 1)) || fallback }
}

export async function dispatch(actionId: string, value?: unknown): Promise<void> {
  try {
    await _dispatch(actionId, value)
  } catch (err) {
    console.error('[shortcuts] dispatch failed:', actionId, err)
  }
}

async function _dispatch(actionId: string, value?: unknown): Promise<void> {
  switch (actionId) {
    // ── Arctis ────────────────────────────────────────────────────────────────
    case 'arctis.mute':
      _serviceManager?.sendArctisCmd('mute-toggle', null)
      break
    case 'arctis.anc-cycle':
      _serviceManager?.sendArctisCmd('anc-cycle', null)
      break
    case 'arctis.anc-set': {
      const modeMap: Record<string, string> = { off: 'OFF', trans: 'TRANSPARENCY', anc: 'ANC' }
      _serviceManager?.sendArctisCmd('setAncMode', modeMap[String(value)] ?? String(value))
      break
    }
    case 'arctis.vol-up':
      _serviceManager?.sendArctisCmd('vol-delta', Number(value) || 5)
      break
    case 'arctis.vol-down':
      _serviceManager?.sendArctisCmd('vol-delta', -(Number(value) || 5))
      break
    case 'arctis.vol-set':
      _serviceManager?.sendArctisCmd('setVolume', (Number(value) || 60) / 100)
      break
    case 'arctis.output-mute':
      _serviceManager?.sendArctisCmd('output-mute-toggle', null)
      break
    case 'arctis.sidetone': {
      const lvl = Number(value) || 30
      const sidetoneMap: Record<string, string> = { 0: 'OFF', 25: 'LOW', 50: 'MEDIUM', 75: 'MEDIUM', 100: 'HIGH' }
      const nearest = [0, 25, 50, 75, 100].reduce((a, b) => Math.abs(b - lvl) < Math.abs(a - lvl) ? b : a)
      _serviceManager?.sendArctisCmd('setSidetone', sidetoneMap[String(nearest)] ?? 'LOW')
      break
    }
    case 'arctis.power':
      _serviceManager?.sendArctisCmd('power-off', null)
      break

    // ── Sonar ─────────────────────────────────────────────────────────────────
    case 'sonar.preset-set': {
      const state = _sonarService?.getState()
      if (!state?.configs) break
      const presetNameMap: Record<string, string> = {
        music: 'Music', game: 'Game', studio: 'Studio', cinema: 'Cinema', speech: 'Speech', flat: 'Flat',
      }
      const name = presetNameMap[String(value)]
      const config = state.configs.find((c) => c.name?.toLowerCase() === name?.toLowerCase())
      if (config) await _sonarService?.selectPreset(config.id)
      break
    }
    case 'sonar.preset-cycle': {
      const state = _sonarService?.getState()
      if (!state?.configs || state.configs.length === 0) break
      const current = state.configs.find((c) => c.isSelected)
      const idx = current ? state.configs.indexOf(current) : -1
      const next = state.configs[(idx + 1) % state.configs.length]
      if (next) await _sonarService?.selectPreset(next.id)
      break
    }
    case 'sonar.channel-up': {
      const chanMap: Record<string, string> = {
        game: 'game', chat: 'chatRender', media: 'media', aux: 'aux', mic: 'chatCapture',
      }
      const ch = chanMap[String(value)] as 'game' | 'chatRender' | 'media' | 'aux' | 'chatCapture'
      if (!ch) break
      const state = _sonarService?.getState()
      const vol = state?.classic?.devices[ch as keyof typeof state.classic.devices]?.classic?.volume ?? 0.5
      await _sonarService?.setVolume(ch as 'game', Math.min(1, vol + 0.05))
      break
    }
    case 'sonar.channel-down': {
      const chanMap: Record<string, string> = {
        game: 'game', chat: 'chatRender', media: 'media', aux: 'aux', mic: 'chatCapture',
      }
      const ch = chanMap[String(value)] as 'game' | 'chatRender' | 'media' | 'aux' | 'chatCapture'
      if (!ch) break
      const state = _sonarService?.getState()
      const vol = state?.classic?.devices[ch as keyof typeof state.classic.devices]?.classic?.volume ?? 0.5
      await _sonarService?.setVolume(ch as 'game', Math.max(0, vol - 0.05))
      break
    }
    case 'sonar.master-up': {
      const state = _sonarService?.getState()
      const vol = state?.classic?.masters?.classic?.volume ?? 0.5
      await _sonarService?.setVolume('master' as 'game', Math.min(1, vol + (Number(value) || 5) / 100))
      break
    }
    case 'sonar.master-down': {
      const state = _sonarService?.getState()
      const vol = state?.classic?.masters?.classic?.volume ?? 0.5
      await _sonarService?.setVolume('master' as 'game', Math.max(0, vol - (Number(value) || 5) / 100))
      break
    }

    // ── Displays ──────────────────────────────────────────────────────────────
    case 'disp.brightness-up': {
      const all = _ddcService?.getCachedMonitors() ?? []
      const { target, num: step } = parseTargetNumber(value, 10)
      const targets = resolveTarget(target, all)
      const map = new Map<number, number>()
      for (const m of targets) {
        const newVal = Math.min(100, m.brightness + step)
        _ddcService?.setBrightness(m.monitor_id, newVal)
        map.set(m.monitor_id, newVal)
      }
      notifyBrightness(targets, map)
      break
    }
    case 'disp.brightness-down': {
      const all = _ddcService?.getCachedMonitors() ?? []
      const { target, num: step } = parseTargetNumber(value, 10)
      const targets = resolveTarget(target, all)
      const map = new Map<number, number>()
      for (const m of targets) {
        const newVal = Math.max(0, m.brightness - step)
        _ddcService?.setBrightness(m.monitor_id, newVal)
        map.set(m.monitor_id, newVal)
      }
      notifyBrightness(targets, map)
      break
    }
    case 'disp.brightness-set': {
      const all = _ddcService?.getCachedMonitors() ?? []
      const { target, num: level } = parseTargetNumber(value, 80)
      const targets = resolveTarget(target, all)
      const map = new Map<number, number>()
      for (const m of targets) {
        _ddcService?.setBrightness(m.monitor_id, level)
        map.set(m.monitor_id, level)
      }
      notifyBrightness(targets, map)
      break
    }
    case 'disp.activate': {
      const idx = Number(value) || 1
      const monitors = _ddcService?.getCachedMonitors() ?? []
      const m = monitors.find((mon) => mon.monitor_id === idx)
      if (m && !m.is_primary) {
        // setPrimaryMonitor requires multiMonitorToolPath — send a navigate event instead for now
        _mainWindow?.webContents.send(IPC_CHANNELS.NAVIGATE, 'home')
      }
      break
    }
    case 'disp.input-source': {
      const [monitorIdStr, inputHex] = String(value).split(':')
      const monitorId = Number(monitorIdStr)
      if (!monitorId || !inputHex) break
      _ddcService?.setInputSource(monitorId, inputHex)
      break
    }
    case 'disp.cycle':
      await _ddcService?.refreshMonitors()
      break
    case 'disp.night-shift':
      // Night shift is not a supported Windows DDC feature; no-op
      break
    case 'disp.refresh':
      await _ddcService?.refreshMonitors()
      break

    // ── App ───────────────────────────────────────────────────────────────────
    case 'app.toggle':
      if (_mainWindow?.isVisible()) {
        _mainWindow.hide()
      } else {
        _showMainWindow ? _showMainWindow() : _mainWindow?.show()
      }
      break
    case 'app.lock':
      exec('rundll32.exe user32.dll,LockWorkStation')
      break
    case 'app.quit':
      // Use app.quit() from caller side to avoid circular import
      _mainWindow?.webContents.send('app:quit-request')
      break
    case 'app.reload-service': {
      const svcId = String(value)
      if (svcId === 'all') {
        _serviceManager?.stopAll()
        setTimeout(() => _serviceManager?.startAll(), 500)
      } else {
        _serviceManager?.setEnabled(svcId, false)
        setTimeout(() => _serviceManager?.setEnabled(svcId, true), 500)
      }
      break
    }
    case 'app.go-to-page':
      _showMainWindow ? _showMainWindow() : _mainWindow?.show()
      _mainWindow?.webContents.send(IPC_CHANNELS.NAVIGATE, String(value))
      break

    default:
      console.warn('[shortcuts] unknown actionId:', actionId)
  }
}
