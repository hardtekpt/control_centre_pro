import { useState } from 'react'
import { useSonarStore } from '../stores/sonarStore'
import { ChannelMixer } from '../components/gg-sonar/ChannelMixer'
import { PresetEditor } from '../components/gg-sonar/PresetEditor'
import type { SonarConfig, SonarMode } from '@shared/types'

// ─── Header ───────────────────────────────────────────────────────────────────

function SonarPageHeader({
  available,
  mode,
  onModeChange,
  onRetry,
}: {
  available: boolean
  mode: SonarMode
  onModeChange: (m: SonarMode) => void
  onRetry: () => void
}): JSX.Element {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Left: status + title */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          title={available ? 'Sonar connected' : 'Sonar not detected'}
          style={{ background: available ? '#5a9a5a' : 'var(--color-text-secondary)' }}
        />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          GG Sonar
        </span>
        {!available && (
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            — not detected
          </span>
        )}
      </div>

      {/* Right: mode toggle + retry */}
      <div className="flex items-center gap-2">
        {available && (
          <div
            className="flex rounded overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {(['classic', 'streamer'] as SonarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className="text-xs px-3 py-1 capitalize transition-colors"
                style={{
                  background: mode === m ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                  color: mode === m ? 'var(--color-bg)' : 'var(--color-text-secondary)',
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
            onClick={onRetry}
            className="text-xs px-3 py-1.5 rounded"
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
  )
}

// ─── Unavailable state ────────────────────────────────────────────────────────

function UnavailableState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <SonarIcon />
      </div>
      <div>
        <h1
          className="text-2xl font-semibold mb-2 tracking-tight"
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
  const { sonarState } = useSonarStore()
  const [editorConfig, setEditorConfig] = useState<SonarConfig | null>(null)

  function handleRetry(): void {
    window.api.sonarGetState().catch(console.error)
  }

  function handleModeChange(mode: SonarMode): void {
    window.api.sonarSetMode(mode).catch(console.error)
  }

  const available = sonarState?.available ?? false

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg)' }}
    >
      <SonarPageHeader
        available={available}
        mode={sonarState?.mode ?? 'classic'}
        onModeChange={handleModeChange}
        onRetry={handleRetry}
      />

      {available && sonarState ? (
        <div className="flex-1 overflow-hidden p-1.5">
          <div
            className="h-full rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}
          >
            <ChannelMixer sonarState={sonarState} onPresetEdit={setEditorConfig} />
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <UnavailableState onRetry={handleRetry} />
        </div>
      )}

      {editorConfig && (
        <PresetEditor config={editorConfig} onClose={() => setEditorConfig(null)} />
      )}
    </div>
  )
}
