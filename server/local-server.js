import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { randomUUID } from 'node:crypto'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  createStatusPayload,
  getLanInterfaces,
  getPcName,
  getPreferredAddress,
  HTTPS_SERVER_PORT,
  isSameSubnet,
  SERVER_PORT,
} from './network.js'
import { scanInstalledApps } from './app-scanner.js'
import { launchInstalledApp } from './app-launcher.js'
import { validateAppCatalog, validateAppTarget } from './app-validator.js'
import { sendKeyboardInput } from './keyboard-controller.js'
import { readConfig, writeConfig } from './config-store.js'
import { ensureHttpsCertificate } from './https-cert.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const distDir = join(projectRoot, 'dist')
const port = SERVER_PORT
const httpsPort = HTTPS_SERVER_PORT
let httpsState = {
  available: false,
  error: '',
  certificatePath: '',
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function normalizeRemoteAddress(remoteAddress = '') {
  if (remoteAddress === '::1') return '127.0.0.1'
  if (remoteAddress.startsWith('::ffff:')) return remoteAddress.slice(7)
  return remoteAddress
}

function isAllowedLocalClient(request) {
  const clientIp = normalizeRemoteAddress(request.socket.remoteAddress)
  if (clientIp === '127.0.0.1') return true
  return getLanInterfaces().some((entry) => isSameSubnet(clientIp, entry))
}

function isDesktopClient(request) {
  return normalizeRemoteAddress(request.socket.remoteAddress) === '127.0.0.1'
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk.toString('utf8')
      if (body.length > 100_000) {
        reject(new Error('BODY_TOO_LARGE'))
        request.destroy()
      }
    })

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })
  })
}

function createPairingPayload() {
  const lan = getPreferredAddress()
  const code = `SHA-${Math.floor(1000 + Math.random() * 9000)}`
  const protocol = httpsState.available ? 'https' : 'http'
  const mobilePort = httpsState.available ? httpsPort : port

  return {
    app: 'ShortApps',
    version: 1,
    type: 'pair-device',
    pcName: getPcName(),
    localIp: lan.address,
    localUrl: `${protocol}://${lan.address}:${mobilePort}`,
    httpsAvailable: httpsState.available,
    httpsError: httpsState.error,
    localOnly: true,
    token: `pair_${randomUUID()}`,
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
}

function hasValidPairing(url, config) {
  const pairing = config?.pairing
  if (!pairing?.token || !pairing?.code) return true

  const tokenMatches = url.searchParams.get('pair') === pairing.token
  const codeMatches = url.searchParams.get('code') === pairing.code

  return tokenMatches && codeMatches
}

function hasValidPairingPayload(url, payload, config) {
  const pairing = config?.pairing
  if (!pairing?.token || !pairing?.code) return true

  const token = payload?.pair ?? payload?.pairing?.token ?? url.searchParams.get('pair')
  const code = payload?.code ?? payload?.pairing?.code ?? url.searchParams.get('code')

  return token === pairing.token && code === pairing.code
}

async function assertAuthorizedCommand(request, payload) {
  if (isDesktopClient(request)) return

  const url = new URL(request.url, `http://${request.headers.host}`)
  const config = await readConfig()

  if (!hasValidPairingPayload(url, payload, config)) {
    const error = new Error('PAIRING_REQUIRED')
    error.statusCode = 403
    throw error
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

  if (pathname.startsWith('/mobile') && !isDesktopClient(request)) {
    const config = await readConfig()
    if (!hasValidPairing(url, config)) {
      response.writeHead(403)
      response.end('Pairing required')
      return
    }
  }

  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let filePath = resolve(join(distDir, normalizedPath))

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(distDir, 'index.html')
  }

  response.writeHead(200, {
    'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000',
  })
  createReadStream(filePath).pipe(response)
}

function handleRequest(request, response) {
  if (!isAllowedLocalClient(request)) {
    sendJson(response, 403, { error: 'LOCAL_NETWORK_ONLY' })
    return
  }

  if (
    httpsState.available &&
    !request.socket.encrypted &&
    !isDesktopClient(request) &&
    request.url.startsWith('/mobile')
  ) {
    const lan = getPreferredAddress()
    response.writeHead(307, {
      location: `https://${lan.address}:${httpsPort}${request.url}`,
      'cache-control': 'no-store',
    })
    response.end()
    return
  }

  if (request.url.startsWith('/api/status')) {
    sendJson(
      response,
      200,
      createStatusPayload({
        httpPort: port,
        httpsPort,
        httpsAvailable: httpsState.available,
        httpsError: httpsState.error,
      }),
    )
    return
  }

  if (request.url.startsWith('/api/pairing')) {
    sendJson(response, 200, createPairingPayload())
    return
  }

  if (request.url.startsWith('/api/apps/scan')) {
    scanInstalledApps()
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, 500, {
          dynamic: false,
          error: 'APP_SCAN_FAILED',
          message: error.message,
          apps: [],
        }),
      )
    return
  }

  if (request.url.startsWith('/api/apps/launch')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    readJsonBody(request)
      .then(async (payload) => {
        await assertAuthorizedCommand(request, payload)
        return launchInstalledApp(payload.app)
      })
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, error.statusCode ?? 500, {
          launched: false,
          error: error.statusCode === 403 ? 'PAIRING_REQUIRED' : 'APP_LAUNCH_FAILED',
          message: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/apps/validate')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    readJsonBody(request)
      .then((payload) =>
        Array.isArray(payload.apps)
          ? validateAppCatalog(payload.apps)
          : validateAppTarget(payload.app),
      )
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, 500, {
          validated: false,
          error: 'APP_VALIDATE_FAILED',
          message: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/keyboard')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    readJsonBody(request)
      .then(async (payload) => {
        await assertAuthorizedCommand(request, payload)
        return sendKeyboardInput({ key: payload.key, action: payload.action })
      })
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, error.statusCode ?? 500, {
          sent: false,
          error: error.statusCode === 403 ? 'PAIRING_REQUIRED' : 'KEYBOARD_SEND_FAILED',
          message: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/config')) {
    if (request.method === 'GET') {
      const url = new URL(request.url, `http://${request.headers.host}`)
      readConfig()
        .then((config) => {
          if (!isDesktopClient(request) && !hasValidPairing(url, config)) {
            sendJson(response, 403, { error: 'PAIRING_REQUIRED' })
            return
          }

          sendJson(response, 200, { config })
        })
        .catch((error) =>
          sendJson(response, 500, {
            error: 'CONFIG_READ_FAILED',
            message: error.message,
          }),
        )
      return
    }

    if (request.method === 'PUT') {
      readJsonBody(request)
        .then((payload) => writeConfig(payload.config ?? {}))
        .then(() => sendJson(response, 200, { saved: true }))
        .catch((error) =>
          sendJson(response, 500, {
            saved: false,
            error: 'CONFIG_WRITE_FAILED',
            message: error.message,
          }),
        )
      return
    }

    sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
    return
  }

  serveStatic(request, response).catch((error) => {
    sendJson(response, 500, { error: 'SERVER_ERROR', message: error.message })
  })
}

export function createLocalServer() {
  return createHttpServer(handleRequest)
}

function listen(server, listenPort, host) {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error) => rejectListen(error)

    server.once('error', onError)
    server.listen(listenPort, host, () => {
      server.off('error', onError)
      resolveListen()
    })
  })
}

export async function startLocalServer({ host = '0.0.0.0', silent = false } = {}) {
  const lan = getPreferredAddress()
  const server = createLocalServer()
  let httpsServer

  await listen(server, port, host)

  try {
    const certificate = await ensureHttpsCertificate(lan.address)
    httpsServer = createHttpsServer(certificate.options, handleRequest)
    await listen(httpsServer, httpsPort, host)
    httpsState = {
      available: true,
      error: '',
      certificatePath: certificate.certificatePath,
    }
  } catch (error) {
    httpsServer?.close()
    httpsState = {
      available: false,
      error: error.message,
      certificatePath: '',
    }
  }

  const payload = {
    server,
    httpServer: server,
    httpsServer,
    port,
    httpsPort,
    desktopUrl: `http://127.0.0.1:${port}`,
    networkUrl: httpsState.available
      ? `https://${lan.address}:${httpsPort}`
      : `http://${lan.address}:${port}`,
    httpNetworkUrl: `http://${lan.address}:${port}`,
    httpsAvailable: httpsState.available,
    httpsError: httpsState.error,
    certificatePath: httpsState.certificatePath,
  }

  if (!silent) {
    console.log(`ShortApps local server: ${payload.desktopUrl}`)
    console.log(`ShortApps mobile URL:    ${payload.networkUrl}`)
    if (httpsState.available) {
      console.log(`ShortApps certificate:  ${payload.certificatePath}`)
    } else {
      console.warn(`ShortApps HTTPS disabled: ${httpsState.error}`)
    }
  }

  return payload
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocalServer().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
