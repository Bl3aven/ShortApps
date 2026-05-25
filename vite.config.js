import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createStatusPayload } from './server/network.js'
import { scanInstalledApps } from './server/app-scanner.js'
import { launchInstalledApp } from './server/app-launcher.js'
import { validateAppCatalog, validateAppTarget } from './server/app-validator.js'
import { sendKeyboardInput } from './server/keyboard-controller.js'
import { readConfig, writeConfig } from './server/config-store.js'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const LOCAL_TUNNEL_STATUS_URL = 'http://127.0.0.1:56321/api/status'
const sessions = new Map()

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk.toString('utf8')
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

function normalizeRemoteAddress(address = '') {
  if (address.startsWith('::ffff:')) return address.slice('::ffff:'.length)
  if (address === '::1') return '127.0.0.1'
  return address
}

function getRequestHostAddress(request) {
  const host = request.headers.host?.split(':')[0] ?? ''
  if (host === 'localhost') return '127.0.0.1'
  return host.replace(/^\[/, '').replace(/\]$/, '')
}

function isDevConsoleClient(request) {
  const clientIp = normalizeRemoteAddress(request.socket.remoteAddress ?? '')
  const host = getRequestHostAddress(request)
  return clientIp === '127.0.0.1' && (host === '127.0.0.1' || host === 'localhost')
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

function destroySession(authToken) {
  if (!authToken) return false
  return sessions.delete(authToken)
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

function createHubStatusFromConfig(config) {
  const hub = config?.hub ?? {}
  const enabled = Boolean(hub.enabled && hub.url && hub.machineId && hub.secret)

  return {
    enabled,
    connected: false,
    state: enabled ? 'waiting-for-local-tunnel' : 'disabled',
    machineId: typeof hub.machineId === 'string' ? hub.machineId : '',
    url: typeof hub.url === 'string' ? hub.url : '',
    lastError: enabled ? 'Le serveur local du tunnel ne repond pas encore sur le port 56321.' : '',
  }
}

async function readLocalTunnelHubStatus() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1200)

  try {
    const response = await fetch(LOCAL_TUNNEL_STATUS_URL, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return null

    const status = await response.json()
    return status?.hub ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function shortAppsStatusPlugin() {
  return {
    name: 'shortapps-status',
    configureServer(server) {
      server.middlewares.use('/api/status', async (_request, response) => {
        try {
          const devPort = Number(server.config.server.port ?? 5173)
          const [config, localTunnelHubStatus] = await Promise.all([
            readConfig().catch(() => null),
            readLocalTunnelHubStatus(),
          ])
          const status = createStatusPayload({
            httpPort: devPort,
            httpsPort: devPort,
            httpsAvailable: false,
          })
          status.hub = localTunnelHubStatus ?? createHubStatusFromConfig(config)

          sendJson(response, 200, status)
        } catch (error) {
          sendJson(response, 500, {
            error: 'STATUS_FAILED',
            message: error.message,
          })
        }
      })

      server.middlewares.use('/api/auth/status', (request, response) => {
        readConfig()
          .then((config) => {
            const authToken = getRequestAuthToken(request)
            const session = sessions.get(authToken)
            const authenticated = isDevConsoleClient(request) || hasValidSessionToken(authToken)
            sendJson(response, 200, {
              configured: isPasswordConfigured(config),
              authenticated,
              expiresAt: session && authenticated ? new Date(session.expiresAt).toISOString() : null,
            })
          })
          .catch((error) =>
            sendJson(response, 500, {
              error: 'AUTH_STATUS_FAILED',
              message: error.message,
            }),
          )
      })

      server.middlewares.use('/api/auth/setup', (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
          return
        }

        if (!isDevConsoleClient(request)) {
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

            const config = await readConfig()
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
      })

      server.middlewares.use('/api/auth/login', (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
          return
        }

        readJsonBody(request)
          .then(async (payload) => {
            const config = await readConfig()

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
      })

      server.middlewares.use('/api/auth/logout', (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
          return
        }

        readJsonBody(request)
          .catch(() => ({}))
          .then((payload) => {
            const authToken = getRequestAuthToken(request, payload)
            sendJson(response, 200, { loggedOut: destroySession(authToken) })
          })
          .catch((error) =>
            sendJson(response, 500, {
              loggedOut: false,
              error: error.message,
            }),
          )
      })

      server.middlewares.use('/api/apps/scan', (_request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8')
        scanInstalledApps()
          .then((payload) => response.end(JSON.stringify(payload)))
          .catch((error) =>
            response.end(
              JSON.stringify({
                dynamic: false,
                error: 'APP_SCAN_FAILED',
                message: error.message,
                apps: [],
              }),
            ),
          )
      })

      server.middlewares.use('/api/apps/launch', (request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8')

        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
          return
        }

        readJsonBody(request)
          .then((payload) => launchInstalledApp(payload.app))
          .then((payload) => response.end(JSON.stringify(payload)))
          .catch((error) =>
            response.end(
              JSON.stringify({
                launched: false,
                error: 'APP_LAUNCH_FAILED',
                message: error.message,
              }),
            ),
          )
      })

      server.middlewares.use('/api/keyboard', (request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8')

        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
          return
        }

        readJsonBody(request)
          .then((payload) => sendKeyboardInput({ key: payload.key, action: payload.action }))
          .then((payload) => response.end(JSON.stringify(payload)))
          .catch((error) =>
            response.end(
              JSON.stringify({
                sent: false,
                error: 'KEYBOARD_SEND_FAILED',
                message: error.message,
              }),
            ),
          )
      })

      server.middlewares.use('/api/apps/validate', (request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8')

        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
          return
        }

        readJsonBody(request)
          .then((payload) =>
            Array.isArray(payload.apps)
              ? validateAppCatalog(payload.apps)
              : validateAppTarget(payload.app),
          )
          .then((payload) => response.end(JSON.stringify(payload)))
          .catch((error) =>
            response.end(
              JSON.stringify({
                validated: false,
                error: 'APP_VALIDATE_FAILED',
                message: error.message,
              }),
            ),
          )
      })

      server.middlewares.use('/api/config', (request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8')

        if (request.method === 'GET') {
          readConfig()
            .then((config) => response.end(JSON.stringify({ config })))
            .catch((error) =>
              response.end(
                JSON.stringify({
                  error: 'CONFIG_READ_FAILED',
                  message: error.message,
                }),
              ),
            )
          return
        }

        if (request.method === 'PUT') {
          readJsonBody(request)
            .then(async (payload) => {
              const currentConfig = await readConfig()
              const nextConfig = {
                ...(currentConfig ?? {}),
                ...(payload.config ?? {}),
                auth: currentConfig?.auth,
              }
              delete nextConfig.pairing
              await writeConfig(nextConfig)
            })
            .then(() => response.end(JSON.stringify({ saved: true })))
            .catch((error) =>
              response.end(
                JSON.stringify({
                  saved: false,
                  error: 'CONFIG_WRITE_FAILED',
                  message: error.message,
                }),
              ),
            )
          return
        }

        response.statusCode = 405
        response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), shortAppsStatusPlugin()],
})
