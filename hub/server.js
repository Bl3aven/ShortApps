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

function logLoginEvent(request, outcome, details = {}) {
  const payload = {
    event: 'hub_login',
    outcome,
    ip: getClientIp(request),
    machineId: details.machineId ?? '',
    statusCode: details.statusCode,
    reason: details.reason,
    origin: String(request.headers.origin ?? '').slice(0, 160),
    userAgent: getRequestUserAgent(request).slice(0, 120),
  }

  console.info(JSON.stringify(payload))
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
  if (origin === 'null') return true

  try {
    const originUrl = new URL(origin)
    if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') return false

    const originHostname = originUrl.hostname.toLowerCase()
    const requestHostname = getRequestHostname(request)

    return (
      originUrl.origin === getExpectedOrigin(request) ||
      originHostname === requestHostname ||
      allowedHostnames.has(originHostname)
    )
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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sendLoginPage(response, { machineId = '', error = '' } = {}) {
  const safeMachineId = escapeHtml(machineId)
  const safeError = error
    ? `<div class="alert" role="alert"><strong>Connexion refusee</strong><span>${escapeHtml(error)}</span></div>`
    : ''

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
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f7fb;
      color: #111827;
    }

    * { box-sizing: border-box; }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 28px;
      overflow-x: hidden;
      background:
        linear-gradient(135deg, rgba(18, 98, 255, 0.08), transparent 36%),
        linear-gradient(315deg, rgba(22, 163, 74, 0.08), transparent 32%),
        #f4f7fb;
      color: #111827;
    }

    .shell {
      width: min(960px, 100%);
      max-width: 100%;
      min-height: 560px;
      display: grid;
      grid-template-columns: minmax(0, 1.04fr) minmax(360px, 0.86fr);
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 28px 90px rgba(15, 23, 42, 0.18);
    }

    .brand-panel {
      position: relative;
      display: grid;
      align-content: space-between;
      gap: 36px;
      padding: 38px;
      background:
        linear-gradient(150deg, rgba(15, 23, 42, 0.96), rgba(20, 31, 52, 0.96)),
        #111827;
      color: #fff;
    }

    .brand-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0.24;
      background-image:
        linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
      background-size: 34px 34px;
      mask-image: linear-gradient(135deg, #000 0%, transparent 76%);
      pointer-events: none;
    }

    .brand-panel > * { position: relative; }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: #f8fafc;
      font-weight: 800;
      letter-spacing: 0;
    }

    .logo-mark {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: #1262ff;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
    }

    .logo-mark svg { width: 22px; height: 22px; }

    .hero h1 {
      max-width: 460px;
      margin: 0 0 14px;
      font-size: clamp(34px, 5vw, 54px);
      line-height: 0.98;
      letter-spacing: 0;
      overflow-wrap: break-word;
    }

    .hero p {
      max-width: 470px;
      margin: 0;
      color: rgba(226, 232, 240, 0.78);
      font-size: 16px;
      line-height: 1.55;
    }

    .signal-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .signal {
      min-width: 0;
      min-height: 86px;
      padding: 14px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
    }

    .signal span {
      display: block;
      margin-bottom: 8px;
      color: rgba(226, 232, 240, 0.62);
      font-size: 12px;
    }

    .signal strong {
      display: block;
      color: #fff;
      font-size: 14px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .login-panel {
      display: grid;
      align-content: center;
      padding: 42px;
      background: #fff;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      margin-bottom: 18px;
      padding: 7px 10px;
      border: 1px solid rgba(18, 98, 255, 0.18);
      border-radius: 999px;
      background: rgba(239, 246, 255, 0.86);
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 800;
    }

    .eyebrow::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #16a34a;
      box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.14);
    }

    h2 {
      margin: 0 0 8px;
      color: #0f172a;
      font-size: 28px;
      line-height: 1.12;
      letter-spacing: 0;
    }

    .intro {
      margin: 0 0 24px;
      color: #64748b;
      line-height: 1.5;
    }

    form { display: grid; gap: 14px; }

    label {
      display: grid;
      gap: 7px;
      color: #475569;
      font-size: 13px;
      font-weight: 760;
    }

    input {
      width: 100%;
      min-height: 48px;
      padding: 0 13px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #0f172a;
      font-size: 16px;
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    input:focus {
      border-color: #1262ff;
      box-shadow: 0 0 0 4px rgba(18, 98, 255, 0.14);
    }

    button {
      width: 100%;
      min-height: 50px;
      margin-top: 4px;
      border: 0;
      border-radius: 8px;
      background: #1262ff;
      color: #fff;
      font-size: 16px;
      font-weight: 850;
      cursor: pointer;
      box-shadow: 0 14px 34px rgba(18, 98, 255, 0.25);
    }

    button:hover { background: #0b55e8; }

    .alert {
      display: grid;
      gap: 3px;
      padding: 11px 12px;
      border: 1px solid rgba(220, 38, 38, 0.22);
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 13px;
    }

    .alert strong { font-size: 13px; }
    .alert span { line-height: 1.35; }

    .help {
      margin: 18px 0 0;
      color: #64748b;
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 820px) {
      body {
        align-items: start;
        padding: 0;
      }

      .shell {
        width: 100%;
        min-height: 100vh;
        grid-template-columns: 1fr;
        border-width: 0;
        border-radius: 0;
      }

      .brand-panel {
        min-height: 0;
        gap: 22px;
        padding: 24px;
      }

      .hero h1 {
        margin-bottom: 10px;
        font-size: 30px;
      }

      .hero p {
        font-size: 14px;
      }

      .signal-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .signal {
        min-height: 64px;
        padding: 10px;
      }

      .signal span {
        margin-bottom: 5px;
        font-size: 11px;
      }

      .signal strong {
        font-size: 12px;
      }

      .login-panel {
        align-content: start;
        padding: 24px;
      }
    }

    @media (max-width: 520px) {
      .signal-grid { display: none; }

      .brand-panel > *,
      .login-panel > * {
        width: min(342px, 100%);
        max-width: min(342px, 100%);
      }
    }

    @media (max-width: 340px) {
      h2 { font-size: 25px; }
    }

    @media (prefers-color-scheme: dark) {
      :root { background: #101114; color: #f4f4f5; }

      body {
        background:
          linear-gradient(135deg, rgba(18, 98, 255, 0.13), transparent 36%),
          linear-gradient(315deg, rgba(34, 197, 94, 0.10), transparent 32%),
          #101114;
      }

      .shell {
        border-color: rgba(148, 163, 184, 0.2);
        background: rgba(22, 24, 29, 0.94);
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
      }

      .brand-panel {
        background:
          linear-gradient(150deg, rgba(8, 12, 22, 0.98), rgba(21, 30, 47, 0.98)),
          #0b1020;
      }

      .login-panel { background: #17191f; }
      h2 { color: #f4f4f5; }
      .intro, .help, label { color: #a6adba; }
      .eyebrow {
        border-color: rgba(96, 165, 250, 0.22);
        background: rgba(29, 78, 216, 0.16);
        color: #93c5fd;
      }

      input {
        border-color: rgba(148, 163, 184, 0.24);
        background: rgba(31, 33, 39, 0.86);
        color: #f4f4f5;
      }

      .alert {
        border-color: rgba(248, 113, 113, 0.26);
        background: rgba(127, 29, 29, 0.24);
        color: #fecaca;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="brand-panel" aria-label="ShortApps Hub">
      <div class="logo">
        <span class="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 8.5h10M7 12h7M7 15.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </span>
        <span>ShortApps Hub</span>
      </div>

      <div class="hero">
        <h1>Acces distant securise.</h1>
        <p>Le portail relaie la session vers votre PC via un tunnel sortant. Le mot de passe reste verifie directement par la machine cible.</p>
      </div>

      <div class="signal-grid" aria-label="Etat de connexion">
        <div class="signal"><span>Transport</span><strong>HTTPS public</strong></div>
        <div class="signal"><span>Tunnel</span><strong>Sortant PC</strong></div>
        <div class="signal"><span>Session</span><strong>Jeton temporaire</strong></div>
      </div>
    </section>

    <section class="login-panel" aria-label="Connexion">
      <span class="eyebrow">Hub operationnel</span>
      <h2>Connexion ShortApps</h2>
      <p class="intro">Choisissez la machine puis saisissez le mot de passe mobile configure sur ce PC.</p>

      <form method="post" action="/hub/login">
        <label>
          ID machine
          <input name="machineId" value="${safeMachineId}" placeholder="moodbeast" autocapitalize="none" autocomplete="username" spellcheck="false" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        ${safeError}
        <button type="submit">Ouvrir le dashboard</button>
      </form>

      <p class="help">Aucun secret hub n'est demande ici. Utilisez uniquement le mot de passe mobile ShortApps.</p>
    </section>
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
    logLoginEvent(request, 'rejected', { reason: 'UNTRUSTED_ORIGIN' })
    sendLoginPage(response, { error: 'Origine de connexion refusee.' })
    return
  }

  if (isLoginRateLimited(request)) {
    logLoginEvent(request, 'rejected', { reason: 'RATE_LIMITED' })
    sendLoginPage(response, { error: 'Trop de tentatives. Reessayez dans quelques minutes.' })
    return
  }

  const body = await readRequestBody(request, maxLoginBodyBytes)
  const form = new URLSearchParams(body.toString('utf8'))
  const machineId = normalizeMachineId(form.get('machineId') ?? '')
  const password = String(form.get('password') ?? '')

  if (!machineIdPattern.test(machineId) || !password) {
    logLoginEvent(request, 'rejected', { machineId, reason: 'INVALID_FORM' })
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
      logLoginEvent(request, 'rejected', {
        machineId,
        statusCode: authResponse.statusCode,
        reason: authBody?.error ?? 'MACHINE_AUTH_REJECTED',
      })
      sendLoginPage(response, { machineId, error: 'Connexion refusee par la machine.' })
      return
    }

    const session = createSession({ machineId, authToken: authBody.token, request })
    logLoginEvent(request, 'accepted', { machineId, statusCode: authResponse.statusCode })
    response.writeHead(303, {
      location: '/mobile',
      'set-cookie': createSessionCookie(session.sessionId, session.expiresAt),
      'cache-control': 'no-store',
    })
    response.end()
  } catch (error) {
    logLoginEvent(request, 'rejected', {
      machineId,
      statusCode: error.statusCode,
      reason: error.message || 'MACHINE_UNAVAILABLE',
    })
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
