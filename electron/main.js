import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'

let mainWindow
let serverHandle

async function createMainWindow() {
  process.env.SHORTAPPS_DATA_DIR = join(app.getPath('userData'), 'data')

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
    const { startLocalServer } = await import('../server/local-server.js')
    serverHandle = await startLocalServer()
    await mainWindow.loadURL(serverHandle.desktopUrl)
  } catch (error) {
    const message = encodeURIComponent(`
      <main style="font-family: Segoe UI, Arial, sans-serif; padding: 42px; color: #172033;">
        <h1>ShortApps n'a pas pu démarrer le serveur local</h1>
        <p>L'interface s'est ouverte en mode erreur pour éviter une fenêtre invisible.</p>
        <pre style="white-space: pre-wrap; padding: 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">${error.stack ?? error.message}</pre>
      </main>
    `)
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${message}`)
  }
}

app.whenReady().then(createMainWindow).catch((error) => {
  console.error(error)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})

app.on('before-quit', () => {
  serverHandle?.httpServer?.close()
  serverHandle?.httpsServer?.close()
})
