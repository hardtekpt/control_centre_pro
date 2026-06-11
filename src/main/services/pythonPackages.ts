import { execFile, spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { net } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { PackagesState, PythonPackageInfo } from '../../shared/types'
import type { ServiceManager } from './serviceManager'

// ─── Managed packages ─────────────────────────────────────────────────────────

interface ManagedPackage {
  id: string
  label: string
  importName: string  // top-level import package
  repo: string        // GitHub owner/repo publishing release wheels
  serviceId: string   // linked Python service to restart after an update
}

const PACKAGES: ManagedPackage[] = [
  {
    id: 'steelseries-gg',
    label: 'GG Sonar (steelseries_gg)',
    importName: 'steelseries_gg',
    repo: 'hardtekpt/steelseries_gg_py',
    serviceId: 'gg-sonar',
  },
  {
    id: 'arctis-hid',
    label: 'Arctis HID (arctis_hid)',
    importName: 'arctis_hid',
    repo: 'hardtekpt/arctis_nova_pro_hid',
    serviceId: 'arctis-hid',
  },
]

// Python snippet that prints {importName: version|null} as JSON for the installed packages.
const VERSION_SCRIPT = `import importlib.metadata as m, json
try:
    pd = m.packages_distributions()
except Exception:
    pd = {}
out = {}
for imp in ${JSON.stringify(PACKAGES.map((p) => p.importName))}:
    v = None
    for d in (pd.get(imp) or [imp]):
        try:
            v = m.version(d); break
        except Exception:
            pass
    out[imp] = v
print(json.dumps(out))`

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compare two loose version strings; true when `latest` is strictly newer than `installed`. */
function isNewer(latest: string, installed: string): boolean {
  const parse = (s: string): number[] =>
    s.replace(/^v/i, '').split(/[.\-+_]/).map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n))
  const a = parse(latest)
  const b = parse(installed)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

/** GET a URL via Electron net (follows redirects, respects system proxy). */
function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = net.request(url)
    req.setHeader('User-Agent', 'Control-Centre-Pro')
    req.setHeader('Accept', 'application/vnd.github+json')
    let body = ''
    req.on('response', (res) => {
      res.on('data', (chunk) => { body += chunk.toString() })
      res.on('end', () => resolve({ status: res.statusCode, body }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

/** Download a URL to a local file via Electron net. */
function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = net.request(url)
    req.setHeader('User-Agent', 'Control-Centre-Pro')
    const file = createWriteStream(dest)
    file.on('error', reject)
    req.on('response', (res) => {
      if (res.statusCode >= 400) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`))
        return
      }
      res.on('data', (chunk) => file.write(chunk))
      res.on('end', () => file.end(() => resolve()))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

// ─── Manager ──────────────────────────────────────────────────────────────────

/**
 * Reads installed versions of the bundled hardware packages, checks each repo's
 * latest GitHub Release for a newer wheel, and installs updates into the same
 * interpreter the services run under. Mirrors the auto-updater's state-push shape.
 */
export class PythonPackageManager {
  private window: BrowserWindow | null = null
  private state: PackagesState
  // Latest release wheel download URL per package id, captured during check()
  private wheelUrls = new Map<string, string>()

  constructor(private readonly services: ServiceManager) {
    this.state = {
      status: 'idle',
      packages: PACKAGES.map((p) => ({
        id: p.id,
        label: p.label,
        importName: p.importName,
        repo: p.repo,
        installed: null,
        latest: null,
        updateAvailable: false,
        busy: false,
        error: null,
      })),
    }
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  getState(): PackagesState {
    return this.state
  }

  private push(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.PACKAGES_STATE_CHANGE, this.state)
    }
  }

  private patchPackage(id: string, patch: Partial<PythonPackageInfo>): void {
    this.state = {
      ...this.state,
      packages: this.state.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }
    // Keep the renderer-facing flag in sync with installed/latest/wheel availability
    this.state = {
      ...this.state,
      packages: this.state.packages.map((p) =>
        p.id === id ? { ...p, updateAvailable: this.hasUpdate(id) } : p,
      ),
    }
  }

  /** Read installed versions from the active interpreter and push the result. */
  async refreshInstalled(): Promise<void> {
    const python = this.services.getPythonPath()
    try {
      const versions = await new Promise<Record<string, string | null>>((resolve, reject) => {
        execFile(python, ['-c', VERSION_SCRIPT], { timeout: 15000 }, (err, stdout) => {
          if (err) return reject(err)
          try {
            resolve(JSON.parse(stdout.trim()) as Record<string, string | null>)
          } catch (e) {
            reject(e as Error)
          }
        })
      })
      for (const p of PACKAGES) {
        this.patchPackage(p.id, { installed: versions[p.importName] ?? null })
      }
    } catch {
      // Interpreter missing / not runnable — leave installed versions as null
      for (const p of PACKAGES) this.patchPackage(p.id, { installed: null })
    }
    this.push()
  }

  /** Query each repo's latest release for the version + wheel asset URL. */
  async check(): Promise<void> {
    this.state = { ...this.state, status: 'checking' }
    this.push()
    await this.refreshInstalled()

    for (const p of PACKAGES) {
      try {
        const { status, body } = await httpGet(`https://api.github.com/repos/${p.repo}/releases/latest`)
        if (status === 404) {
          // No releases published yet — not an error, just unknown
          this.patchPackage(p.id, { latest: null, error: null })
          this.wheelUrls.delete(p.id)
          continue
        }
        if (status >= 400) throw new Error(`GitHub API HTTP ${status}`)
        const release = JSON.parse(body) as {
          tag_name?: string
          assets?: Array<{ name: string; browser_download_url: string }>
        }
        const latest = (release.tag_name ?? '').replace(/^v/i, '') || null
        const wheel = (release.assets ?? []).find((a) => a.name.toLowerCase().endsWith('.whl'))
        if (wheel) this.wheelUrls.set(p.id, wheel.browser_download_url)
        else this.wheelUrls.delete(p.id)
        this.patchPackage(p.id, { latest, error: null })
      } catch (err) {
        this.patchPackage(p.id, { error: (err as Error).message })
      }
    }

    this.state = { ...this.state, status: 'idle' }
    this.push()
  }

  /** Returns true when a newer release wheel is available for the given package. */
  hasUpdate(id: string): boolean {
    const info = this.state.packages.find((p) => p.id === id)
    if (!info || !info.latest || !this.wheelUrls.has(id)) return false
    if (!info.installed) return true
    return isNewer(info.latest, info.installed)
  }

  /** Download the latest wheel and pip-install it into the active interpreter, then restart the linked service. */
  async update(id: string): Promise<void> {
    const def = PACKAGES.find((p) => p.id === id)
    if (!def) throw new Error(`Unknown package: ${id}`)

    // Make sure we know the latest wheel URL
    if (!this.wheelUrls.has(id)) await this.check()
    const wheelUrl = this.wheelUrls.get(id)
    if (!wheelUrl) {
      this.patchPackage(id, { error: 'No release wheel available to install' })
      this.push()
      return
    }

    this.state = { ...this.state, status: 'updating' }
    this.patchPackage(id, { busy: true, error: null })
    this.push()

    const log = (level: 'info' | 'warn' | 'error', msg: string): void =>
      this.services.emitNativeLog('packages', 'Packages', level, msg)

    let tmp: string | null = null
    try {
      tmp = await mkdtemp(join(tmpdir(), 'ccpro-pkg-'))
      const wheelName = decodeURIComponent(wheelUrl.split('/').pop() || `${def.importName}.whl`)
      const wheelPath = join(tmp, wheelName)

      log('info', `Downloading ${def.label} → ${wheelName}`)
      await download(wheelUrl, wheelPath)

      log('info', `Installing ${wheelName} …`)
      await this.pipInstall(wheelPath, log)

      log('info', `${def.label} updated — restarting service`)
      this.services.restartIfEnabled(def.serviceId)
    } catch (err) {
      const message = (err as Error).message
      this.patchPackage(id, { error: message })
      log('error', `${def.label} update failed: ${message}`)
    } finally {
      if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {})
      this.patchPackage(id, { busy: false })
      this.state = { ...this.state, status: 'idle' }
      await this.refreshInstalled()
    }
  }

  /** Run pip install for a wheel, streaming output to the service log terminal. */
  private pipInstall(wheelPath: string, log: (level: 'info' | 'warn' | 'error', msg: string) => void): Promise<void> {
    const python = this.services.getPythonPath()
    return new Promise<void>((resolve, reject) => {
      // --no-deps: dependencies are already present from the bundled env; avoid
      // touching the rest of the environment during an in-app update.
      const child = spawn(python, ['-m', 'pip', 'install', '--upgrade', '--force-reinstall', '--no-deps', wheelPath])
      const onLine = (level: 'info' | 'error') => (chunk: Buffer): void => {
        for (const line of chunk.toString().split('\n')) {
          const t = line.trim()
          if (t) log(level, t)
        }
      }
      child.stdout.on('data', onLine('info'))
      child.stderr.on('data', onLine('error'))
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`pip exited with code ${code ?? 'unknown'}`))
      })
    })
  }
}
