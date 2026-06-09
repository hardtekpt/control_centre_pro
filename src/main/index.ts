import { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, screen } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../shared/types'
import type { NavigateTarget, SonarChannel, SonarMode, SonarDeviceChannel, PresetSwitcherRule, AppSettings, DdcMonitor, SerializedNotification, Shortcut } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'
import { ServiceManager } from './services/serviceManager'
import { SonarService } from './services/sonarService'
import { DiscordService } from './services/discordService'
import { ActiveWindowMonitor } from './services/activeWindowMonitor'
import { DdcService } from './services/apis/ddc/service'
import { KvmDetector } from './services/kvmDetector'
import { HomeAssistantService } from './services/homeAssistantService'
import { initDispatcher, dispatch } from './shortcuts/dispatcher'
import { registerGlobalShortcuts, unregisterAllShortcuts } from './shortcuts/shortcutRegistry'
import { HttpApiServer } from './httpApiServer'
import { readRules, writeRules, readEnabled, writeEnabled, getOpenApps } from './services/presetSwitcherStore'
import { systemControl } from './services/systemControl'

/** Assemble the dependency bundle the remote HTTP server needs. Shared by the
 *  boot path and the settings-toggle path so the two stay in sync. */
function buildServerDeps(): ConstructorParameters<typeof HttpApiServer>[0] {
  return {
    serviceManager,
    sonarService,
    ddcService,
    discordService,
    haService,
    getHaCardConfig: () => {
      const s = loadAppSettings()
      return { cardEntities: s.haHomeCardEntities ?? [], cardEnabled: s.haHomeCardEnabled ?? false }
    },
    getPresetSwitcherRules: readRules,
    setPresetSwitcherRules: (rules) => {
      writeRules(rules)
      activeWindowMonitor?.setRules(rules)
    },
    getPresetSwitcherEnabled: readEnabled,
    setPresetSwitcherEnabled: (enabled) => {
      writeEnabled(enabled)
      activeWindowMonitor?.setEnabled(enabled)
      mainWindow?.webContents.send(IPC_CHANNELS.PRESET_SWITCHER_ENABLED_CHANGE, enabled)
      httpApiServer?.broadcast('presetSwitcher:enabledChange', enabled)
    },
    getOpenApps,
    getActiveProcessName: () => activeWindowMonitor?.getCurrentProcessName() ?? '',
    systemControl,
    getThemeSettings: () => {
      const s = loadAppSettings()
      return { theme: s.theme ?? '', accentColor: s.accentColor ?? '', highlightColor: s.highlightColor ?? '' }
    },
  }
}

const settingsFilePath = join(app.getPath('userData'), 'settings.json')
function loadAppSettings(): AppSettings {
  try {
    if (existsSync(settingsFilePath)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsFilePath, 'utf-8')) }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

function persistAppSettings(settings: AppSettings): void {
  writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8')
}

/** Generate a fresh URL-safe auth token. */
function generateRemoteToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Rotate the remote auth token using the configured duration.
 *  Persists to settings.json and returns the updated settings. */
function rotateRemoteToken(settings: AppSettings): AppSettings {
  const next: AppSettings = {
    ...settings,
    remoteAuthToken: generateRemoteToken(),
    remoteTokenExpiresAt: settings.remoteTokenDurationMs > 0
      ? Date.now() + settings.remoteTokenDurationMs
      : 0,
  }
  persistAppSettings(next)
  return next
}

/** Ensure the settings have a usable token before starting the server.
 *  If missing or expired (when a duration is set), rotates it. */
function ensureValidRemoteToken(settings: AppSettings): AppSettings {
  const now = Date.now()
  const expired = settings.remoteTokenExpiresAt > 0 && settings.remoteTokenExpiresAt <= now
  if (!settings.remoteAuthToken || expired) {
    return rotateRemoteToken(settings)
  }
  return settings
}

/** Build the QR-code URL: `http://<ip>:<port>/?token=<token>`. */
function buildRemoteQrUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/?token=${encodeURIComponent(token)}`
}

let httpApiServer: HttpApiServer | null = null
let mainWindow: BrowserWindow | null = null
let notifWindow: BrowserWindow | null = null
let tray: Tray | null = null
let minimizeToTray = true
let openOnActiveDisplay = false
let isQuitting = false
let serviceManager: ServiceManager
let sonarService: SonarService
let discordService: DiscordService
let ddcService: DdcService
let kvmDetector: KvmDetector
let haService: HomeAssistantService
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
type DDCJob =
  | { feature: 'brightness'; monitorId: number; value: number }
  | { feature: 'contrast'; monitorId: number; value: number }
  | { feature: 'redGain'; monitorId: number; value: number }
  | { feature: 'greenGain'; monitorId: number; value: number }
  | { feature: 'blueGain'; monitorId: number; value: number }
  | { feature: 'sharpness'; monitorId: number; value: number }
  | { feature: 'volume'; monitorId: number; value: number }
// Keyed by `${monitorId}:${feature}` — one slot per monitor+feature, coalesces rapid drags
const ddcQueue = new Map<string, DDCJob>()
let ddcQueueRunning = false

// ─── App Menu ─────────────────────────────────────────────────────────────────

/**
 * Builds the native application menu shown when the hamburger icon is clicked.
 * Uses menu.popup() so it appears as a floating dropdown rather than an OS menu bar.
 */
function buildAppMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Home',
      click: () => navigate('home'),
    },
    {
      label: 'Arctis',
      click: () => navigate('arctis'),
    },
    {
      label: 'GG Sonar',
      click: () => navigate('gg-sonar'),
    },
    {
      label: 'Shortcuts',
      click: () => navigate('shortcuts'),
    },
    {
      label: 'Notifications',
      click: () => navigate('notifications'),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'General',
          click: () => navigate('settings:general'),
        },
        {
          label: 'GG Sonar',
          click: () => navigate('settings:gg-sonar'),
        },
        {
          label: 'DDC',
          click: () => navigate('settings:ddc'),
        },
        {
          label: 'Notifications',
          click: () => navigate('settings:notifications'),
        },
        {
          label: 'Plugins',
          click: () => navigate('settings:plugins'),
        },
        {
          label: 'About',
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

function showMainWindow(): void {
  if (!mainWindow) return
  applyWindowIcon()
  if (openOnActiveDisplay) {
    // Reposition before the window becomes visible to avoid a flash on the
    // previous display. setPosition on a hidden window is ignored by Windows'
    // SW_SHOWNORMAL (it restores rcNormalPosition), so we: hide with opacity=0,
    // show (invisible), move to target display, restore opacity.
    const { bounds } = getTargetDisplay()
    const [w, h] = mainWindow.getSize()
    const x = Math.round(bounds.x + (bounds.width - w) / 2)
    const y = Math.round(bounds.y + (bounds.height - h) / 2)
    mainWindow.setOpacity(0)
    mainWindow.show()
    mainWindow.setPosition(x, y)
    mainWindow.setOpacity(1)
  } else {
    mainWindow.show()
  }
  mainWindow.focus()
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
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => showMainWindow())
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
 * Get the path to the main app icon.
 */
function getIconPath(): string {
  return join(__dirname, '../../resources/mission-control-terracotta-1024.png')
}

/**
 * Apply the app icon to the window (called on creation and when shown to ensure persistence).
 */
function applyWindowIcon(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const iconPath = getIconPath()
  try {
    mainWindow.setIcon(nativeImage.createFromPath(iconPath))
  } catch (err) {
    console.error('[Window] Failed to apply icon:', err)
  }
}

function getTargetDisplay() {
  if (openOnActiveDisplay) {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  }
  return screen.getPrimaryDisplay()
}

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
    icon: nativeImage.createFromPath(getIconPath()),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    showMainWindow()
  })

  mainWindow.on('close', (e) => {
    if (minimizeToTray && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })



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
  const { workArea } = getTargetDisplay()
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

  // 'screen-saver' level places the window above fullscreen apps on Windows
  notifWindow.setAlwaysOnTop(true, 'screen-saver')
  notifWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    notifWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?overlay=1`)
  } else {
    notifWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { overlay: '1' } })
  }
}

function pushNotifFromMain(spec: SerializedNotification): void {
  if (!notificationsEnabled) return
  if (!notifWindow || notifWindow.isDestroyed()) return
  if (!notifWindow.isVisible()) {
    const { workArea } = getTargetDisplay()
    const [w, h] = notifWindow.getSize()
    notifWindow.setPosition(
      Math.round(workArea.x + (workArea.width - w) / 2),
      Math.round(workArea.y + workArea.height - h),
    )
    notifWindow.setAlwaysOnTop(true, 'screen-saver')
    notifWindow.show()
  }
  notifWindow.webContents.send(IPC_CHANNELS.NOTIF_RECEIVE, spec)
}

// ─── DDC Helper Functions ─────────────────────────────────────────────────────

async function refreshDdcMonitors(full = false): Promise<DdcMonitor[]> {
  if (ddcInFlight) return ddcCache

  ddcInFlight = true
  try {
    const monitors = await ddcService.refreshMonitors(full)
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

  const entry = ddcQueue.entries().next().value as [string, DDCJob] | undefined
  if (!entry) return

  const [key, job] = entry
  ddcQueue.delete(key)
  ddcQueueRunning = true

  setImmediate(() => {
    try {
      switch (job.feature) {
        case 'brightness': ddcService.setBrightness(job.monitorId, job.value); break
        case 'contrast':   ddcService.setContrast(job.monitorId, job.value); break
        case 'redGain':    ddcService.setRedGain(job.monitorId, job.value); break
        case 'greenGain':  ddcService.setGreenGain(job.monitorId, job.value); break
        case 'blueGain':   ddcService.setBlueGain(job.monitorId, job.value); break
        case 'sharpness':  ddcService.setSharpness(job.monitorId, job.value); break
        case 'volume':     ddcService.setVolume(job.monitorId, job.value); break
      }
    } catch (err) {
      console.error('[DDC] Queue flush failed:', err)
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
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => loadAppSettings())

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_, incoming: AppSettings) => {
    const prevSettings = loadAppSettings()

    // If the user changed the token duration, rotate the token now so the
    // freshly displayed QR matches the new lifetime. Also rotate when the
    // server is being newly enabled.
    let settings: AppSettings = incoming
    const durationChanged = prevSettings.remoteTokenDurationMs !== incoming.remoteTokenDurationMs
    const justEnabled = !prevSettings.remoteEnabled && incoming.remoteEnabled
    if (durationChanged || justEnabled) {
      settings = rotateRemoteToken(incoming)
    } else {
      // Make sure the file persists exactly what the renderer sent.
      persistAppSettings(incoming)
    }

    if (typeof settings.minimizeToTray === 'boolean') {
      minimizeToTray = settings.minimizeToTray
    }
    if (typeof settings.openOnActiveDisplay === 'boolean') {
      openOnActiveDisplay = settings.openOnActiveDisplay
    }
    if (typeof settings.discordClientId === 'string') {
      discordService.setClientId(settings.discordClientId)
    }
    if (typeof settings.discordClientSecret === 'string') {
      discordService.setClientSecret(settings.discordClientSecret)
    }
    kvmDetector.applySettings(settings)
    haService.applySettings(settings.haUrl ?? '', settings.haToken ?? '')
    if (settings.haEnabled === false) {
      haService.stop()
    }
    if (typeof settings.runAtStartup === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: settings.runAtStartup })
    }
    if (prevSettings.remoteEnabled !== settings.remoteEnabled || prevSettings.remotePort !== settings.remotePort) {
      httpApiServer?.stop()
      httpApiServer = null
      serviceManager.setWsBroadcast(null)
      ddcService.setWsBroadcast(null)
      activeWindowMonitor?.setWsBroadcast(null)
      if (settings.remoteEnabled) {
        const ready = ensureValidRemoteToken(settings)
        settings = ready
        httpApiServer = new HttpApiServer(buildServerDeps())
        httpApiServer.setAuthToken(ready.remoteAuthToken, ready.remoteTokenExpiresAt)
        httpApiServer.start(ready.remotePort ?? 8080)
        const broadcast = (type: string, payload: unknown): void => httpApiServer?.broadcast(type, payload)
        serviceManager.setWsBroadcast(broadcast)
        ddcService.setWsBroadcast(broadcast)
        activeWindowMonitor?.setWsBroadcast(broadcast)
      }
    } else if (httpApiServer && (durationChanged || prevSettings.remoteAuthToken !== settings.remoteAuthToken)) {
      // Server still running but token rotated — push the new token in-place.
      httpApiServer.setAuthToken(settings.remoteAuthToken, settings.remoteTokenExpiresAt)
    }

    return settings
  })

  ipcMain.handle(IPC_CHANNELS.KVM_GET_STATE, () => kvmDetector.getState())

  ipcMain.handle(IPC_CHANNELS.KVM_IDENTIFY_START, () => {
    kvmDetector.startIdentify((device) => {
      mainWindow?.webContents.send(IPC_CHANNELS.KVM_IDENTIFY_RESULT, device)
    }).catch(console.error)
  })

  ipcMain.handle(IPC_CHANNELS.KVM_IDENTIFY_CANCEL, () => {
    kvmDetector.cancelIdentify()
  })

  // ── Home Assistant ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.HA_GET_STATE, () => haService.getState())

  ipcMain.handle(IPC_CHANNELS.HA_CALL_SERVICE, (_, call) => haService.callService(call))

  ipcMain.handle(IPC_CHANNELS.HA_TEST_CONNECTION, (_, url: string, token: string) =>
    haService.testConnection(url, token)
  )

  // ── Remote Web Client ──────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.REMOTE_GET_INFO, () => {
    const settings = loadAppSettings()
    const baseUrl = httpApiServer?.getLanUrl() ?? null
    const now = Date.now()
    const expired = settings.remoteTokenExpiresAt > 0 && settings.remoteTokenExpiresAt <= now
    const tokenUsable = !!settings.remoteAuthToken && !expired
    return {
      enabled: !!httpApiServer,
      url: baseUrl,
      qrUrl: baseUrl && tokenUsable ? buildRemoteQrUrl(baseUrl, settings.remoteAuthToken) : null,
      token: settings.remoteAuthToken || null,
      expiresAt: settings.remoteTokenExpiresAt,
      expired,
    }
  })

  ipcMain.handle(IPC_CHANNELS.REMOTE_REGENERATE_TOKEN, () => {
    const rotated = rotateRemoteToken(loadAppSettings())
    if (httpApiServer) {
      httpApiServer.setAuthToken(rotated.remoteAuthToken, rotated.remoteTokenExpiresAt)
    }
    const baseUrl = httpApiServer?.getLanUrl() ?? null
    return {
      enabled: !!httpApiServer,
      url: baseUrl,
      qrUrl: baseUrl ? buildRemoteQrUrl(baseUrl, rotated.remoteAuthToken) : null,
      token: rotated.remoteAuthToken,
      expiresAt: rotated.remoteTokenExpiresAt,
      expired: false,
    }
  })

  // ── Resource Monitor ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.RESOURCE_GET_STATE, () => serviceManager?.getResourceSnapshot() ?? null)

  ipcMain.handle(IPC_CHANNELS.RESOURCE_SET_CONFIG, (_event, config: { interval?: number; metrics?: Record<string, boolean> }) => {
    if (config.interval !== undefined) serviceManager?.sendResourceCmd('set-interval', config.interval)
    if (config.metrics !== undefined) serviceManager?.sendResourceCmd('set-metrics', config.metrics)
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

  ipcMain.handle('SERVICES_GET_LOG_HISTORY', () => serviceManager.getCachedLogs())

  ipcMain.handle('SERVICES_GET_LOG_FILE_PATH', () => serviceManager.getLogFilePath())

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

  ipcMain.handle(IPC_CHANNELS.SONAR_UPSERT_CONFIG,    (_, config) => sonarService.upsertConfig(config))
  ipcMain.handle(IPC_CHANNELS.SONAR_DELETE_CONFIG,    (_, id) => sonarService.deleteConfig(id))
  ipcMain.handle(IPC_CHANNELS.SONAR_DUPLICATE_CONFIG, (_, sourceId) => sonarService.duplicateConfig(sourceId))
  ipcMain.handle(IPC_CHANNELS.SONAR_RESET_CONFIG,     (_, id) => sonarService.resetConfig(id))
  ipcMain.handle(IPC_CHANNELS.SONAR_TOGGLE_FAVORITE,  (_, id, isFavorite) => sonarService.toggleFavorite(id, isFavorite))
  ipcMain.handle(IPC_CHANNELS.SONAR_GET_AUDIO_SAMPLES, (_, role: string) => sonarService.getAudioSamples(role))
  ipcMain.handle(IPC_CHANNELS.SONAR_PLAY_AUDIO_SAMPLE, (_, role: string, id: string) => sonarService.playAudioSample(role, id))
  ipcMain.handle(IPC_CHANNELS.SONAR_MIC_IS_RECORDING,  () => sonarService.micIsRecording())
  ipcMain.handle(IPC_CHANNELS.SONAR_MIC_START_RECORD,  () => sonarService.micStartRecord())
  ipcMain.handle(IPC_CHANNELS.SONAR_MIC_STOP_RECORD,   () => sonarService.micStopRecord())
  ipcMain.handle(IPC_CHANNELS.SONAR_MIC_SET_PLAYBACK,  (_, isPlaying: boolean) => sonarService.micSetPlayback(isPlaying))

  // ── Discord RPC Voice Control ──────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DISCORD_GET_STATE, () => discordService.getState())

  ipcMain.handle(IPC_CHANNELS.DISCORD_SET_SELF_MUTE, (_, muted: boolean) =>
    discordService.setSelfMute(muted)
  )

  ipcMain.handle(IPC_CHANNELS.DISCORD_SET_SELF_DEAF, (_, deafened: boolean) =>
    discordService.setSelfDeaf(deafened)
  )

  ipcMain.handle(IPC_CHANNELS.DISCORD_SET_INPUT_VOLUME, (_, volume: number) =>
    discordService.setInputVolume(volume)
  )

  ipcMain.handle(IPC_CHANNELS.DISCORD_SET_OUTPUT_VOLUME, (_, volume: number) =>
    discordService.setOutputVolume(volume)
  )

  ipcMain.handle(IPC_CHANNELS.DISCORD_SET_LOCAL_VOLUME, (_, userId: string, volume: number) =>
    discordService.setLocalVolume(userId, volume)
  )

  ipcMain.handle(IPC_CHANNELS.DISCORD_SET_LOCAL_MUTE, (_, userId: string, muted: boolean) =>
    discordService.setLocalMute(userId, muted)
  )

  ipcMain.handle(IPC_CHANNELS.DISCORD_RECONNECT, () =>
    discordService.reconnect()
  )

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, (_, url: string) =>
    shell.openExternal(url)
  )

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_STEELSERIES_GG, () =>
    openSteelSeriesGG()
  )

  ipcMain.handle(IPC_CHANNELS.ACTIVE_WINDOW_GET_OPEN_APPS, () => getOpenApps())

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_GET_RULES, () => readRules())

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_SET_RULES, (_, rules: PresetSwitcherRule[]) => {
    try {
      writeRules(rules)
      activeWindowMonitor?.setRules(rules)
    } catch (err) {
      console.error('[setRules] error:', err)
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_GET_ENABLED, () => readEnabled())

  ipcMain.handle(IPC_CHANNELS.PRESET_SWITCHER_SET_ENABLED, (_, enabled: boolean) => {
    try {
      writeEnabled(enabled)
      activeWindowMonitor?.setEnabled(enabled)
      mainWindow?.webContents.send(IPC_CHANNELS.PRESET_SWITCHER_ENABLED_CHANGE, enabled)
      httpApiServer?.broadcast('presetSwitcher:enabledChange', enabled)
    } catch (err) {
      console.error('[setEnabled] error:', err)
      throw err
    }
  })

  // ── DDC Display Control ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DDC_GET_MONITORS, async () => {
    const monitors = await refreshDdcMonitors(true)
    return monitors
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_BRIGHTNESS, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:brightness`, { feature: 'brightness', monitorId, value: Math.max(0, Math.min(100, Math.round(value))) })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_CONTRAST, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:contrast`, { feature: 'contrast', monitorId, value: Math.max(0, Math.min(100, Math.round(value))) })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_COLOR_PRESET, (_, monitorId: number, preset: number) => {
    ddcService.setColorPreset(monitorId, preset)
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_RED_GAIN, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:redGain`, { feature: 'redGain', monitorId, value })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_GREEN_GAIN, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:greenGain`, { feature: 'greenGain', monitorId, value })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_BLUE_GAIN, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:blueGain`, { feature: 'blueGain', monitorId, value })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_SHARPNESS, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:sharpness`, { feature: 'sharpness', monitorId, value })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_VOLUME, (_, monitorId: number, value: number) => {
    if (!ddcCache.find((m) => m.monitor_id === monitorId)) return
    ddcQueue.set(`${monitorId}:volume`, { feature: 'volume', monitorId, value })
    flushDdcQueue()
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_MUTE, (_, monitorId: number, muted: boolean) => {
    ddcService.setMute(monitorId, muted)
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_POWER_MODE, (_, monitorId: number, mode: number) => {
    ddcService.setPowerMode(monitorId, mode)
  })

  ipcMain.handle(IPC_CHANNELS.DDC_FACTORY_RESET, (_, monitorId: number) => {
    ddcService.factoryReset(monitorId)
  })

  ipcMain.handle(IPC_CHANNELS.DDC_COLOR_RESET, (_, monitorId: number) => {
    ddcService.colorReset(monitorId)
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_INPUT_SOURCE, (_, monitorId: number, inputValue: string) => {
    ddcService.setInputSource(monitorId, inputValue)
    // Don't refresh — let the next periodic poll update the UI to avoid flicker
  })

  ipcMain.handle(IPC_CHANNELS.DDC_SET_PRIMARY_MONITOR, async (_, monitorId: number) => {
    await ddcService.setPrimaryMonitor(monitorId, multiMonitorToolPath)
    await refreshDdcMonitors(true)
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
    if (!notifWindow.isVisible()) {
      const { workArea } = getTargetDisplay()
      const [w, h] = notifWindow.getSize()
      notifWindow.setPosition(
        Math.round(workArea.x + (workArea.width - w) / 2),
        Math.round(workArea.y + workArea.height - h),
      )
      notifWindow.setAlwaysOnTop(true, 'screen-saver')
      notifWindow.show()
    }
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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const shortcutsFilePath = join(app.getPath('userData'), 'shortcuts.json')

  function loadShortcuts(): Shortcut[] {
    try {
      if (existsSync(shortcutsFilePath)) {
        const data = JSON.parse(readFileSync(shortcutsFilePath, 'utf-8'))
        return Array.isArray(data) ? data : []
      }
    } catch {}
    return []
  }

  function saveShortcuts(shortcuts: Shortcut[]): void {
    writeFileSync(shortcutsFilePath, JSON.stringify(shortcuts, null, 2), 'utf-8')
  }

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_GET, () => loadShortcuts())

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_SAVE, (_, shortcuts: Shortcut[]) => {
    saveShortcuts(shortcuts)
    registerGlobalShortcuts(shortcuts)
    serviceManager.emitNativeLog('shortcuts', 'Shortcuts', 'info',
      `Saved ${shortcuts.length} shortcut(s); ${shortcuts.filter(s => s.enabled && s.scope === 'global').length} global registered`)
  })

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_DISPATCH, (_, actionId: string, value?: string | number) => {
    void dispatch(actionId, value)
    // Forward to renderer for app-navigate actions (focused scope handled by renderer itself)
    mainWindow?.webContents.send(IPC_CHANNELS.SHORTCUTS_DISPATCH, { actionId, value })
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.controlcentrepro.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  serviceManager = new ServiceManager()
  sonarService = new SonarService(serviceManager)
  ddcService = new DdcService()
  kvmDetector = new KvmDetector(
    (state) => mainWindow?.webContents.send(IPC_CHANNELS.KVM_STATE_CHANGE, state),
    (actions) => { for (const a of actions) ddcService.setInputSource(a.monitorId, a.inputValue) },
  )

  // GG Sonar runs as the `gg-sonar` Python subprocess (resources/services/sonar_service.py,
  // wrapping the steelseries_gg package), managed by ServiceManager like the other
  // Python services. SonarService is a thin facade over it (see services/sonarService.ts).

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
      serviceManager.emitNativeLog('ddc', 'DDC Display', 'info', 'Service enabled')
      startDdcPolling()
      ddcService.refreshMonitors(true).then((monitors) => {
        if (monitors.length === 0) {
          serviceManager.emitNativeLog('ddc', 'DDC Display', 'info', 'No DDC-capable monitors detected')
        } else {
          serviceManager.emitNativeLog('ddc', 'DDC Display', 'info', `Found ${monitors.length} monitor(s): ${monitors.map(m => m.name).join(', ')}`)
        }
      }).catch((err) => {
        serviceManager.emitNativeLog('ddc', 'DDC Display', 'error', `Failed to enumerate monitors: ${String(err)}`)
      })
    },
    onDisable: () => {
      ddcService.stop()
      stopDdcPolling()
    },
    isRunning: () => ddcService.isAvailable(),
  })

  discordService = new DiscordService()
  discordService.setLogEmitter((level, msg) => {
    serviceManager.emitNativeLog('discord', 'Discord Voice', level, msg)
  })
  discordService.setStateChangeNotifier(() => {
    serviceManager.broadcastServiceState()
    httpApiServer?.broadcast('discord:stateChange', discordService.getState())
  })
  serviceManager.registerNativeService({
    id: 'discord',
    name: 'Discord Voice',
    description: 'Discord RPC voice control — mute, deafen, and per-participant volume',
    onEnable: () => {
      serviceManager.emitNativeLog('discord', 'Discord Voice', 'info', 'Service enabled, connecting to Discord RPC...')
      discordService.start()
    },
    onDisable: () => discordService.stop(),
    isRunning: () => discordService.isAvailable(),
  })

  haService = new HomeAssistantService()
  haService.setLogEmitter((level, msg) => {
    serviceManager.emitNativeLog('home-assistant', 'Home Assistant', level, msg)
  })
  haService.setStateChangeNotifier(() => {
    serviceManager.broadcastServiceState()
    httpApiServer?.broadcast('ha:stateChange', haService.getState())
  })
  serviceManager.registerNativeService({
    id: 'home-assistant',
    name: 'Home Assistant',
    description: 'Home Assistant WebSocket integration — entity state and service calls',
    onEnable: () => {
      serviceManager.emitNativeLog('home-assistant', 'Home Assistant', 'info', 'Connecting…')
      haService.start()
    },
    onDisable: () => haService.stop(),
    isRunning: () => haService.isAvailable(),
  })

  // Register keyboard shortcuts service (tracks enable/disable + logs)
  let shortcutsServiceEnabled = true
  serviceManager.registerNativeService({
    id: 'shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Global and app-focused keyboard shortcut bindings',
    onEnable: () => {
      shortcutsServiceEnabled = true
      try {
        const shortcutsPath = join(app.getPath('userData'), 'shortcuts.json')
        if (existsSync(shortcutsPath)) {
          const saved = JSON.parse(readFileSync(shortcutsPath, 'utf-8'))
          if (Array.isArray(saved)) {
            registerGlobalShortcuts(saved as Shortcut[])
            const globalCount = (saved as Shortcut[]).filter(s => s.enabled && s.scope === 'global').length
            serviceManager.emitNativeLog('shortcuts', 'Keyboard Shortcuts', 'info', `Service enabled with ${globalCount} global shortcut(s)`)
          }
        } else {
          serviceManager.emitNativeLog('shortcuts', 'Keyboard Shortcuts', 'info', 'Service enabled, no shortcuts configured')
        }
      } catch {}
      serviceManager.broadcastServiceState()
    },
    onDisable: () => {
      shortcutsServiceEnabled = false
      unregisterAllShortcuts()
      serviceManager.broadcastServiceState()
    },
    isRunning: () => shortcutsServiceEnabled,
  })

  // Register notifications service (tracks global notification enable/disable state)
  serviceManager.registerNativeService({
    id: 'notifications',
    name: 'Device Notifications',
    description: 'System notifications for headset and device events',
    onEnable: () => {
      notificationsEnabled = true
      serviceManager.emitNativeLog('notifications', 'Device Notifications', 'info', 'Service enabled')
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
  let bootSettings = loadAppSettings()
  if (bootSettings.remoteEnabled) {
    bootSettings = ensureValidRemoteToken(bootSettings)
    httpApiServer = new HttpApiServer(buildServerDeps())
    httpApiServer.setAuthToken(bootSettings.remoteAuthToken, bootSettings.remoteTokenExpiresAt)
    httpApiServer.start(bootSettings.remotePort ?? 8080)
    const broadcast = (type: string, payload: unknown): void => httpApiServer?.broadcast(type, payload)
    serviceManager.setWsBroadcast(broadcast)
    ddcService.setWsBroadcast(broadcast)
  }
  if (typeof bootSettings.minimizeToTray === 'boolean') minimizeToTray = bootSettings.minimizeToTray
  if (typeof bootSettings.openOnActiveDisplay === 'boolean') openOnActiveDisplay = bootSettings.openOnActiveDisplay
  createWindow()
  kvmDetector.start(bootSettings)
  serviceManager.setWindow(mainWindow!)
  initDispatcher(mainWindow!, serviceManager, sonarService, ddcService, showMainWindow, loadAppSettings, pushNotifFromMain)
  discordService.setWindow(mainWindow!)
  haService.setWindow(mainWindow!)

  // Initialize preset switcher monitor
  activeWindowMonitor = new ActiveWindowMonitor(mainWindow!, sonarService)
  activeWindowMonitor.setMonitorInputHandler((monitorId, inputValue) => {
    ddcService.setInputSource(monitorId, inputValue)
  })
  activeWindowMonitor.setRules(readRules())
  activeWindowMonitor.setEnabled(readEnabled())
  // If the remote server is already running (boot path), wire foreground-app
  // broadcasts now that the monitor exists.
  if (httpApiServer) {
    activeWindowMonitor.setWsBroadcast((type, payload) => httpApiServer?.broadcast(type, payload))
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
      if (typeof saved.discordClientId === 'string' && saved.discordClientId) {
        discordService.setClientId(saved.discordClientId)
      }
      if (typeof saved.discordClientSecret === 'string' && saved.discordClientSecret) {
        discordService.setClientSecret(saved.discordClientSecret)
      }
      if (typeof saved.haUrl === 'string' && saved.haUrl) {
        haService.applySettings(saved.haUrl, saved.haToken ?? '')
      }
    }
  } catch { /* use default */ }

  createTray()
  createNotifWindow()

  serviceManager.startAll()  // starts Python services + GG Sonar native service

  // Load persisted shortcuts and register global bindings
  try {
    const shortcutsPath = join(app.getPath('userData'), 'shortcuts.json')
    if (existsSync(shortcutsPath)) {
      const saved = JSON.parse(readFileSync(shortcutsPath, 'utf-8'))
      if (Array.isArray(saved)) registerGlobalShortcuts(saved as Shortcut[])
    }
  } catch (err) {
    console.error('[shortcuts] failed to load shortcuts on boot:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showMainWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  httpApiServer?.stop()
  httpApiServer = null
  unregisterAllShortcuts()
  tray?.destroy()
  tray = null
  notifWindow?.destroy()
  notifWindow = null
  activeWindowMonitor?.stop()
  serviceManager?.stopAll()
})
