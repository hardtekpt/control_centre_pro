import { useState, useEffect } from 'react'
import { useSonarStore } from '../stores/sonarStore'
import { ChannelMixer } from '../components/gg-sonar/ChannelMixer'
import { PresetEditor } from '../components/gg-sonar/PresetEditor'
import type { SonarConfig, SonarMode } from '@shared/types'

// ─── Section wrapper (matches Home.tsx pattern) ───────────────────────────────

function HomeSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wider px-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h2>
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
  const [editorConfig, setEditorConfig] = useState<SonarConfig | null>(null)

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
      <HomeSection title="Mixer">
        {/* Status + mode controls row */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              title={available ? 'Sonar connected' : 'Sonar not detected'}
              style={{ background: available ? '#5a9a5a' : 'var(--color-text-secondary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {available ? 'Connected' : 'Not detected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {available && (
              <div
                className="flex rounded overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}
              >
                {(['classic', 'streamer'] as SonarMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className="text-xs px-3 py-1 capitalize transition-colors"
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
                className="text-xs px-2 py-1 rounded"
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
          </div>
        </div>

        {available && sonarState ? (
          <ChannelMixer sonarState={sonarState} onPresetEdit={setEditorConfig} />
        ) : (
          <UnavailableState onRetry={handleRetry} />
        )}
      </HomeSection>

      {editorConfig && (
        <PresetEditor config={editorConfig} onClose={() => setEditorConfig(null)} />
      )}
    </div>
  )
}
