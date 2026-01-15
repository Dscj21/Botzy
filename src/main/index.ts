import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { dbManager } from './database'
import { setupIpcHandlers } from './ipcHandlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false 
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    // Reset zoom to 100% on start
    mainWindow!.webContents.setZoomFactor(1.0)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Enable right-click context menu (Copy/Paste)
  mainWindow.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    ])
    menu.popup({ window: mainWindow! })
  })

  // ZOOM CONTROLS (Ctrl + / - / 0)
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.control || input.meta) {
      if (input.key === '=' || input.key === '+') {
        mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5)
      } else if (input.key === '-') {
        mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5)
      } else if (input.key === '0') {
        mainWindow?.webContents.setZoomLevel(0)
      }
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Setup IPC Handlers that require mainWindow
  setupIpcHandlers(mainWindow)
  setupAutoUpdater()
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  console.log('[Updater] Initializing...')

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version)
    mainWindow?.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Update not available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[Updater] Download speed: ${progressObj.bytesPerSecond} - ${progressObj.percent}%`)
    mainWindow?.webContents.send('update-download-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded')
    mainWindow?.webContents.send('update-downloaded', info)
  })

  // IPC Handlers for updater
  ipcMain.handle('updater:check', () => {
    autoUpdater.checkForUpdates()
  })

  ipcMain.handle('updater:download', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })
}

// App Life Cycle
app.whenReady().then(() => {
  // Initialize DB
  dbManager.init()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
