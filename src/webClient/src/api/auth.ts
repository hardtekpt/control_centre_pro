/** Authentication token handling for the remote web client.
 *
 *  Flow:
 *  1. User scans the QR code → opens `http://<host>:<port>/?token=ABC`
 *  2. `bootstrapAuthFromUrl()` (called from main.tsx) reads `?token=` from the
 *     URL on first paint, stores it in localStorage, then strips it from the
 *     visible address bar so a casual screenshot doesn't leak it.
 *  3. `getAuthToken()` is consulted by `http.ts` and `websocket.ts` for every
 *     outbound request.
 *  4. When the server returns 401 or kicks the WS with code 1008, the app
 *     calls `clearAuthToken()` and shows the "unauthorized" screen. */

const STORAGE_KEY = 'ccpro.remoteAuthToken'

let _authFailed = false
let _onAuthFailed: (() => void) | null = null

/** Read `?token=` from the current URL, persist it, then clean the URL. */
export function bootstrapAuthFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem(STORAGE_KEY, token)
      params.delete('token')
      const q = params.toString()
      const newUrl = window.location.pathname + (q ? `?${q}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }
  } catch {
    // localStorage may be unavailable in private mode — fall through; the
    // user will simply see the unauthorized screen.
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearAuthToken(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

/** Signal that the server has rejected our token. Idempotent. */
export function notifyAuthFailed(): void {
  if (_authFailed) return
  _authFailed = true
  clearAuthToken()
  _onAuthFailed?.()
}

export function onAuthFailed(callback: () => void): void {
  _onAuthFailed = callback
  if (_authFailed) callback()
}

export function isAuthFailed(): boolean {
  return _authFailed
}
