import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  createStatusPayload,
  getExposedInterfaces,
  getLanInterfaces,
  getPreferredAddress,
  HTTPS_SERVER_PORT,
  isSameSubnet,
  normalizeRemoteAddress,
  SERVER_PORT,
} from './network.js'
import { scanInstalledApps } from './app-scanner.js'
import { launchInstalledApp } from './app-launcher.js'
import { validateAppCatalog, validateAppTarget } from './app-validator.js'
import { sendKeyboardInput, warmKeyboardWorker } from './keyboard-controller.js'
import { readConfig, writeConfig } from './config-store.js'
import { ensureHttpsCertificate } from './https-cert.js'
import { getHubClientStatus, refreshHubClientConfig, startHubClient } from './hub-client.js'
import {
  getWindowsServiceStatus,
  installWindowsService,
  uninstallWindowsService,
} from './windows-service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const distDir = join(projectRoot, 'dist')
const port = SERVER_PORT
const httpsPort = HTTPS_SERVER_PORT
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const sessions = new Map()
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

function isAllowedLocalClient(request, config) {
  const clientIp = normalizeRemoteAddress(request.socket.remoteAddress)
  if (clientIp === '127.0.0.1') return true
  return getExposedInterfaces(config?.networkExposure).some((entry) =>
    isSameSubnet(clientIp, entry),
  )
}

function isDesktopClient(request) {
  const clientIp = normalizeRemoteAddress(request.socket.remoteAddress)
  const host = getRequestHostAddress(request)
  const userAgent = request.headers['user-agent'] ?? ''

  return (
    clientIp === '127.0.0.1' &&
    (host === '127.0.0.1' || host === 'localhost') &&
    userAgent.includes('Electron')
  )
}

function getRequestHostAddress(request) {
  const host = request.headers.host?.split(':')[0] ?? ''
  if (host === 'localhost') return '127.0.0.1'
  return host.replace(/^\[/, '').replace(/\]$/, '')
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function createDesktopConfig(config) {
  const publicConfig = { ...(config ?? {}) }
  delete publicConfig.auth
  delete publicConfig.pairing

  return publicConfig
}

function createPublicConfig(config) {
  const publicConfig = createDesktopConfig(config)
  delete publicConfig.hub

  return publicConfig
}

function isPasswordConfigured(config) {
  return Boolean(config?.auth?.passwordHash?.salt && config?.auth?.passwordHash?.hash)
}

function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')

  return {
    algorithm: 'scrypt',
    salt,
    hash,
    keyLength: 64,
  }
}

function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash?.salt || !passwordHash?.hash) return false

  try {
    const expected = Buffer.from(passwordHash.hash, 'hex')
    const actual = scryptSync(password, passwordHash.salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function cleanupSessions() {
  const now = Date.now()
  sessions.forEach((session, token) => {
    if (session.expiresAt <= now) sessions.delete(token)
  })
}

function destroySession(authToken) {
  if (!authToken) return false
  return sessions.delete(authToken)
}

function createSession() {
  cleanupSessions()
  const token = `sa_${randomBytes(32).toString('base64url')}`
  const expiresAt = Date.now() + SESSION_TTL_MS
  sessions.set(token, { expiresAt })

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

function getRequestAuthToken(request, payload = {}) {
  const directToken = request.headers['x-shortapps-auth']
  if (typeof directToken === 'string' && directToken) return directToken

  const authorization = request.headers.authorization ?? ''
  if (authorization.startsWith('Bearer ')) return authorization.slice(7)

  return payload.authToken ?? ''
}

function hasValidSessionToken(token) {
  cleanupSessions()
  const session = sessions.get(token)
  return Boolean(session && session.expiresAt > Date.now())
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

async function assertAuthenticatedRequest(request, payload = {}) {
  const config = await readConfig()

  if (!isPasswordConfigured(config)) {
    const error = new Error('PASSWORD_NOT_CONFIGURED')
    error.statusCode = 409
    throw error
  }

  if (!hasValidSessionToken(getRequestAuthToken(request, payload))) {
    const error = new Error('AUTH_REQUIRED')
    error.statusCode = 401
    throw error
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

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

async function handleRequestAsync(request, response) {
  const config = await readConfig()

  if (!isAllowedLocalClient(request, config)) {
    sendJson(response, 403, { error: 'LOCAL_NETWORK_ONLY' })
    return
  }

  const status = createStatusPayload({
    httpPort: port,
    httpsPort,
    httpsAvailable: httpsState.available,
    httpsError: httpsState.error,
    networkExposure: config?.networkExposure,
  })
  status.hub = getHubClientStatus()

  if (
    httpsState.available &&
    !request.socket.encrypted &&
    !isDesktopClient(request) &&
    request.url.startsWith('/mobile')
  ) {
    const requestAddress = getRequestHostAddress(request)
    const targetInterface = status.exposedInterfaces.find(
      (entry) => entry.address === requestAddress,
    )
    if (targetInterface) {
      response.writeHead(307, {
        location: `${targetInterface.httpsUrl}${request.url}`,
        'cache-control': 'no-store',
      })
      response.end()
      return
    }
  }

  if (request.url.startsWith('/api/status')) {
    sendJson(response, 200, status)
    return
  }

  if (request.url.startsWith('/api/auth/status')) {
    const configured = isPasswordConfigured(config)
    const authToken = getRequestAuthToken(request)
    const session = sessions.get(authToken)
    const authenticated = isDesktopClient(request) || hasValidSessionToken(authToken)
    sendJson(response, 200, {
      configured,
      authenticated,
      expiresAt: session && authenticated ? new Date(session.expiresAt).toISOString() : null,
    })
    return
  }

  if (request.url.startsWith('/api/auth/setup')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    if (!isDesktopClient(request)) {
      sendJson(response, 403, { saved: false, error: 'DESKTOP_CONSOLE_REQUIRED' })
      return
    }

    readJsonBody(request)
      .then(async (payload) => {
        const password = String(payload.password ?? '')
        if (password.length < 6) {
          const error = new Error('PASSWORD_TOO_SHORT')
          error.statusCode = 400
          throw error
        }

        const nextConfig = {
          ...(config ?? {}),
          auth: {
            version: 1,
            passwordHash: createPasswordHash(password),
            updatedAt: new Date().toISOString(),
          },
        }
        delete nextConfig.pairing
        sessions.clear()
        await writeConfig(nextConfig)
      })
      .then(() => sendJson(response, 200, { saved: true }))
      .catch((error) =>
        sendJson(response, error.statusCode ?? 500, {
          saved: false,
          error: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/auth/login')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    readJsonBody(request)
      .then((payload) => {
        if (!isPasswordConfigured(config)) {
          const error = new Error('PASSWORD_NOT_CONFIGURED')
          error.statusCode = 409
          throw error
        }

        if (!verifyPassword(String(payload.password ?? ''), config.auth.passwordHash)) {
          const error = new Error('INVALID_PASSWORD')
          error.statusCode = 401
          throw error
        }

        return createSession()
      })
      .then((session) => sendJson(response, 200, { authenticated: true, ...session }))
      .catch((error) =>
        sendJson(response, error.statusCode ?? 500, {
          authenticated: false,
          error: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/auth/logout')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    readJsonBody(request)
      .catch(() => ({}))
      .then((payload) => {
        const authToken = getRequestAuthToken(request, payload)
        const loggedOut = destroySession(authToken)
        sendJson(response, 200, { loggedOut })
      })
      .catch((error) =>
        sendJson(response, 500, {
          loggedOut: false,
          error: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/service/status')) {
    if (!isDesktopClient(request)) {
      sendJson(response, 403, { supported: false, error: 'DESKTOP_CONSOLE_REQUIRED' })
      return
    }

    getWindowsServiceStatus()
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, 500, {
          supported: process.platform === 'win32',
          installed: false,
          running: false,
          error: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/service/install')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    if (!isDesktopClient(request)) {
      sendJson(response, 403, { installed: false, error: 'DESKTOP_CONSOLE_REQUIRED' })
      return
    }

    installWindowsService()
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, 500, {
          installed: false,
          running: false,
          error: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/service/uninstall')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }

    if (!isDesktopClient(request)) {
      sendJson(response, 403, { installed: false, error: 'DESKTOP_CONSOLE_REQUIRED' })
      return
    }

    uninstallWindowsService()
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, 500, {
          installed: true,
          running: false,
          error: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/apps/scan')) {
    if (!isDesktopClient(request)) {
      sendJson(response, 403, { dynamic: false, error: 'DESKTOP_CONSOLE_REQUIRED', apps: [] })
      return
    }

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
        await assertAuthenticatedRequest(request, payload)
        return launchInstalledApp(payload.app)
      })
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, error.statusCode ?? 500, {
          launched: false,
          error: error.statusCode === 401 || error.statusCode === 409 ? error.message : 'APP_LAUNCH_FAILED',
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

    if (!isDesktopClient(request)) {
      sendJson(response, 403, { validated: false, error: 'DESKTOP_CONSOLE_REQUIRED' })
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
        await assertAuthenticatedRequest(request, payload)
        return sendKeyboardInput({ key: payload.key, action: payload.action })
      })
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) =>
        sendJson(response, error.statusCode ?? 500, {
          sent: false,
          error: error.statusCode === 401 || error.statusCode === 409 ? error.message : 'KEYBOARD_SEND_FAILED',
          message: error.message,
        }),
      )
    return
  }

  if (request.url.startsWith('/api/config')) {
    if (request.method === 'GET') {
      if (!isDesktopClient(request)) {
        try {
          await assertAuthenticatedRequest(request)
        } catch (error) {
          sendJson(response, error.statusCode ?? 401, { error: error.message })
          return
        }
      }

      sendJson(response, 200, {
        config: isDesktopClient(request) ? createDesktopConfig(config) : createPublicConfig(config),
      })
      return
    }

    if (request.method === 'PUT') {
      if (!isDesktopClient(request)) {
        sendJson(response, 403, { saved: false, error: 'DESKTOP_CONSOLE_REQUIRED' })
        return
      }

      readJsonBody(request)
        .then(async (payload) => {
          const nextConfig = {
            ...(config ?? {}),
            ...(payload.config ?? {}),
            auth: config?.auth,
          }
          delete nextConfig.pairing
          await writeConfig(nextConfig)
          await refreshHubClientConfig()
        })
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

function handleRequest(request, response) {
  handleRequestAsync(request, response).catch((error) => {
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
  const certificateAddresses = getLanInterfaces().map((entry) => entry.address)
  const server = createLocalServer()
  let httpsServer

  await listen(server, port, host)
  warmKeyboardWorker()

  try {
    const certificate = await ensureHttpsCertificate(
      certificateAddresses.length > 0 ? certificateAddresses : [lan.address],
    )
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

  const config = await readConfig()
  const status = createStatusPayload({
    httpPort: port,
    httpsPort,
    httpsAvailable: httpsState.available,
    httpsError: httpsState.error,
    networkExposure: config?.networkExposure,
  })
  const hubClient = startHubClient({ localPort: port })
  const payload = {
    server,
    httpServer: server,
    httpsServer,
    hubClient,
    port,
    httpsPort,
    desktopUrl: `http://127.0.0.1:${port}`,
    networkUrl: status.localUrl,
    networkUrls: status.exposedUrls,
    httpNetworkUrl: status.httpUrl,
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
