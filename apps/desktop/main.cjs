const { app, BrowserWindow, shell, ipcMain } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const { join } = require('node:path')

const isPackaged = app.isPackaged
const RES = isPackaged ? process.resourcesPath : join(__dirname, '..', '..')
const PORT = Number(process.env.PORT || 4747)
const URL = `http://127.0.0.1:${PORT}`

// --- paths ---
let serverCmd
let serverArgs
let serverEnv
if (isPackaged) {
  // resources/server is unpacked (not inside the asar) so the server can read/write beside it.
  // Run it on Electron's own embedded Node (ELECTRON_RUN_AS_NODE) — no system Node needed.
  serverCmd = process.execPath
  serverArgs = [join(RES, 'server', 'apps', 'server', 'src', 'index.js')]
  serverEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    CLONEDZZ_ROOT: join(RES, 'server'),
    CLONEDZZ_LIBRARY: join(app.getPath('userData'), 'library'),
    CLONEDZZ_WEB_DIR: join(RES, 'web'),
    CLONEDZZ_OUTPUTS: join(app.getPath('userData'), 'outputs'),
    PLAYWRIGHT_BROWSERS_PATH: join(RES, 'browsers'),
  }
} else {
  // dev: run the TS entry on the system node (dev machines have a modern Node with type stripping)
  serverCmd = 'node'
  serverArgs = [join(RES, 'apps', 'server', 'src', 'index.ts')]
  serverEnv = { ...process.env }
}

let serverProc = null
let ownServer = false

async function isUp() {
  try {
    const r = await fetch(`${URL}/api/status`, { signal: AbortSignal.timeout(1500) })
    return r.ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isUp()) return
  ownServer = true
const cwd = serverEnv.CLONEDZZ_ROOT || join(RES, 'apps', 'server')
serverProc = spawn(serverCmd, serverArgs, {
  cwd,
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32' && serverCmd === 'node',
})
  serverProc.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`))
  serverProc.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`))
  serverProc.on('exit', () => {
    if (ownServer) serverProc = null
  })
  for (let i = 0; i < 120; i++) {
    if (await isUp()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('clonedzz server failed to start')
}

function stopServer() {
  if (serverProc && ownServer) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(serverProc.pid), '/T', '/F'])
    else serverProc.kill('SIGTERM')
    serverProc = null
  }
}

if (process.platform === 'win32') app.setAppUserModelId('com.clonedzz.desktop')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [w] = BrowserWindow.getAllWindows()
    if (w) {
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })

  ipcMain.on('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.on('window:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  async function createWindow() {
    await ensureServer()
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      title: 'CloneDzz',
      icon: join(__dirname, 'build', 'icon.png'),
      backgroundColor: '#0b0c0f',
      autoHideMenuBar: true,
      frame: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, 'preload.cjs'),
      },
    })
    win.on('maximize', () => win.webContents.send('window:maximized', true))
    win.on('unmaximize', () => win.webContents.send('window:maximized', false))
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('window:maximized', win.isMaximized())
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (e, url) => {
      if (!url.startsWith(URL)) {
        e.preventDefault()
        shell.openExternal(url)
      }
    })
    await win.loadURL(URL)
  }

  app.whenReady()
    .then(createWindow)
    .catch((e) => {
      console.error(e)
      app.quit()
    })
  app.on('window-all-closed', () => {
    stopServer()
    app.quit()
  })
  app.on('before-quit', () => stopServer())
}
