import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../shared/types'
import type { NavigateTarget, SonarChannel, SonarMode } from '../shared/types'
import { ServiceManager } from './services/serviceManager'
import { SonarService } from './services/sonarService'

let mainWindow: BrowserWindow | null = null
let serviceManager: ServiceManager
let sonarService: SonarService

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

/** Try to open the SteelSeries GG application */
async function openSteelSeriesGG(): Promise<void> {
  const commonPaths = [
    join(process.env['ProgramFiles'] || '', 'SteelSeries', 'GG', 'SteelSeriesGG.exe'),
    join(process.env['ProgramFiles(x86)'] || '', 'SteelSeries', 'GG', 'SteelSeriesGG.exe'),
  ]

  for (const path of commonPaths) {
    if (existsSync(path)) {
      try {
        spawn(path, [], { detached: true, stdio: 'ignore' })
        return
      } catch (err) {
        console.error('Failed to spawn SteelSeries GG from', path, err)
      }
    }
  }

  // Fallback: try URI scheme
  try {
    await shell.openExternal('steelseries-gg://')
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

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
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

  ipcMain.handle(IPC_CHANNELS.SONAR_SELECT_PRESET, (_, id: string) =>
    sonarService.selectPreset(id)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_MODE, (_, mode: SonarMode) =>
    sonarService.setMode(mode)
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_GET_POLLING_CONFIG, () =>
    sonarService.getPollingConfig()
  )

  ipcMain.handle(IPC_CHANNELS.SONAR_SET_POLLING_CONFIG, (_, config) => {
    sonarService.setPollingConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, (_, url: string) =>
    shell.openExternal(url)
  )

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_STEELSERIES_GG, () =>
    openSteelSeriesGG()
  )
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.controlcentrepro.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  serviceManager = new ServiceManager()
  sonarService = new SonarService()

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

  registerIpcHandlers()
  createWindow()
  serviceManager.setWindow(mainWindow!)
  sonarService.setWindow(mainWindow!)
  serviceManager.startAll()  // starts Python services + GG Sonar native service

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  serviceManager?.stopAll()  // stops Python services + GG Sonar via native service registry
  if (process.platform !== 'darwin') app.quit()
})
