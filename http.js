/**
 * Browser HTTP surface for the Metrics dashboard.
 *
 * Mounted as one `prefix` route at `/dsh-metrics` on the Harness web server, so
 * the page fetches it same-origin and no extra port or CORS layer exists.
 */

import { readFile } from 'node:fs/promises'
import { isId, readJsonBody } from './store.js'

const PREFIX = '/dsh-metrics'

function send(response, status, body, type = 'application/json; charset=utf-8') {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')
  response.writeHead(status, {
    'content-type': type,
    'content-length': payload.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(payload)
}

function sendJson(response, status, value) {
  send(response, status, `${JSON.stringify(value)}\n`)
}

function fail(response, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500
  sendJson(response, status, { error: error instanceof Error ? error.message : String(error) })
}

/**
 * Build the route handler.
 * @param {{ store: import('./store.js').MetricsStore, sdkPath: string, version: string }} options
 */
export function createMetricsHandler({ store, sdkPath, version }) {
  return async function handle(request, response) {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
        response.writeHead(405, { allow: 'GET, HEAD, POST' })
        response.end()
        return
      }
      const url = new URL(request.url ?? '/', 'http://dsh.invalid')
      if (!url.pathname.startsWith(PREFIX)) {
        sendJson(response, 404, { error: 'not found' })
        return
      }
      const route = url.pathname.slice(PREFIX.length).replace(/\/+$/, '') || '/'

      if (route === '/api/state' && request.method !== 'POST') {
        const runs = await store.listRuns()
        sendJson(response, 200, {
          version,
          root: store.root,
          sdkUrl: `${PREFIX}/sdk/dsh_metrics.py`,
          runs,
        })
        return
      }

      if (route === '/api/run' && request.method !== 'POST') {
        const project = url.searchParams.get('project') ?? ''
        const run = url.searchParams.get('run') ?? ''
        if (!isId(project) || !isId(run)) {
          sendJson(response, 400, { error: 'project and run are required' })
          return
        }
        const summary = await store.summary(project, run, { withSeries: true })
        sendJson(response, 200, summary)
        return
      }

      if (route === '/api/log') {
        requirePost(request, response)
        if (response.writableEnded) return
        const body = await readJsonBody(request)
        if (body === null || typeof body !== 'object') throw Object.assign(new Error('invalid payload'), { statusCode: 400 })
        const summary = await store.log(body)
        sendJson(response, 200, summary)
        return
      }

      if (route === '/api/delete') {
        requirePost(request, response)
        if (response.writableEnded) return
        const body = await readJsonBody(request)
        const project = typeof body?.project === 'string' ? body.project : ''
        const run = typeof body?.run === 'string' ? body.run : ''
        if (!isId(project) || !isId(run)) throw Object.assign(new Error('project and run are required'), { statusCode: 400 })
        sendJson(response, 200, await store.deleteRun(project, run))
        return
      }

      if (route === '/sdk/dsh_metrics.py' && request.method !== 'POST') {
        const source = await readFile(sdkPath)
        send(response, 200, source, 'text/x-python; charset=utf-8')
        return
      }

      sendJson(response, 404, { error: `unknown metrics route: ${route}` })
    } catch (error) {
      if (!response.headersSent) fail(response, error)
      else response.end()
    }
  }
}

function requirePost(request, response) {
  if (request.method === 'POST') return
  sendJson(response, 405, { error: 'POST required' })
}
