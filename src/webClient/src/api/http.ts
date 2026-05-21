import { getAuthToken, notifyAuthFailed } from './auth'

function authHeaders(): HeadersInit {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function checkAuth(res: Response): void {
  if (res.status === 401) {
    notifyAuthFailed()
  }
}

/** Fetch a JSON resource from the API (relative URL). */
export async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { ...authHeaders() } })
  checkAuth(res)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/** POST a JSON body to the API and return the response. */
export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  checkAuth(res)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}
