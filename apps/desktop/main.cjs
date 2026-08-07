const { app, BrowserWindow, shell, ipcMain } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const { join } = require('node:path')

const ROOT = join(__dirname, '..', '..')
const SERVER_ENTRY = join(ROOT, 'apps', 'server', 'src', 'index.ts')
const SERVER_DIR = join(ROOT, 'apps', 'server')
const PORT = Number(process.env.PORT || 4747)
const URL = `http://127.0.0.1:${PORT}`

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
  serverProc = spawn('node', [SERVER_ENTRY], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
  serverProc.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`))
  serverProc.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`))
  serverProc.on('exit', () => {
    if (ownServer) serverProc = null
  })
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('cloneforge server failed to start')
}

function stopServer() {
  if (serverProc && ownServer) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(serverProc.pid), '/T', '/F'])
    else serverProc.kill('SIGTERM')
    serverProc = null
  }
}

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
      title: 'CloneForge',
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
