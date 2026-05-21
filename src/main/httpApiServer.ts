import { createServer } from 'http'
import type { IncomingMessage, ServerResponse, Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { readFileSync, existsSync } from 'fs'
import { join, extname, resolve } from 'path'
import { networkInterfaces } from 'os'
import type { ServiceManager } from './services/serviceManager'
import type { SonarService } from './services/sonarService'
import type { SonarChannel, SonarMode } from '../shared/types'

interface ServerDeps {
  serviceManager: ServiceManager
  sonarService: SonarService
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

export class HttpApiServer {
  private server: Server
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()
  private port = 8080
  private deps: ServerDeps

  constructor(deps: ServerDeps) {
    this.deps = deps
    this.server = createServer((req, res) => {
      void this.handleRequest(req, res)
    })
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' })
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      // Send initial full-state snapshot so the client can sync immediately
      const arctis = this.deps.serviceManager.getArctisState()
      const sonar = this.deps.sonarService.getState()
      ws.send(JSON.stringify({ type: 'init', payload: { arctis, sonar } }))
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
    for (const client of this.clients) {
      client.terminate()
    }
    this.clients.clear()
    this.wss.close()
    this.server.close()
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // ── REST routes ──────────────────────────────────────────────────────────

    if (url === '/api/info' && method === 'GET') {
      return jsonResponse(res, 200, { url: this.getLanUrl(), port: this.port })
    }

    if (url === '/api/arctis/state' && method === 'GET') {
      return jsonResponse(res, 200, this.deps.serviceManager.getArctisState())
    }

    if (url === '/api/arctis/cmd' && method === 'POST') {
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

    if (url === '/api/sonar/state' && method === 'GET') {
      return jsonResponse(res, 200, this.deps.sonarService.getState())
    }

    if (url === '/api/sonar/volume' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.setVolume(body.channel as SonarChannel, body.volume as number)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (url === '/api/sonar/mute' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.setMute(body.channel as SonarChannel, body.muted as boolean)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (url === '/api/sonar/preset' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.selectPreset(body.presetId as string)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    if (url === '/api/sonar/mode' && method === 'POST') {
      try {
        const body = await readBody(req)
        await this.deps.sonarService.setMode(body.mode as SonarMode)
        return jsonResponse(res, 200, { ok: true })
      } catch {
        return jsonResponse(res, 400, { error: 'Bad request' })
      }
    }

    // ── Static file serving ───────────────────────────────────────────────────
    this.serveStatic(url, res)
  }
}
