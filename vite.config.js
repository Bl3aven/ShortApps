import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createStatusPayload } from './server/network.js'
import { scanInstalledApps } from './server/app-scanner.js'
import { launchInstalledApp } from './server/app-launcher.js'
import { validateAppCatalog, validateAppTarget } from './server/app-validator.js'
import { sendKeyboardInput } from './server/keyboard-controller.js'
import { readConfig, writeConfig } from './server/config-store.js'

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

function shortAppsStatusPlugin() {
  return {
    name: 'shortapps-status',
    configureServer(server) {
      server.middlewares.use('/api/status', (_request, response) => {
        const devPort = Number(server.config.server.port ?? 5173)
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(
          JSON.stringify(
            createStatusPayload({
              httpPort: devPort,
              httpsPort: devPort,
              httpsAvailable: false,
            }),
          ),
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
            .then((payload) => writeConfig(payload.config ?? {}))
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
