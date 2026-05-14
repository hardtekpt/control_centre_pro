import { useEffect } from 'react'
import { useSonarStore } from '../stores/sonarStore'
import { useAppStore } from '../stores/appStore'
import { ChannelMixer } from '../components/gg-sonar/ChannelMixer'
import type { SonarMode } from '@shared/types'

// ─── Section wrapper (matches Home.tsx pattern) ───────────────────────────────

function SettingsIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function HomeSection({
  title,
  action,
  children,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ─── Unavailable state ────────────────────────────────────────────────────────

function UnavailableState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center gap-5 p-8 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', minHeight: 200 }}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
      >
        <SonarIcon />
      </div>
      <div>
        <h1
          className="text-xl font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          GG Sonar Not Detected
        </h1>
        <p
          className="text-sm max-w-xs mx-auto"
          style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}
        >
          Make sure SteelSeries GG is running with Sonar enabled. The app will connect automatically.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="text-sm px-4 py-2 rounded"
        style={{
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        ↺ Check Again
      </button>
    </div>
  )
}

function SonarIcon(): JSX.Element {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <circle cx="7" cy="7" r="1.5" />
      <path d="M4 7a3 3 0 0 0 6 0M2 7a5 5 0 0 0 10 0" />
    </svg>
  )
}

// ─── GGSonar page ─────────────────────────────────────────────────────────────

export function GGSonar(): JSX.Element {
  const { sonarState, setSonarState } = useSonarStore()
  const { setView, setSettingsTab } = useAppStore()

  // Fetch fresh state on page mount (covers navigation to this page)
  useEffect(() => {
    window.api.sonarGetState().then(setSonarState).catch(console.error)
  }, [setSonarState])

  function handleRetry(): void {
    window.api.sonarGetState().then(setSonarState).catch(console.error)
  }

  function handleModeChange(mode: SonarMode): void {
    window.api.sonarSetMode(mode).catch(console.error)
  }

  const available = sonarState?.available ?? false

  return (
    <div
      className="flex flex-col gap-6 p-6 overflow-y-auto h-full"
      style={{ background: 'var(--color-bg)' }}
    >
      <HomeSection
        title={
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              title={available ? 'Sonar connected' : 'Sonar not detected'}
              style={{ background: available ? '#5a9a5a' : 'var(--color-text-secondary)' }}
            />
            <span>Mixer</span>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            {available && (
              <div
                className="flex rounded overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}
              >
                {(['classic', 'streamer'] as SonarMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className="text-xs px-2 py-0.5 capitalize transition-colors"
                    style={{
                      background: sonarState?.mode === m ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                      color: sonarState?.mode === m ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      border: 'none',
                      outline: 'none',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {!available && (
              <button
                onClick={handleRetry}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                ↺ Retry
              </button>
            )}
            {/* GG Sonar settings shortcut */}
            <button
              onClick={() => { setSettingsTab('gg-sonar'); setView('settings') }}
              title="GG Sonar settings"
              className="rounded flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <SettingsIcon />
            </button>
          </div>
        }
      >
        {available && sonarState ? (
          <ChannelMixer sonarState={sonarState} />
        ) : (
          <UnavailableState onRetry={handleRetry} />
        )}
      </HomeSection>
    </div>
  )
}
