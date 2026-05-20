import { Buffer } from 'node:buffer'
import { request as httpRequest } from 'node:http'
import WebSocket from 'ws'
import { readConfig } from './config-store.js'
import { SERVER_PORT } from './network.js'

const CONFIG_POLL_MS = 3000
const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30000
const REQUEST_TIMEOUT_MS = 30000
const MAX_BODY_BYTES = 20 * 1024 * 1024
const MAX_TUNNEL_PAYLOAD_BYTES = 24 * 1024 * 1024
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
  ['/api/auth/login', new Set(['POST'])],
  ['/api/auth/logout', new Set(['POST'])],
  ['/api/apps/launch', new Set(['POST'])],
  ['/api/keyboard', new Set(['POST'])],
])

let activeHubClient = null

function normalizeMachineId(machineId = '') {
  return String(machineId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function normalizeHubUrl(value = '') {
  const rawValue = String(value).trim()
  if (!rawValue) return ''

  try {
    const url = new URL(rawValue.includes('://') ? rawValue : `https://${rawValue}`)
    if (url.protocol === 'https:') url.protocol = 'wss:'
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return ''
    url.pathname = '/tunnel/pc'
    url.search = ''
    url.hash = ''

    return url.toString()
  } catch {
    return ''
  }
}

function normalizeHubConfig(config = {}) {
  const hub = config?.hub ?? {}
  const enabled = Boolean(hub.enabled)
  const machineId = normalizeMachineId(hub.machineId)
  const tunnelUrl = normalizeHubUrl(hub.url)
  const secret = String(hub.secret ?? '').trim()

  return {
    enabled: enabled && Boolean(machineId && tunnelUrl && secret),
    configured: Boolean(enabled && machineId && tunnelUrl && secret),
    machineId,
    tunnelUrl,
    secret,
  }
}

function isSameHubConfig(left, right) {
  return (
    left?.enabled === right?.enabled &&
    left?.machineId === right?.machineId &&
    left?.tunnelUrl === right?.tunnelUrl &&
    left?.secret === right?.secret
  )
}

function isAllowedTunneledRequest(path = '/', method = 'GET') {
  const requestMethod = method === 'HEAD' ? 'GET' : method

  try {
    const url = new URL(path, 'http://shortapps.local')
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
  } catch {
    return false
  }
}

function sanitizeRequestHeaders(headers = {}) {
  const nextHeaders = { ...headers }

  delete nextHeaders.host
  delete nextHeaders.connection
  delete nextHeaders.upgrade
  delete nextHeaders['proxy-connection']
  delete nextHeaders['transfer-encoding']
  delete nextHeaders['content-length']
  delete nextHeaders['accept-encoding']
  delete nextHeaders.cookie

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

  return nextHeaders
}

function readResponseBody(response) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalLength = 0

    response.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > MAX_BODY_BYTES) {
        reject(new Error('LOCAL_RESPONSE_TOO_LARGE'))
        response.destroy()
        return
      }

      chunks.push(chunk)
    })
    response.on('end', () => resolve(Buffer.concat(chunks)))
    response.on('error', reject)
  })
}

function forwardToLocalServer({ localPort, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const requestBody = body ? Buffer.from(body, 'base64') : Buffer.alloc(0)
    const localPath = path?.startsWith('/') ? path : '/'
    const forwardedHeaders = sanitizeRequestHeaders(headers)

    if (requestBody.length > 0) forwardedHeaders['content-length'] = String(requestBody.length)
    forwardedHeaders.host = `127.0.0.1:${localPort}`
    forwardedHeaders['user-agent'] = 'ShortAppsHubClient/1.0'

    const localRequest = httpRequest(
      {
        host: '127.0.0.1',
        port: localPort,
        method,
        path: localPath,
        headers: forwardedHeaders,
        timeout: REQUEST_TIMEOUT_MS,
      },
      async (localResponse) => {
        try {
          const responseBody = await readResponseBody(localResponse)
          resolve({
            statusCode: localResponse.statusCode ?? 502,
            headers: sanitizeResponseHeaders(localResponse.headers),
            body: responseBody.toString('base64'),
          })
        } catch (error) {
          reject(error)
        }
      },
    )

    localRequest.on('timeout', () => {
      localRequest.destroy(new Error('LOCAL_REQUEST_TIMEOUT'))
    })
    localRequest.on('error', reject)

    if (requestBody.length > 0) localRequest.write(requestBody)
    localRequest.end()
  })
}

class ShortAppsHubClient {
  constructor({ localPort = SERVER_PORT, logger = console } = {}) {
    this.localPort = localPort
    this.logger = logger
    this.config = normalizeHubConfig()
    this.configTimer = null
    this.retryTimer = null
    this.pingTimer = null
    this.socket = null
    this.closed = false
    this.retryDelay = INITIAL_RETRY_MS
    this.status = {
      enabled: false,
      connected: false,
      state: 'disabled',
      machineId: '',
      url: '',
      lastError: '',
      connectedAt: '',
    }
  }

  start() {
    this.refreshConfig().catch((error) => {
      this.status.lastError = error.message
    })
    this.configTimer = setInterval(() => {
      this.refreshConfig().catch((error) => {
        this.status.lastError = error.message
      })
    }, CONFIG_POLL_MS)

    return this
  }

  close() {
    this.closed = true
    clearInterval(this.configTimer)
    clearTimeout(this.retryTimer)
    clearInterval(this.pingTimer)
    this.socket?.close()
    this.socket = null
  }

  getStatus() {
    return { ...this.status }
  }

  async refreshConfig() {
    const nextConfig = normalizeHubConfig(await readConfig())

    if (isSameHubConfig(this.config, nextConfig)) return

    this.config = nextConfig
    this.disconnect()

    this.status = {
      enabled: nextConfig.configured,
      connected: false,
      state: nextConfig.configured ? 'connecting' : 'disabled',
      machineId: nextConfig.machineId,
      url: nextConfig.tunnelUrl.replace('/tunnel/pc', ''),
      lastError: nextConfig.configured ? '' : 'HUB_NOT_CONFIGURED',
      connectedAt: '',
    }

    if (nextConfig.configured) this.connect()
  }

  disconnect() {
    clearTimeout(this.retryTimer)
    clearInterval(this.pingTimer)
    this.retryTimer = null
    this.pingTimer = null
    this.socket?.close()
    this.socket = null
    this.retryDelay = INITIAL_RETRY_MS
  }

  connect() {
    if (this.closed || !this.config.configured) return

    const socketUrl = new URL(this.config.tunnelUrl)
    socketUrl.searchParams.set('machineId', this.config.machineId)
    socketUrl.searchParams.set('version', '0.9.1')

    const socket = new WebSocket(socketUrl, {
      handshakeTimeout: 10000,
      maxPayload: MAX_TUNNEL_PAYLOAD_BYTES,
      perMessageDeflate: false,
      headers: {
        'x-shortapps-hub-secret': this.config.secret,
      },
    })

    this.socket = socket
    this.status.state = 'connecting'
    this.status.lastError = ''

    socket.on('open', () => {
      this.retryDelay = INITIAL_RETRY_MS
      this.status = {
        ...this.status,
        enabled: true,
        connected: true,
        state: 'connected',
        lastError: '',
        connectedAt: new Date().toISOString(),
      }
      this.pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.ping()
      }, 20000)
    })

    socket.on('message', (rawMessage) => {
      this.handleMessage(rawMessage).catch((error) => {
        this.status.lastError = error.message
      })
    })

    socket.on('error', (error) => {
      this.status.lastError = error.message
    })

    socket.on('close', () => {
      clearInterval(this.pingTimer)
      if (this.socket === socket) this.socket = null
      this.status = {
        ...this.status,
        connected: false,
        state: this.config.configured ? 'reconnecting' : 'disabled',
        connectedAt: '',
      }
      this.scheduleReconnect()
    })
  }

  scheduleReconnect() {
    if (this.closed || !this.config.configured || this.retryTimer) return

    const delay = this.retryDelay
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  async handleMessage(rawMessage) {
    const message = JSON.parse(rawMessage.toString('utf8'))
    if (message.type !== 'request' || !message.requestId) return

    try {
      if (!isAllowedTunneledRequest(message.path, message.method ?? 'GET')) {
        this.send({
          type: 'response',
          requestId: message.requestId,
          statusCode: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: Buffer.from(JSON.stringify({ error: 'HUB_ROUTE_NOT_ALLOWED' })).toString('base64'),
        })
        return
      }

      const response = await forwardToLocalServer({
        localPort: this.localPort,
        method: message.method ?? 'GET',
        path: message.path ?? '/',
        headers: message.headers ?? {},
        body: message.body ?? '',
      })

      this.send({
        type: 'response',
        requestId: message.requestId,
        ...response,
      })
    } catch (error) {
      this.send({
        type: 'response',
        requestId: message.requestId,
        statusCode: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: Buffer.from(
          JSON.stringify({ error: 'HUB_LOCAL_FORWARD_FAILED', message: error.message }),
        ).toString('base64'),
      })
    }
  }

  send(payload) {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify(payload))
  }
}

export function startHubClient(options = {}) {
  if (activeHubClient) return activeHubClient
  activeHubClient = new ShortAppsHubClient(options).start()
  return activeHubClient
}

export function getHubClientStatus() {
  return activeHubClient?.getStatus() ?? {
    enabled: false,
    connected: false,
    state: 'disabled',
    machineId: '',
    url: '',
    lastError: '',
    connectedAt: '',
  }
}

export async function refreshHubClientConfig() {
  if (!activeHubClient) return
  await activeHubClient.refreshConfig()
}
