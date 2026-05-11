import { useEffect, useRef } from 'react'
import { useServiceStore } from '../../stores/serviceStore'
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
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest entry whenever logs update
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div>
      <div className="mb-7">
        <h2
          className="text-lg font-semibold mb-1 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          About
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Mission Control version and build information
        </p>
      </div>

      <div
        className="max-w-lg rounded-lg overflow-hidden mb-6"
        style={{ border: '1px solid var(--color-border)' }}
      >
        {[
          { label: 'Version', value: '0.1.0' },
          { label: 'Platform', value: 'Windows' },
          { label: 'Framework', value: 'Electron + React' },
          { label: 'Build', value: 'Development' },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: 'var(--color-surface)',
              borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {row.label}
            </span>
            <span
              className="text-sm mono"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Service log terminal */}
      <section>
        <h3
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Service Log
        </h3>
        <div
          className="rounded-lg overflow-y-auto"
          style={{
            height: 280,
            background: 'var(--color-code-bg)',
            border: '1px solid var(--color-border)',
          }}
        >
          {logs.length === 0 ? (
            <div
              className="px-3 py-2"
              style={{
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
                fontSize: 12,
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
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </section>
    </div>
  )
}
