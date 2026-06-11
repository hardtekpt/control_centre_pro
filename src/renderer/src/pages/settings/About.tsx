import { useEffect, useRef, useState } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { PageHeader, SettingSection, SettingsPageWrapper } from '../../components/SettingsComponents'
import type { LogEntry, PackagesState, PythonPackageInfo, UpdaterState } from '@shared/types'

// ─── Log entry row ────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }): JSX.Element {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      className="flex gap-2 px-3 py-0.5 leading-5"
      style={{
        fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)', opacity: 0.7, whiteSpace: 'nowrap' }}>
        {time}
      </span>
      <span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        [{entry.serviceName}]
      </span>
      <span
        style={{
          color:
            entry.level === 'error'
              ? 'var(--color-text-primary)'
              : 'var(--color-text-secondary)',
          fontWeight: entry.level === 'error' ? 600 : 400,
          wordBreak: 'break-all',
        }}
      >
        {entry.message}
      </span>
    </div>
  )
}

// ─── Python dependency row ────────────────────────────────────────────────────

function PackageRow({
  pkg,
  checking,
  last,
}: {
  pkg: PythonPackageInfo
  checking: boolean
  last: boolean
}): JSX.Element {
  let status: string
  if (pkg.busy) status = 'Updating…'
  else if (pkg.error) status = pkg.error
  else if (checking) status = 'Checking…'
  else if (pkg.installed === null) status = 'Not installed'
  else if (pkg.updateAvailable && pkg.latest) status = `v${pkg.latest} available`
  else status = 'Up to date'

  const canUpdate = pkg.updateAvailable && !pkg.busy

  return (
    <div
      className="px-5 py-3.5"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '16px',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {pkg.label}
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}
        >
          {pkg.installed ? `installed ${pkg.installed}` : 'not installed'}
          {pkg.repo ? ` · ${pkg.repo}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          className="text-sm"
          style={{ color: pkg.error ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
        >
          {status}
        </span>
        {canUpdate && (
          <button
            onClick={() => window.api.packagesUpdate(pkg.id).catch(console.error)}
            className="text-sm px-3 py-1.5 rounded font-medium"
            style={{
              background: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-bg)',
              cursor: 'pointer',
            }}
          >
            Update
          </button>
        )}
      </div>
    </div>
  )
}

// ─── About page ───────────────────────────────────────────────────────────────

/** About page — version info and live service log */
export function About(): JSX.Element {
  const { logs } = useServiceStore()
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [logFilePath, setLogFilePath] = useState<string>('')
  const [updaterState, setUpdaterState] = useState<UpdaterState>({
    status: 'idle', currentVersion: null, availableVersion: null, progress: null, error: null,
  })
  const [packagesState, setPackagesState] = useState<PackagesState>({ status: 'idle', packages: [] })

  // Auto-scroll to the latest entry within the log container (not the page)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    window.api.updaterGetState().then(setUpdaterState).catch(console.error)
    return window.api.onUpdaterStateChange(setUpdaterState)
  }, [])

  useEffect(() => {
    window.api.packagesGetState().then(setPackagesState).catch(console.error)
    return window.api.onPackagesStateChange(setPackagesState)
  }, [])

  // Load log file path
  useEffect(() => {
    window.api.getServiceLogFilePath().then(setLogFilePath).catch(console.error)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="About" description="Application information and live service logs" />
      <div className="flex-1 overflow-y-auto">
        <SettingsPageWrapper>
          <SettingSection title="Application">
            <div>
              {[
                { label: 'Version', value: updaterState.currentVersion ?? '…' },
                { label: 'Platform', value: 'Windows' },
                { label: 'Electron', value: window.api.appInfo.electron },
                { label: 'Build', value: window.api.appInfo.build },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  className="px-5 py-3.5"
                  style={{
                    borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '16px',
                    alignItems: 'center',
                  }}
                >
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {row.label}
                  </span>
                  <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </SettingSection>
          <SettingSection title="Updates">
            <div className="px-5 py-3.5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {updaterState.status === 'idle'          && 'No update check run yet'}
                  {updaterState.status === 'checking'      && 'Checking for updates…'}
                  {updaterState.status === 'not-available' && 'You are on the latest version'}
                  {updaterState.status === 'available'     && `v${updaterState.availableVersion} available — downloading…`}
                  {updaterState.status === 'downloading'   && `Downloading… ${updaterState.progress ?? 0}%`}
                  {updaterState.status === 'downloaded'    && `v${updaterState.availableVersion} ready to install`}
                  {updaterState.status === 'error'         && `Update error: ${updaterState.error}`}
                </span>
                {updaterState.status !== 'downloaded' && (
                  <button
                    onClick={() => window.api.updaterCheck().catch(console.error)}
                    disabled={updaterState.status === 'checking' || updaterState.status === 'downloading'}
                    className="text-sm px-3 py-1.5 rounded"
                    style={{
                      background: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      cursor: (updaterState.status === 'checking' || updaterState.status === 'downloading') ? 'default' : 'pointer',
                      opacity: (updaterState.status === 'checking' || updaterState.status === 'downloading') ? 0.5 : 1,
                    }}
                  >
                    Check for updates
                  </button>
                )}
                {updaterState.status === 'downloaded' && (
                  <button
                    onClick={() => window.api.updaterInstall().catch(console.error)}
                    className="text-sm px-3 py-1.5 rounded font-medium"
                    style={{
                      background: 'var(--color-accent)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-bg)',
                      cursor: 'pointer',
                    }}
                  >
                    Restart to install
                  </button>
                )}
              </div>
              {updaterState.status === 'downloading' && updaterState.progress !== null && (
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${updaterState.progress}%`, height: '100%',
                    background: 'var(--color-accent)', transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </div>
          </SettingSection>
          <SettingSection title="Python Dependencies">
            <div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Hardware service packages installed in the bundled Python runtime
                </span>
                <button
                  onClick={() => window.api.packagesCheck().catch(console.error)}
                  disabled={packagesState.status !== 'idle'}
                  className="text-sm px-3 py-1.5 rounded"
                  style={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    cursor: packagesState.status !== 'idle' ? 'default' : 'pointer',
                    opacity: packagesState.status !== 'idle' ? 0.5 : 1,
                  }}
                >
                  {packagesState.status === 'checking' ? 'Checking…' : 'Check for updates'}
                </button>
              </div>
              {packagesState.packages.length === 0 ? (
                <div className="px-5 py-3.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No managed packages
                </div>
              ) : (
                packagesState.packages.map((pkg, i, arr) => (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    checking={packagesState.status === 'checking'}
                    last={i === arr.length - 1}
                  />
                ))
              )}
            </div>
          </SettingSection>
          <SettingSection>
            <div
              ref={logContainerRef}
              className="overflow-y-auto"
              style={{
                height: 240,
                background: 'var(--color-code-bg)',
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
                fontSize: '12px',
              }}
            >
              {logs.length === 0 ? (
                <div
                  className="px-3 py-2"
                  style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}
                >
                  Waiting for service output…
                </div>
              ) : (
                logs.map((entry) => <LogRow key={entry.id} entry={entry} />)
              )}
            </div>
          </SettingSection>
        </SettingsPageWrapper>

        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '0 0 16px' }}>
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Log file: </span>
            <span className="font-mono text-xs" style={{ wordBreak: 'break-all' }}>
              {logFilePath || 'Loading…'}
            </span>
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
            Logs are cleared and a new file is created each time the app starts
          </div>
        </div>
      </div>
    </div>
  )
}
