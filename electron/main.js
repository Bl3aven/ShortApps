import { app, BrowserWindow, shell } from 'electron'
import { request as httpRequest } from 'node:http'
import { join } from 'node:path'

let mainWindow
let serverHandle
const isServiceMode = process.argv.includes('--service') || process.argv.includes('--background-service')
const desktopUrl = 'http://127.0.0.1:56321'

function configureDataDirectory() {
  process.env.SHORTAPPS_DATA_DIR = join(app.getPath('userData'), 'data')
  process.env.SHORTAPPS_DESKTOP_EXE = process.execPath
}

function isPortAlreadyInUse(error) {
  return error?.code === 'EADDRINUSE' || String(error?.message ?? '').includes('EADDRINUSE')
}

async function startBackgroundServer() {
  configureDataDirectory()
  const { startLocalServer } = await import('../server/local-server.js')
  serverHandle = await startLocalServer({ silent: isServiceMode, deferHttps: true })
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function probeDesktopServer(url = desktopUrl) {
  return new Promise((resolve) => {
    const statusUrl = new URL('/api/status', url)
    const request = httpRequest(
      statusUrl,
      {
        method: 'GET',
        timeout: 800,
        headers: {
          'user-agent': 'ShortApps Electron Startup Probe',
        },
      },
      (response) => {
        response.resume()
        resolve(response.statusCode === 200)
      },
    )

    request.on('timeout', () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
    request.end()
  })
}

async function waitForDesktopServer(url = desktopUrl, timeoutMs = 10000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await probeDesktopServer(url)) return true
    await delay(250)
  }

  return false
}

async function showStartupError(error) {
  const message = encodeURIComponent(`
    <main style="font-family: Segoe UI, Arial, sans-serif; padding: 42px; color: #172033;">
      <h1>ShortApps n'a pas pu démarrer le serveur local</h1>
      <p>L'interface s'est ouverte en mode erreur pour éviter une fenêtre invisible.</p>
      <pre style="white-space: pre-wrap; padding: 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">${error.stack ?? error.message}</pre>
    </main>
  `)
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${message}`)
}

async function loadDesktopWhenReady(url = desktopUrl) {
  const ready = await waitForDesktopServer(url)
  if (!ready) {
    throw new Error(`SHORTAPPS_LOCAL_SERVER_NOT_READY: ${url}`)
  }

  await mainWindow.loadURL(url)
}

async function createMainWindow() {
  configureDataDirectory()

  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1020,
    minHeight: 720,
    title: 'ShortApps',
    backgroundColor: '#eef4fb',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const startingMarkup = encodeURIComponent(`
    <main style="font-family: Segoe UI, Arial, sans-serif; min-height: 100vh; display: grid; place-items: center; margin: 0; color: #172033; background: #eef4fb;">
      <section style="padding: 32px; text-align: center;">
        <h1 style="margin: 0 0 10px;">ShortApps</h1>
        <p style="margin: 0; color: #64748b;">Démarrage du serveur local...</p>
      </section>
    </main>
  `)
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${startingMarkup}`)

  try {
    await startBackgroundServer()
    await loadDesktopWhenReady(serverHandle.desktopUrl)
  } catch (error) {
    if (isPortAlreadyInUse(error)) {
      try {
        await loadDesktopWhenReady(desktopUrl)
      } catch (existingServerError) {
        await showStartupError(existingServerError)
      }
      return
    }

    await showStartupError(error)
  }
}

app.whenReady().then(() => {
  if (isServiceMode) return startBackgroundServer()
  return createMainWindow()
}).catch((error) => {
  console.error(error)
})

app.on('window-all-closed', () => {
  if (isServiceMode) return
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (isServiceMode) return
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})

app.on('before-quit', () => {
  serverHandle?.hubClient?.close()
  serverHandle?.httpServer?.close()
  serverHandle?.httpsServer?.close()
})
