import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../shared/types'

/** Reference to the single main window — null before creation and after close */
let mainWindow: BrowserWindow | null = null

/**
 * Creates the frameless main application window.
 * We use frame:false so we can draw our own title bar in React with the correct
 * warm-tone design. Window chrome is handled entirely in the renderer.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // Show only after content is ready (prevents white flash)
    autoHideMenuBar: true,
    frame: false, // Custom title bar drawn in React
    backgroundColor: '#141413', // Warm dark — matches CSS var(--color-bg) dark mode
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true, // Required — renderer cannot access Node.js directly
      nodeIntegration: false, // Required — never expose Node in the renderer
    },
  })

  // Show window once the renderer has finished painting its first frame
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open DevTools in a detached panel during development
  if (is.dev) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    })
  }

  // Intercept window.open() — open external URLs in the OS browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Push maximize/restore state changes to the renderer so the title bar
  // can swap the maximize ↔ restore icon in real time
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGE, true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGE, false)
  })

  // Load the renderer — dev server URL in development, static file in production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Registers all IPC handlers for window controls.
 * Handlers use ipcMain.handle (async request/response) so the renderer
 * can await them via ipcRenderer.invoke through the preload bridge.
 */
function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    // Toggle between maximize and restore
    if (mainWindow?.isMaximized()) {
      mainWindow.restore()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow?.close()
  })

  // Renderer calls this once on startup to get the initial maximize state
  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () => {
    return mainWindow?.isMaximized() ?? false
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Set the Windows App User Model ID for notifications and taskbar grouping
  electronApp.setAppUserModelId('com.controlcentrepro.app')

  // Enable useful keyboard shortcuts in development (F12 DevTools, Ctrl+R reload)
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  // macOS: re-create the window when the dock icon is clicked and no windows exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit on all windows closed (standard on Windows/Linux; macOS handles via activate)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
