import { useEffect } from 'react'
import type { ConnectionStatus } from '../App'

// ── Singleton WebSocket state ─────────────────────────────────────────────────

let ws: WebSocket | null = null
let _status: ConnectionStatus = 'disconnected'
let _statusCallback: ((s: ConnectionStatus) => void) | null = null
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _reconnectDelay = 1000 // ms, doubles on each failure up to 30s

const _handlers: Map<string, Set<(payload: unknown) => void>> = new Map()

function setStatus(status: ConnectionStatus): void {
  _status = status
  _statusCallback?.(status)
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return

  setStatus('reconnecting')
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${proto}//${window.location.host}/ws`)

  ws.onopen = () => {
    _reconnectDelay = 1000
    setStatus('connected')
  }

  ws.onmessage = (event: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(event.data) as { type: string; payload: unknown }
      const handlers = _handlers.get(msg.type)
      if (handlers) {
        for (const h of handlers) h(msg.payload)
      }
    } catch {
      // Silently ignore malformed messages
    }
  }

  ws.onclose = () => {
    ws = null
    setStatus('reconnecting')
    scheduleReconnect()
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function scheduleReconnect(): void {
  if (_reconnectTimer) return
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null
    _reconnectDelay = Math.min(_reconnectDelay * 2, 30000)
    connect()
  }, _reconnectDelay)
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Subscribe to a specific WebSocket message type. Returns a cleanup function. */
export function subscribeWsEvent(type: string, handler: (payload: unknown) => void): () => void {
  if (!_handlers.has(type)) _handlers.set(type, new Set())
  _handlers.get(type)!.add(handler)
  return () => {
    _handlers.get(type)?.delete(handler)
  }
}

interface UseWebSocketOptions {
  handlers?: Record<string, (payload: unknown) => void>
  onStatusChange?: (status: ConnectionStatus) => void
}

/** Hook — call once in App.tsx to establish and maintain the singleton connection. */
export function useWebSocket(options: UseWebSocketOptions): void {
  useEffect(() => {
    _statusCallback = options.onStatusChange ?? null

    // Register per-event-type handlers
    const cleanups: Array<() => void> = []
    for (const [type, handler] of Object.entries(options.handlers ?? {})) {
      cleanups.push(subscribeWsEvent(type, handler))
    }

    connect()

    // Report current status immediately (may already be connected from a prior render)
    options.onStatusChange?.(_status)

    return () => {
      for (const c of cleanups) c()
      _statusCallback = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
