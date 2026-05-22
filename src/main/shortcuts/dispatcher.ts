import { exec } from 'child_process'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { ServiceManager } from '../services/serviceManager'
import type { SonarService } from '../services/sonarService'
import type { DdcService } from '../services/apis/ddc/service'
import { getForegroundWindow, restoreForegroundWindow } from '../win32Focus'

let _mainWindow: BrowserWindow | null = null
let _prevForegroundHwnd = 0
let _serviceManager: ServiceManager | null = null
let _sonarService: SonarService | null = null
let _ddcService: DdcService | null = null
let _showMainWindow: (() => void) | null = null

export function initDispatcher(
  mainWindow: BrowserWindow,
  serviceManager: ServiceManager,
  sonarService: SonarService,
  ddcService: DdcService,
  showMainWindow: () => void,
): void {
  _mainWindow = mainWindow
  _serviceManager = serviceManager
  _sonarService = sonarService
  _ddcService = ddcService
  _showMainWindow = showMainWindow
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
      const monitors = _ddcService?.getCachedMonitors() ?? []
      const step = Number(value) || 10
      for (const m of monitors) {
        _ddcService?.setBrightness(m.monitor_id, Math.min(100, m.brightness + step))
      }
      break
    }
    case 'disp.brightness-down': {
      const monitors = _ddcService?.getCachedMonitors() ?? []
      const step = Number(value) || 10
      for (const m of monitors) {
        _ddcService?.setBrightness(m.monitor_id, Math.max(0, m.brightness - step))
      }
      break
    }
    case 'disp.brightness-set': {
      const monitors = _ddcService?.getCachedMonitors() ?? []
      const level = Number(value) ?? 80
      for (const m of monitors) {
        _ddcService?.setBrightness(m.monitor_id, level)
      }
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
        restoreForegroundWindow(_prevForegroundHwnd)
        _mainWindow.hide()
      } else {
        // Capture the currently focused external window before stealing focus
        getForegroundWindow().then((hwnd) => { _prevForegroundHwnd = hwnd })
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
