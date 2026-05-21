import { createServer } from 'http'
import type { IncomingMessage, ServerResponse, Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { readFileSync, existsSync } from 'fs'
import { join, extname, resolve } from 'path'
import { networkInterfaces } from 'os'
import { URL } from 'url'
import type { ServiceManager } from './services/serviceManager'
import type { SonarService } from './services/sonarService'
import type { DdcService } from './services/apis/ddc/service'
import type { SonarChannel, SonarMode } from '../shared/types'

interface ServerDeps {
  serviceManager: ServiceManager
  sonarService: SonarService
  ddcService: DdcService
}

function getLanIp(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => {
      try {
        resolve(JSON.parse(data) as Record<string, unknown>)
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

/** Extract the auth token a request is presenting, either from
 *  `Authorization: Bearer <token>` or the `?token=` query string. */
function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers['authorization']
  if (typeof authHeader === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
    if (m) return m[1]
  }
  if (req.url) {
    try {
      const url = new URL(req.url, 'http://localhost')
      const q = url.searchParams.get('token')
      if (q) return q
    } catch { /* ignore malformed url */ }
  }
  return null
}

export class HttpApiServer {
  private server: Server
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()
  private port = 8080
  private deps: ServerDeps
  private authToken: string | null = null
  private tokenExpiresAt = 0   // 0 = never
  private expiryTimer: NodeJS.Timeout | null = null

  constructor(deps: ServerDeps) {
    this.deps = deps
    this.server = createServer((req, res) => {
      void this.handleRequest(req, res)
    })
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws',
      verifyClient: (info, cb) => {
        if (!this.isTokenValid(extractToken(info.req))) {
          cb(false, 401, 'Unauthorized')
          return
        }
        cb(true)
      },
    })
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      // Send initial full-state snapshot so the client can sync immediately
      const arctis = this.deps.serviceManager.getArctisState()
      const sonar = this.deps.sonarService.getState()
      const ddc = this.deps.ddcService.getCachedMonitors()
      ws.send(JSON.stringify({ type: 'init', payload: { arctis, sonar, ddc } }))
      ws.on('close', () => this.clients.delete(ws))
      ws.on('error', () => this.clients.delete(ws))
    })
  }

  start(port: number): void {
    this.port = port
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`[HttpApiServer] Listening on ${this.getLanUrl()}`)
    })
  }

  stop(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer)
      this.expiryTimer = null
    }
    for (const client of this.clients) {
      client.terminate()
    }
    this.clients.clear()
    this.wss.close()
    this.server.close()
  }

  /** Configure (or rotate) the auth token + absolute expiry.
   *  When the token changes, all currently-connected WS clients are kicked so
   *  they reconnect with fresh credentials. */
  setAuthToken(token: string, expiresAt: number): void {
    const tokenChanged = token !== this.authToken
    this.authToken = token || null
    this.tokenExpiresAt = expiresAt

    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer)
      this.expiryTimer = null
    }
    if (expiresAt > 0) {
      const ms = expiresAt - Date.now()
      if (ms > 0) {
        // Cap at ~24 days to stay within setTimeout safe range
        this.expiryTimer = setTimeout(() => this.kickAllClients(1008, 'token-expired'),
          Math.min(ms, 2_000_000_000))
      }
    }

    if (tokenChanged) {
      this.kickAllClients(1008, 'token-rotated')
    }
  }

  private kickAllClients(code: number, reason: string): void {
    for (const client of this.clients) {
      try { client.close(code, reason) } catch { /* ignore */ }
    }
    this.clients.clear()
  }

  private isTokenValid(token: string | null): boolean {
    if (!this.authToken) return false  // server requires a token; missing = closed
    if (!token) return false
    if (token !== this.authToken) return false
    if (this.tokenExpiresAt > 0 && Date.now() >= this.tokenExpiresAt) return false
    return true
  }

  /** Broadcast an event to all connected WebSocket clients.
   *  Clients whose send buffer exceeds 16 KB are silently skipped — they will
   *  re-sync via the `init` snapshot sent on reconnect. */
  broadcast(type: string, payload: unknown): void {
    const json = JSON.stringify({ type, payload })
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 16384) {
        client.send(json)
      }
    }
  }

  getLanUrl(): string {
    return `http://${getLanIp()}:${this.port}`
  }

  private staticRoot(): string {
    return join(__dirname, '../webClient')
  }

  private serveStatic(urlPath: string, res: ServerResponse): void {
    const root = this.staticRoot()
    const stripped = urlPath.split('?')[0]
    const normalized = stripped === '/' ? 'index.html' : stripped.replace(/^\//, '')
    const fullPath = resolve(join(root, normalized))

    // Prevent path traversal
    if (!fullPath.startsWith(root)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    if (existsSync(fullPath) && !fullPath.endsWith('/')) {
      const ext = extname(fullPath)
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream'
      try {
        const content = readFileSync(fullPath)
        res.writeHead(200, { 'Content-Type': mime })
        res.end(content)
      } catch {
        res.writeHead(500)
        res.end('Internal server error')
      }
    } else {
      // SPA fallback — any unmatched path serves index.html
      const indexPath = join(root, 'index.html')
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(content)
      } else {
        res.writeHead(503)
        res.end('Web client not built — run: npm run build:web')
      }
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? '/'
    const method = (req.method ?? 'GET').toUpperCase()

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Path-only (strip query string) for routing decisions
    const path = url.split('?')[0]

    // Gate all /api/* routes behind the auth token. Static files stay public so
    // the SPA can load and show a friendly "expired" screen on token failure.
    if (path.startsWith('/api/')) {
      if (!this.isTokenValid(extractToken(req))) {
        return jsonResponse(res, 401, { error: 'unauthorized' })
      }
    }

    // ── REST routes ──────────────────────────────────────────────────────────

    if (path === '/api/info' && method === 'GET') {
      return jsonResponse(res, 200, { url: this.getLanUrl(), port: this.port })
    }

    if (path === '/api/arctis/state' && method === 'GET') {
      return jsonResponse(res, 200, this.deps.serviceManager.getArctisState())
    }

    if (path === '/api/arctis/cmd' && method === 'POST') {
      try {
        const body = await readBody(req)
        const cmd = body.cmd as string
        const value = body.value
        this.deps.serviceManager.sendArctisCmd(cmd, value)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (path === '/api/sonar/state' && method === 'GET') {
      return jsonResponse(res, 200, this.deps.sonarService.getState())
    }

    if (path === '/api/sonar/volume' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.setVolume(body.channel as SonarChannel, body.volume as number)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (path === '/api/sonar/mute' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.setMute(body.channel as SonarChannel, body.muted as boolean)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (path === '/api/sonar/preset' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.selectPreset(body.presetId as string)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (path === '/api/sonar/mode' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.setMode(body.mode as SonarMode)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (path === '/api/ddc/monitors' && method === 'GET') {
      return jsonResponse(res, 200, this.deps.ddcService.getCachedMonitors())
    }

    if (path === '/api/ddc/brightness' && method === 'POST') {
      try {
        const body = await readBody(req)
        this.deps.ddcService.setBrightness(body.monitorId as number, body.brightness as number)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (path === '/api/ddc/input' && method === 'POST') {
      try {
        const body = await readBody(req)
        this.deps.ddcService.setInputSource(body.monitorId as number, body.input as string)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    // ── Static file serving ───────────────────────────────────────────────────
    this.serveStatic(url, res)
  }
}
