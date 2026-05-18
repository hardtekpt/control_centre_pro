import { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, screen } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../shared/types'
import type { NavigateTarget, SonarChannel, SonarMode, SonarDeviceChannel, PresetSwitcherRule, OpenApp, AppSettings, DdcMonitor, SerializedNotification } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'
import { ServiceManager } from './services/serviceManager'
import { SonarService } from './services/sonarService'
import { ActiveWindowMonitor } from './services/activeWindowMonitor'
import { DdcService } from './services/apis/ddc/service'

let mainWindow: BrowserWindow | null = null
let notifWindow: BrowserWindow | null = null
let tray: Tray | null = null
let minimizeToTray = true
let isQuitting = false
let serviceManager: ServiceManager
let sonarService: SonarService
let ddcService: DdcService
let activeWindowMonitor: ActiveWindowMonitor | null = null

// Resolve MultiMonitorTool.exe path for primary display switching
const multiMonitorToolPath = app.isPackaged
  ? join(process.resourcesPath, 'MultiMonitorTool.exe')
  : join(__dirname, '../../resources/MultiMonitorTool.exe')

// ─── Notifications Service State ──────────────────────────────────────────────
let notificationsEnabled = true

// ─── DDC Service State ────────────────────────────────────────────────────────
let ddcCache: DdcMonitor[] = []
let ddcCacheTs = 0
let ddcInFlight = false
let ddcPollTimer: NodeJS.Timeout | null = null
let ddcPollIntervalSec = 60
interface DDCBrightnessJob {
  monitorId: number
  value: number
}
const ddcQueue = new Map<number, DDCBrightnessJob>() // monitorId → latest job
let ddcQueueRunning = false

// ─── App Menu ─────────────────────────────────────────────────────────────────

/**
 * Builds the native application menu shown when the hamburger icon is clicked.
 * Uses menu.popup() so it appears as a floating dropdown rather than an OS menu bar.
 */
function buildAppMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+N',
          click: () => { /* placeholder — wire to session creation */ },
        },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => navigate('settings'),
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow?.close(),
        },
        {
          label: 'Exit',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Mission Control',
          click: () => navigate('settings:about'),
        },
      ],
    },
  ])
}

/** Push a navigation event to the renderer (used by menu click handlers) */
function navigate(target: NavigateTarget): void {
  mainWindow?.webContents.send(IPC_CHANNELS.NAVIGATE, target)
}

function createTray(): void {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(__dirname, '../../resources/tray-icon.png')

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Control Centre Pro')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

/** Try to open the SteelSeries GG application */
async function openSteelSeriesGG(): Promise<void> {
  const commonPaths = [
    join(process.env['ProgramFiles'] || '', 'SteelSeries', 'GG', 'SteelSeriesGGClient.exe'),
    join(process.env['ProgramFiles'] || '', 'SteelSeries', 'GG', 'SteelSeriesGG.exe'),
    join(process.env['ProgramFiles(x86)'] || '', 'SteelSeries', 'GG', 'SteelSeriesGG.exe'),
  ]

  for (const path of commonPaths) {
    if (existsSync(path)) {
      try {
        await shell.openPath(path)
        return
      } catch (err) {
        console.error('Failed to open SteelSeries GG from', path, err)
      }
    }
  }

  // Fallback: try URI scheme
  try {
    await shell.openExternal('steelseriesgg://')
  } catch (err) {
    console.error('Failed to open SteelSeries GG via URI scheme:', err)
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

/**
 * Creates the frameless main window.
 * frame:false lets us draw our own title bar in React.
 * backgroundColor matches --color-bg dark mode to prevent white flash on load.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: '#141413',
    icon: join(__dirname, '../../resources/mission-control-terracotta-1024.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (e) => {
    if (minimizeToTray && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  if (is.dev) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Notify the renderer when the window maximize state changes so the
  // title bar can swap the maximize ↔ restore icon
  mainWindow.on('maximize', () =>
    mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGE, true)
  )
  mainWindow.on('unmaximize', () =>
    mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGE, false)
  )

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Notification Overlay Window ─────────────────────────────────────────────

/**
 * Creates the transparent, always-on-top overlay window used for hardware notifications.
 * The window is hidden at creation and shown only when a notification is pushed.
 * It lives independently of the main window — notifications keep working when the app
 * is minimised to the tray.
 */
function createNotifWindow(): void {
  const { workArea } = screen.getPrimaryDisplay()
  const width = 480
  const height = 300

  notifWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + workArea.height - height),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  notifWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    notifWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?overlay=1`)
  } else {
    notifWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { overlay: '1' } })
  }
}

// ─── DDC Helper Functions ─────────────────────────────────────────────────────

async function refreshDdcMonitors(): Promise<DdcMonitor[]> {
  if (ddcInFlight) return ddcCache

  ddcInFlight = true
  try {
    const monitors = await ddcService.refreshMonitors()
    ddcCache = monitors
    ddcCacheTs = Date.now()
    return monitors
  } finally {
    ddcInFlight = false
  }
}

function broadcastDdcMonitors(): void {
  mainWindow?.webContents.send(IPC_CHANNELS.DDC_UPDATE, ddcCache)
}

function flushDdcQueue(): void {
  if (ddcQueueRunning || ddcQueue.size === 0) return

  const entry = ddcQueue.entries().next().value as [number, DDCBrightnessJob] | undefined
  if (!entry) return

  const [monitorId, job] = entry
  ddcQueue.delete(monitorId)
  ddcQueueRunning = true

  setImmediate(() => {
    try {
      ddcService.setBrightness(job.monitorId, job.value)
    } catch (err) {
      console.error('[DDC] Failed to set brightness:', err)
    }
    ddcQueueRunning = false
    if (ddcQueue.size > 0) {
      flushDdcQueue()
    }
  })
}

function startDdcPolling(intervalMs?: number): void {
  stopDdcPolling()
  const ms = intervalMs ?? (ddcPollIntervalSec * 1000)
  ddcPollTimer = setInterval(() => {
    refreshDdcMonitors().catch(console.error)
  }, ms)
}

function stopDdcPolling(): void {
  if (ddcPollTimer) {
    clearInterval(ddcPollTimer)
    ddcPollTimer = null
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ── Persistent app settings ────────────────────────────────────────────────
  const settingsFilePath = join(app.getPath('userData'), 'settings.json')

  function loadAppSettings(): AppSettings {
    try {
      if (existsSync(settingsFilePath)) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsFilePath, 'utf-8')) }
      }
    } catch {}
    return { ...DEFAULT_SETTINGS }
  }

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => loadAppSettings())

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, settings: AppSettings) => {
    writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8')
    if (typeof settings.minimizeToTray === 'boolean') {
      minimizeToTray = settings.minimizeToTray
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => mainWindow?.minimize())

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    mainWindow?.isMaximized() ? mainWindow.restore() : mainWindow?.maximize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => mainWindow?.close())

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () =>
    mainWindow?.isMaximized() ?? false
  )

  /**
   * Popup the native app menu at the position of the clicked button.
   * x, y are screen-space coordinates sent from the renderer.
   */
  ipcMain.handle(IPC_CHANNELS.MENU_SHOW, (_, x: number, y: number) => {
    const menu = buildAppMenu()
    menu.popup({ window: mainWindow!, x, y })
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_LIST, () => serviceManager.getServiceList())

  ipcMain.handle(IPC_CHANNELS.SERVICES_SET_ENABLED, (_, id: string, enabled: boolean) => {
    serviceManager.setEnabled(id, enabled)
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_GET_CONFIG, () => serviceManager.getServiceConfig())

  ipcMain.handle(IPC_CHANNELS.SERVICES_SET_PYTHON_PATH, (_, path: string) => {
    serviceManager.setPythonPath(path)
  })

  ipcMain.handle(IPC_CHANNELS.ARCTIS_GET_STATE, () => serviceManager.getArctisState())

  ipcMain.handle(IPC_CHANNELS.ARCTIS_CMD, (_, cmd: string, value: unknown) => {
    serviceManager.sendArctisCmd(cmd, value)
  })

  ipcMain.handle(IPC_CHANNELS.SONAR_GET_STATE, () => sonarService.getState())

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_VOLUME, (_, channel: SonarChannel, value: number) =>
    sonarService.setVolume(channel, value)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_MUTE, (_, channel: SonarChannel, muted: boolean) =>
    sonarService.setMute(channel, muted)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_SELECT_PRESET, (_, id: string) => {
    activeWindowMonitor?.notifyManualPresetChange(id)
    return sonarService.selectPreset(id)
  })

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_MODE, (_, mode: SonarMode) =>
    sonarService.setMode(mode)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_GET_POLLING_CONFIG, () =>
    sonarService.getPollingConfig()
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_POLLING_CONFIG, (_, config) => {
    sonarService.setPollingConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_REDIRECTION, (_, channel: SonarDeviceChannel, deviceId: string) =>
    sonarService.setRedirection(channel, deviceId)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_ROUTE_PROCESS, (_, processId: number, targetChannel: string) =>
    sonarService.routeProcess(processId, targetChannel)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_REFRESH_DEVICES, () =>
    sonarService.refreshDevices()
  )

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, (_, url: string) =>
    shell.openExternal(url)
  )

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_STEELSERIES_GG, () =>
    openSteelSeriesGG()
  )

  ipcMain.handle(IPC_CHANNELS.ACTIVE_WINDOW_GET_OPEN_APPS, async () => {
    try {
      const script = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -Unique Name, MainWindowTitle | ConvertTo-Json`
      const { execSync } = await import('child_process')
      const result = execSync(`powershell -NoProfile -Command "${script}"`, {
        encoding: 'utf-8',
      })
      const procs = JSON.parse(result) as Array<{ Name: string; MainWindowTitle: string }>
      return (Array.isArray(procs) ? procs : [procs])
        .map((p) => ({
          processName: p.Name,
          displayName: p.Name,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
    } catch (err) {
      console.error('[getOpenApps] error:', err)
      return [] as OpenApp[]
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_GET_RULES, () => {
    try {
      const rulesPath = join(app.getPath('userData'), 'preset-switcher.json')
      if (!existsSync(rulesPath)) return []
      const content = readFileSync(rulesPath, 'utf-8')
      const data = JSON.parse(content)
      return (Array.isArray(data) ? data : data.rules || []) as PresetSwitcherRule[]
    } catch (err) {
      console.error('[getRules] error:', err)
      return [] as PresetSwitcherRule[]
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_SET_RULES, (_, rules: PresetSwitcherRule[]) => {
    try {
      const rulesPath = join(app.getPath('userData'), 'preset-switcher.json')
      let data: Record<string, unknown> = {}
      if (existsSync(rulesPath)) {
        const content = readFileSync(rulesPath, 'utf-8')
        const parsed = JSON.parse(content)
        // Handle both old format (array) and new format (object)
        if (Array.isArray(parsed)) {
          data = { enabled: true }  // Old array format, preserve default enabled state
        } else {
          data = parsed as Record<string, unknown>
        }
      }
      data.rules = rules
      writeFileSync(rulesPath, JSON.stringify(data, null, 2), 'utf-8')
      activeWindowMonitor?.setRules(rules)
    } catch (err) {
      console.error('[setRules] error:', err)
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_GET_ENABLED, () => {
    try {
      const rulesPath = join(app.getPath('userData'), 'preset-switcher.json')
      if (!existsSync(rulesPath)) return true
      const content = readFileSync(rulesPath, 'utf-8')
      const parsed = JSON.parse(content)

      // Handle both old format (array) and new format (object with rules)
      if (Array.isArray(parsed)) {
        return true  // Old format defaults to enabled
      }
      return (parsed as Record<string, unknown>).enabled !== false
    } catch (err) {
      console.error('[getEnabled] error:', err)
      return true
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_SET_ENABLED, (_, enabled: boolean) => {
    try {
      const rulesPath = join(app.getPath('userData'), 'preset-switcher.json')
      const content = existsSync(rulesPath) ? readFileSync(rulesPath, 'utf-8') : '{}'
      const parsed = JSON.parse(content)

      // Handle both old format (array) and new format (object with rules)
      let data: Record<string, unknown>
      if (Array.isArray(parsed)) {
        data = { rules: parsed, enabled }
      } else {
        data = parsed as Record<string, unknown>
        data.enabled = enabled
      }

      writeFileSync(rulesPath, JSON.stringify(data, null, 2), 'utf-8')
      activeWindowMonitor?.setEnabled(enabled)
      mainWindow?.webContents.send(IPC_CHANNELS.PRESET_SWITCHER_ENABLED_CHANGE, enabled)
    } catch (err) {
      console.error('[setEnabled] error:', err)
      throw err
    }
  })

  // ── DDC Display Control ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DDC_GET_MONITORS, async () => {
    const monitors = await refreshDdcMonitors()
    return monitors
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_BRIGHTNESS, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return

    ddcQueue.set(monitorId, {
      monitorId,
      value: Math.max(0, Math.min(100, Math.round(value))),
    })

    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_INPUT_SOURCE, (_, monitorId: number, inputValue: string) => {
    ddcService.setInputSource(monitorId, inputValue)
    // Don't refresh — let the next periodic poll update the UI to avoid flicker
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_PRIMARY_MONITOR, async (_, monitorId: number) => {
    await ddcService.setPrimaryMonitor(monitorId, multiMonitorToolPath)
    await refreshDdcMonitors()
    broadcastDdcMonitors()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_GET_POLL_INTERVAL, () => ddcPollIntervalSec)

  ipcMain.handle(IPC_CHANNELS.DDC_SET_POLL_INTERVAL, (_, seconds: number) => {
    const clamped = Math.max(10, Math.min(3600, Math.round(seconds)))
    ddcPollIntervalSec = clamped
    startDdcPolling()
    const settings = loadAppSettings()
    settings.ddcPollIntervalSeconds = clamped
    writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8')
  })

  // ── Notification overlay ───────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.NOTIF_PUSH, (_, spec: SerializedNotification) => {
    if (!notificationsEnabled) return
    if (!notifWindow || notifWindow.isDestroyed()) return
    if (!notifWindow.isVisible()) notifWindow.show()
    notifWindow.webContents.send(IPC_CHANNELS.NOTIF_RECEIVE, spec)
  })

  ipcMain.handle(IPC_CHANNELS.NOTIF_SET_IGNORE_MOUSE, (_, ignore: boolean) => {
    if (!notifWindow || notifWindow.isDestroyed()) return
    notifWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.handle(IPC_CHANNELS.NOTIF_ALL_DISMISSED, () => {
    if (!notifWindow || notifWindow.isDestroyed()) return
    notifWindow.hide()
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.controlcentrepro.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  serviceManager = new ServiceManager()
  sonarService = new SonarService()
  ddcService = new DdcService()

  // Wire SonarService into the service infrastructure so it appears in the
  // service list and About terminal alongside the Python services
  sonarService.setLogEmitter((level, msg) => {
    serviceManager.emitNativeLog('gg-sonar', 'GG Sonar', level, msg)
  })
  sonarService.setStateChangeNotifier(() => {
    serviceManager.broadcastServiceState()
  })
  serviceManager.registerNativeService({
    id: 'gg-sonar',
    name: 'GG Sonar',
    description: 'SteelSeries GG Sonar audio mixer integration (HTTP REST)',
    onEnable: () => sonarService.start(),
    onDisable: () => sonarService.stop(),
    isRunning: () => sonarService.isAvailable(),
  })

  // Wire DDCService into the service infrastructure so it appears in the
  // service list and About terminal alongside the Python services
  ddcService.setLogEmitter((level, msg) => {
    serviceManager.emitNativeLog('ddc', 'DDC Display', level, msg)
  })
  ddcService.setStateChangedCallback((monitors) => {
    ddcCache = monitors
    mainWindow?.webContents.send(IPC_CHANNELS.DDC_UPDATE, monitors)
  })
  serviceManager.registerNativeService({
    id: 'ddc',
    name: 'DDC Display Control',
    description: 'DDC/CI brightness control for connected monitors (Windows only)',
    onEnable: () => {
      ddcService.start()
      startDdcPolling()
      ddcService.refreshMonitors().catch(console.error)
    },
    onDisable: () => {
      ddcService.stop()
      stopDdcPolling()
    },
    isRunning: () => ddcService.isAvailable(),
  })

  // Register notifications service (tracks global notification enable/disable state)
  serviceManager.registerNativeService({
    id: 'notifications',
    name: 'Device Notifications',
    description: 'System notifications for headset and device events',
    onEnable: () => {
      notificationsEnabled = true
      serviceManager.broadcastServiceState()
    },
    onDisable: () => {
      notificationsEnabled = false
      serviceManager.broadcastServiceState()
    },
    isRunning: () => notificationsEnabled,
  })
  // Sync with persisted state (loaded during ServiceManager construction)
  const notifSvc = serviceManager.getServiceList().find((s) => s.id === 'notifications')
  if (notifSvc) {
    notificationsEnabled = notifSvc.enabled
  }

  registerIpcHandlers()
  createWindow()
  serviceManager.setWindow(mainWindow!)
  sonarService.setWindow(mainWindow!)

  // Initialize preset switcher monitor
  activeWindowMonitor = new ActiveWindowMonitor(mainWindow!, sonarService)
  try {
    const rulesPath = join(app.getPath('userData'), 'preset-switcher.json')
    if (existsSync(rulesPath)) {
      const content = readFileSync(rulesPath, 'utf-8')
      const data = JSON.parse(content)
      const rules = (Array.isArray(data) ? data : data.rules || []) as PresetSwitcherRule[]
      activeWindowMonitor.setRules(rules)
      activeWindowMonitor.setEnabled(data.enabled !== false)
    }
  } catch (err) {
    console.error('[app init] failed to load preset switcher rules:', err)
  }
  activeWindowMonitor.start()

  // Restore persisted settings before starting services
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    if (existsSync(settingsPath)) {
      const saved = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Partial<AppSettings>
      if (typeof saved.ddcPollIntervalSeconds === 'number') {
        ddcPollIntervalSec = Math.max(10, Math.min(3600, saved.ddcPollIntervalSeconds))
      }
      if (typeof saved.minimizeToTray === 'boolean') {
        minimizeToTray = saved.minimizeToTray
      }
    }
  } catch { /* use default */ }

  createTray()
  createNotifWindow()

  serviceManager.startAll()  // starts Python services + GG Sonar native service

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  tray?.destroy()
  tray = null
  notifWindow?.destroy()
  notifWindow = null
  activeWindowMonitor?.stop()
  serviceManager?.stopAll()
})
