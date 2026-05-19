import { useEffect, useRef, useState } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
import { PageHeader, SettingSection, SettingsPageWrapper } from '../../components/SettingsComponents'
import type { LogEntry } from '@shared/types'

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

// ─── About page ───────────────────────────────────────────────────────────────

/** About page — version info and live service log */
export function About(): JSX.Element {
  const { logs } = useServiceStore()
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [logFilePath, setLogFilePath] = useState<string>('')

  // Auto-scroll to the latest entry within the log container (not the page)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

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
            { label: 'Version', value: '0.1.0' },
            { label: 'Platform', value: 'Windows' },
            { label: 'Framework', value: 'Electron + React' },
            { label: 'Build', value: 'Development' },
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

      <SettingSection title="Service Log">
        <div className="px-5 py-4">
          <div
            ref={logContainerRef}
            className="rounded overflow-y-auto font-mono text-xs"
            style={{
              height: 240,
              background: 'var(--color-code-bg)',
              border: '1px solid var(--color-border)',
              fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
              fontSize: '12px',
            }}
          >
            {logs.length === 0 ? (
              <div
                className="px-3 py-2"
                style={{
                  color: 'var(--color-text-secondary)',
                  opacity: 0.6,
                }}
              >
                Waiting for service output…
              </div>
            ) : (
              <>
                {logs.map((entry) => (
                  <LogRow key={entry.id} entry={entry} />
                ))}
              </>
            )}
          </div>

          <div className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Log file: </span>
            <span className="font-mono text-xs" style={{ wordBreak: 'break-all' }}>
              {logFilePath || 'Loading…'}
            </span>
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
            Logs are cleared and a new file is created each time the app starts
          </div>
        </div>
      </SettingSection>
        </SettingsPageWrapper>
      </div>
    </div>
  )
}
