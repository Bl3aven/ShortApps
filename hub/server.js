import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'

const host = process.env.SHORTAPPS_HUB_HOST ?? '127.0.0.1'
const port = Number(process.env.SHORTAPPS_HUB_PORT ?? 8080)
const publicDomain = String(process.env.SHORTAPPS_HUB_DOMAIN ?? '').trim().toLowerCase()
const allowedHostnames = new Set(
  [
    publicDomain,
    'localhost',
    '127.0.0.1',
    ...(process.env.SHORTAPPS_HUB_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  ].filter(Boolean),
)
const registrationSecret = String(process.env.SHORTAPPS_HUB_REGISTRATION_SECRET ?? '').trim()
const sessionTtlMs = Number(process.env.SHORTAPPS_HUB_SESSION_TTL_SECONDS ?? 30 * 24 * 60 * 60) * 1000
const cookieSecure = process.env.SHORTAPPS_HUB_COOKIE_SECURE !== '0'
const exposePublicStatus = process.env.SHORTAPPS_HUB_PUBLIC_STATUS === '1'
const maxBodyBytes = 20 * 1024 * 1024
const maxLoginBodyBytes = 8 * 1024
const requestTimeoutMs = 30000
const machineIdPattern = /^[a-z0-9_.-]{2,64}$/
const allowedStaticFiles = new Set([
  '/favicon.svg',
  '/icons.svg',
  '/manifest.webmanifest',
  '/robots.txt',
])
const allowedApiRoutes = new Map([
  ['/api/status', new Set(['GET', 'HEAD'])],
  ['/api/config', new Set(['GET', 'HEAD'])],
  ['/api/auth/status', new Set(['GET', 'HEAD'])],
  ['/api/auth/logout', new Set(['POST'])],
  ['/api/apps/launch', new Set(['POST'])],
  ['/api/keyboard', new Set(['POST'])],
])

if (registrationSecret.length < 32) {
  console.error('SHORTAPPS_HUB_REGISTRATION_SECRET must contain at least 32 characters.')
  process.exit(1)
}

const machines = new Map()
const sessions = new Map()
const loginAttempts = new Map()

function createSecurityHeaders() {
  return {
    'content-security-policy': [
      "default-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
    ].join('; '),
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'origin-agent-cluster': '?1',
    'permissions-policy': [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
    ].join(', '),
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-permitted-cross-domain-policies': 'none',
  }
}

function normalizeMachineId(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function isSafeEqual(left = '', right = '') {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    ...headers,
    ...createSecurityHeaders(),
  })
  response.end(body)
}

function sendJson(response, statusCode, payload) {
  send(response, statusCode, JSON.stringify(payload), {
    'content-type': 'application/json; charset=utf-8',
  })
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=')
        if (separatorIndex < 0) return [part, '']
        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ]
      }),
  )
}

function getRequestUserAgent(request) {
  return String(request.headers['user-agent'] ?? '').slice(0, 240)
}

function createSession({ machineId, authToken, request }) {
  const sessionId = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + sessionTtlMs
  const userAgentHash = createHash('sha256')
    .update(getRequestUserAgent(request))
    .digest('base64url')
  sessions.set(sessionId, { machineId, authToken, expiresAt, userAgentHash })

  return { sessionId, expiresAt }
}

function cleanupSessions() {
  const now = Date.now()
  sessions.forEach((session, sessionId) => {
    if (session.expiresAt <= now) sessions.delete(sessionId)
  })
}

function getSession(request) {
  cleanupSessions()
  const sessionId = parseCookies(request.headers.cookie).shortapps_hub_session
  const session = sessions.get(sessionId)
  if (!session || session.expiresAt <= Date.now()) return null
  const userAgentHash = createHash('sha256')
    .update(getRequestUserAgent(request))
    .digest('base64url')
  if (session.userAgentHash !== userAgentHash) {
    sessions.delete(sessionId)
    return null
  }

  return { sessionId, ...session }
}

function createSessionCookie(sessionId, expiresAt) {
  const attributes = [
    `shortapps_hub_session=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}`,
  ]

  if (cookieSecure) attributes.push('Secure')
  return attributes.join('; ')
}

function createExpiredCookie() {
  const attributes = [
    'shortapps_hub_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]

  if (cookieSecure) attributes.push('Secure')
  return attributes.join('; ')
}

function getClientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.socket.remoteAddress ?? 'unknown'
}

function getRequestHostname(request) {
  const forwardedHost = request.headers['x-forwarded-host']
  const hostHeader =
    typeof forwardedHost === 'string' && forwardedHost
      ? forwardedHost
      : request.headers.host
  const hostValue = String(hostHeader ?? '').split(',')[0].trim().toLowerCase()
  if (!hostValue) return ''
  if (hostValue.startsWith('[')) return hostValue.slice(1).split(']')[0]
  return hostValue.split(':')[0]
}

function isAllowedHost(request) {
  if (allowedHostnames.size === 0) return true
  return allowedHostnames.has(getRequestHostname(request))
}

function getExpectedOrigin(request) {
  const hostname = getRequestHostname(request)
  if (!hostname) return ''
  return `${cookieSecure ? 'https' : 'http'}://${hostname}`
}

function hasTrustedOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true

  try {
    return new URL(origin).origin === getExpectedOrigin(request)
  } catch {
    return false
  }
}

function isAllowedProxyRoute(url, method) {
  const requestMethod = method === 'HEAD' ? 'GET' : method

  if ((url.pathname === '/mobile' || url.pathname.startsWith('/mobile/')) && requestMethod === 'GET') {
    return true
  }

  if (url.pathname.startsWith('/assets/') && requestMethod === 'GET') {
    return true
  }

  if (allowedStaticFiles.has(url.pathname) && requestMethod === 'GET') {
    return true
  }

  return allowedApiRoutes.get(url.pathname)?.has(method) ?? false
}

function isLoginRateLimited(request) {
  const ip = getClientIp(request)
  const now = Date.now()
  const windowMs = 10 * 60 * 1000
  const maxAttempts = 20
  const attempts = (loginAttempts.get(ip) ?? []).filter((timestamp) => now - timestamp < windowMs)

  attempts.push(now)
  loginAttempts.set(ip, attempts)

  return attempts.length > maxAttempts
}

function readRequestBody(request, limitBytes = maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalLength = 0

    request.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > limitBytes) {
        reject(new Error('REQUEST_BODY_TOO_LARGE'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function sanitizeProxyHeaders(headers = {}) {
  const nextHeaders = { ...headers }

  delete nextHeaders.host
  delete nextHeaders.connection
  delete nextHeaders.upgrade
  delete nextHeaders['proxy-connection']
  delete nextHeaders['transfer-encoding']
  delete nextHeaders['content-length']
  delete nextHeaders.cookie
  delete nextHeaders.authorization
  delete nextHeaders['x-shortapps-auth']
  delete nextHeaders['x-forwarded-for']
  delete nextHeaders['x-forwarded-host']
  delete nextHeaders['x-forwarded-proto']
  delete nextHeaders['x-real-ip']

  return nextHeaders
}

function sanitizeResponseHeaders(headers = {}) {
  const nextHeaders = { ...headers }

  delete nextHeaders.connection
  delete nextHeaders['keep-alive']
  delete nextHeaders['proxy-authenticate']
  delete nextHeaders['proxy-authorization']
  delete nextHeaders.te
  delete nextHeaders.trailer
  delete nextHeaders['transfer-encoding']
  delete nextHeaders.upgrade
  delete nextHeaders['set-cookie']
  delete nextHeaders['content-length']
  delete nextHeaders['content-security-policy']
  delete nextHeaders['x-frame-options']
  delete nextHeaders['x-content-type-options']
  delete nextHeaders['referrer-policy']

  return nextHeaders
}

function sendLoginPage(response, { machineId = '', error = '' } = {}) {
  const safeMachineId = machineId.replace(/"/g, '&quot;')
  const safeError = error ? `<p class="error">${error}</p>` : ''

  send(
    response,
    200,
    `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>ShortApps Hub</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: radial-gradient(circle at 20% 15%, #173766, #071224 52%, #020817); color: #fff; }
    main { width: min(420px, calc(100vw - 32px)); padding: 30px; border: 1px solid rgba(255,255,255,.18); border-radius: 18px; background: rgba(10,18,34,.72); box-shadow: 0 28px 80px rgba(0,0,0,.36); backdrop-filter: blur(18px); }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0 0 22px; color: rgba(255,255,255,.72); line-height: 1.45; }
    label { display: grid; gap: 8px; margin-top: 14px; color: rgba(255,255,255,.74); font-size: 13px; }
    input { min-height: 48px; padding: 0 14px; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: rgba(255,255,255,.10); color: #fff; font-size: 16px; }
    button { width: 100%; min-height: 50px; margin-top: 20px; border: 0; border-radius: 12px; background: linear-gradient(180deg, #3b82ff, #155dfc); color: #fff; font-size: 16px; font-weight: 800; box-shadow: 0 14px 36px rgba(37,99,235,.38); }
    .error { margin: 12px 0 0; color: #fecaca; }
    small { display: block; margin-top: 18px; color: rgba(255,255,255,.5); }
  </style>
</head>
<body>
  <main>
    <h1>ShortApps</h1>
    <p>Connectez-vous a une machine distante via le hub securise.</p>
    <form method="post" action="/hub/login">
      <label>
        ID machine
        <input name="machineId" value="${safeMachineId}" placeholder="moodbeast" autocapitalize="none" autocomplete="username" required />
      </label>
      <label>
        Mot de passe
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      ${safeError}
      <button type="submit">Ouvrir ShortApps</button>
    </form>
    <small>Le mot de passe est verifie par le PC distant via le tunnel sortant.</small>
  </main>
</body>
</html>`,
    { 'content-type': 'text/html; charset=utf-8' },
  )
}

function tunnelRequest(machineId, requestPayload) {
  const machine = machines.get(machineId)
  if (!machine || machine.socket.readyState !== WebSocket.OPEN) {
    const error = new Error('MACHINE_OFFLINE')
    error.statusCode = 503
    throw error
  }

  return new Promise((resolve, reject) => {
    const requestId = randomBytes(16).toString('hex')
    const timeout = setTimeout(() => {
      machine.pending.delete(requestId)
      const error = new Error('MACHINE_TIMEOUT')
      error.statusCode = 504
      reject(error)
    }, requestTimeoutMs)

    machine.pending.set(requestId, { resolve, reject, timeout })
    machine.socket.send(JSON.stringify({ type: 'request', requestId, ...requestPayload }))
  })
}

async function handleLogin(request, response) {
  if (request.method !== 'POST') {
    send(response, 405, 'Method not allowed', { 'content-type': 'text/plain; charset=utf-8' })
    return
  }

  if (!hasTrustedOrigin(request)) {
    sendLoginPage(response, { error: 'Origine de connexion refusee.' })
    return
  }

  if (isLoginRateLimited(request)) {
    sendLoginPage(response, { error: 'Trop de tentatives. Reessayez dans quelques minutes.' })
    return
  }

  const body = await readRequestBody(request, maxLoginBodyBytes)
  const form = new URLSearchParams(body.toString('utf8'))
  const machineId = normalizeMachineId(form.get('machineId') ?? '')
  const password = String(form.get('password') ?? '')

  if (!machineIdPattern.test(machineId) || !password) {
    sendLoginPage(response, { machineId, error: 'ID machine ou mot de passe invalide.' })
    return
  }

  try {
    const authResponse = await tunnelRequest(machineId, {
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify({ password })).toString('base64'),
    })
    const authBody = JSON.parse(Buffer.from(authResponse.body ?? '', 'base64').toString('utf8'))

    if (authResponse.statusCode !== 200 || !authBody?.token) {
      sendLoginPage(response, { machineId, error: 'Connexion refusee par la machine.' })
      return
    }

    const session = createSession({ machineId, authToken: authBody.token, request })
    response.writeHead(303, {
      location: '/mobile',
      'set-cookie': createSessionCookie(session.sessionId, session.expiresAt),
      'cache-control': 'no-store',
    })
    response.end()
  } catch {
    sendLoginPage(response, { machineId, error: "Machine indisponible ou mot de passe refuse." })
  }
}

async function handleProxy(request, response, session) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  if (!isAllowedProxyRoute(url, request.method)) {
    sendJson(response, 404, { error: 'NOT_FOUND' })
    return
  }

  if (!hasTrustedOrigin(request)) {
    sendJson(response, 403, { error: 'UNTRUSTED_ORIGIN' })
    return
  }

  const requestBody = await readRequestBody(request)
  const headers = sanitizeProxyHeaders(request.headers)

  headers['x-shortapps-auth'] = session.authToken
  headers['x-forwarded-proto'] = 'https'
  headers['x-forwarded-for'] = getClientIp(request)

  const tunneledResponse = await tunnelRequest(session.machineId, {
    method: request.method,
    path: request.url,
    headers,
    body: requestBody.toString('base64'),
  })

  send(
    response,
    tunneledResponse.statusCode ?? 502,
    Buffer.from(tunneledResponse.body ?? '', 'base64'),
    sanitizeResponseHeaders(tunneledResponse.headers),
  )
}

async function handleHttp(request, response) {
  try {
    if (!isAllowedHost(request)) {
      sendJson(response, 421, { error: 'MISDIRECTED_REQUEST' })
      return
    }

    const url = new URL(request.url, `http://${request.headers.host}`)

    if (url.pathname === '/hub/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
        return
      }

      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname === '/hub/status') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
        return
      }

      sendJson(response, 200, exposePublicStatus ? {
        ok: true,
        connectedMachines: machines.size,
      } : { ok: true })
      return
    }

    if (url.pathname === '/hub/logout') {
      if (request.method !== 'GET' && request.method !== 'POST') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
        return
      }

      response.writeHead(303, {
        location: '/',
        'set-cookie': createExpiredCookie(),
        'cache-control': 'no-store',
        ...createSecurityHeaders(),
      })
      response.end()
      return
    }

    if (url.pathname === '/hub/login') {
      await handleLogin(request, response)
      return
    }

    const session = getSession(request)
    if (!session) {
      if (url.pathname === '/' || url.pathname === '/mobile') {
        sendLoginPage(response, { machineId: normalizeMachineId(url.searchParams.get('machine') ?? '') })
        return
      }

      response.writeHead(303, {
        location: '/',
        'cache-control': 'no-store',
        ...createSecurityHeaders(),
      })
      response.end()
      return
    }

    if (url.pathname === '/') {
      response.writeHead(303, {
        location: '/mobile',
        'cache-control': 'no-store',
        ...createSecurityHeaders(),
      })
      response.end()
      return
    }

    await handleProxy(request, response, session)
  } catch (error) {
    sendJson(response, error.statusCode ?? 500, {
      error: error.message || 'HUB_ERROR',
    })
  }
}

const server = createServer((request, response) => {
  handleHttp(request, response).catch((error) => {
    sendJson(response, 500, { error: error.message })
  })
})
const websocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 24 * 1024 * 1024,
  perMessageDeflate: false,
})

server.on('upgrade', (request, socket, head) => {
  if (!isAllowedHost(request) || request.headers.origin) {
    socket.destroy()
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  if (url.pathname !== '/tunnel/pc') {
    socket.destroy()
    return
  }

  const machineId = normalizeMachineId(url.searchParams.get('machineId') ?? '')
  const providedSecret = String(request.headers['x-shortapps-hub-secret'] ?? '')

  if (!machineIdPattern.test(machineId) || !isSafeEqual(providedSecret, registrationSecret)) {
    socket.destroy()
    return
  }

  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit('connection', websocket, request, machineId)
  })
})

websocketServer.on('connection', (socket, request, machineId) => {
  const previousMachine = machines.get(machineId)
  if (previousMachine) previousMachine.socket.close(1012, 'Machine replaced')

  const machine = {
    socket,
    pending: new Map(),
    connectedAt: new Date().toISOString(),
    remoteAddress: getClientIp(request),
  }
  machines.set(machineId, machine)
  socket.send(JSON.stringify({ type: 'registered', machineId }))

  socket.on('message', (rawMessage) => {
    let message

    try {
      message = JSON.parse(rawMessage.toString('utf8'))
    } catch {
      return
    }

    if (message.type !== 'response' || !message.requestId) return

    const pendingRequest = machine.pending.get(message.requestId)
    if (!pendingRequest) return

    clearTimeout(pendingRequest.timeout)
    machine.pending.delete(message.requestId)
    pendingRequest.resolve(message)
  })

  socket.on('close', () => {
    if (machines.get(machineId) === machine) machines.delete(machineId)
    machine.pending.forEach((pendingRequest) => {
      clearTimeout(pendingRequest.timeout)
      pendingRequest.reject(new Error('MACHINE_DISCONNECTED'))
    })
    machine.pending.clear()
  })
})

server.listen(port, host, () => {
  console.log(`ShortApps hub listening on http://${host}:${port}`)
})
