import type { SonarConfig, SonarConfigData } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  master: 'Master',
  game: 'Game',
  chatRender: 'Chat Output',
  chatCapture: 'Mic Input',
  media: 'Media',
  aux: 'Aux',
}

function isVoiceChannel(virtualAudioDevice: string): boolean {
  return virtualAudioDevice === 'chatRender' || virtualAudioDevice === 'chatCapture'
}

// ─── Row primitives ───────────────────────────────────────────────────────────

function DataRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
        {children}
      </span>
    </div>
  )
}

function EnabledBadge({ enabled }: { enabled: boolean | undefined }): JSX.Element {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{
        background: enabled ? 'var(--color-accent-subtle)' : 'var(--color-surface-raised)',
        color: enabled ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      {enabled ? 'On' : 'Off'}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-4">
      <h3
        className="text-xs font-semibold tracking-wide uppercase mb-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h3>
      <div
        className="rounded-md overflow-hidden"
        style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        <div className="px-3">{children}</div>
      </div>
    </div>
  )
}

// ─── Output channel data ──────────────────────────────────────────────────────

function OutputData({ data }: { data: SonarConfigData }): JSX.Element {
  return (
    <>
      <Section title="Volume Boost">
        <DataRow label="Bass Boost">
          <span className="flex items-center gap-2">
            <EnabledBadge enabled={data.bassBoostState?.enabled} />
            {data.bassBoostState?.enabled && (
              <span className="mono">{data.bassBoostState.value}</span>
            )}
          </span>
        </DataRow>
        <DataRow label="Treble Boost">
          <span className="flex items-center gap-2">
            <EnabledBadge enabled={data.trebleBoostState?.enabled} />
            {data.trebleBoostState?.enabled && (
              <span className="mono">{data.trebleBoostState.value}</span>
            )}
          </span>
        </DataRow>
        <DataRow label="Voice Clarity">
          <span className="flex items-center gap-2">
            <EnabledBadge enabled={data.voiceClarityState?.enabled} />
            {data.voiceClarityState?.enabled && (
              <span className="mono">{data.voiceClarityState.value}</span>
            )}
          </span>
        </DataRow>
        {data.generalGain !== undefined && (
          <DataRow label="General Gain">
            <span className="mono">{data.generalGain} dB</span>
          </DataRow>
        )}
      </Section>

      <Section title="Smart Volume">
        <DataRow label="Enabled">
          <EnabledBadge enabled={data.smartVolume?.enabled} />
        </DataRow>
        {data.smartVolume?.enabled && (
          <>
            <DataRow label="Loudness">
              <span className="capitalize">{data.smartVolume.loudness}</span>
            </DataRow>
            <DataRow label="Volume Level">
              <span className="mono">{data.smartVolume.volumeLevel}</span>
            </DataRow>
          </>
        )}
      </Section>

      <Section title="Spatial Audio">
        <DataRow label="Virtual Surround">
          <EnabledBadge enabled={data.virtualSurroundState} />
        </DataRow>
        {data.reverbGainDB !== undefined && (
          <DataRow label="Reverb Gain">
            <span className="mono">{data.reverbGainDB} dB</span>
          </DataRow>
        )}
        {data.formFactor && (
          <DataRow label="Form Factor">
            <span className="capitalize">{data.formFactor}</span>
          </DataRow>
        )}
      </Section>

      <Section title="EQ">
        <DataRow label="Parametric EQ">
          <EnabledBadge enabled={data.parametricEQ?.enabled} />
        </DataRow>
      </Section>

      {data.globalEnableState !== undefined && (
        <Section title="Processing">
          <DataRow label="Global Enable">
            <EnabledBadge enabled={data.globalEnableState} />
          </DataRow>
        </Section>
      )}
    </>
  )
}

// ─── Voice channel data ───────────────────────────────────────────────────────

function VoiceData({ data }: { data: SonarConfigData }): JSX.Element {
  const features: { label: string; enabled: boolean | undefined }[] = [
    { label: 'Noise Reduction', enabled: data.noiseReductionState?.enabled },
    { label: 'Volume Stabilizer', enabled: data.volumeStabilizerState?.enabled },
    { label: 'Noise Gate', enabled: data.noiseGateState?.enabled },
    { label: 'Auto Noise Gate', enabled: data.automaticNoiseGateState?.enabled },
    { label: 'Impact Noise Reduction', enabled: data.impactNoiseReductionState?.enabled },
    { label: 'Noise Canceling', enabled: data.noiseCancelingState?.enabled },
    { label: 'Echo Canceling', enabled: data.acousticEchoCancelingState?.enabled },
  ].filter((f) => f.enabled !== undefined)

  return (
    <>
      <Section title="Noise Processing">
        {features.length > 0 ? (
          features.map((f) => (
            <DataRow key={f.label} label={f.label}>
              <EnabledBadge enabled={f.enabled} />
            </DataRow>
          ))
        ) : (
          <DataRow label="No data available">
            <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
          </DataRow>
        )}
      </Section>

      <Section title="EQ">
        <DataRow label="Parametric EQ">
          <EnabledBadge enabled={data.parametricEQ?.enabled} />
        </DataRow>
      </Section>

      {data.globalEnableState !== undefined && (
        <Section title="Processing">
          <DataRow label="Global Enable">
            <EnabledBadge enabled={data.globalEnableState} />
          </DataRow>
        </Section>
      )}
    </>
  )
}

// ─── PresetEditor ─────────────────────────────────────────────────────────────

interface PresetEditorProps {
  config: SonarConfig
  onClose: () => void
}

export function PresetEditor({ config, onClose }: PresetEditorProps): JSX.Element {
  const voice = isVoiceChannel(config.virtualAudioDevice)

  return (
    <div
      className="fixed top-0 right-0 bottom-0 flex flex-col"
      style={{
        width: 320,
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {config.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {CHANNEL_LABELS[config.virtualAudioDevice] ?? config.virtualAudioDevice}
            </span>
            {config.isFavorite && (
              <span style={{ color: '#c8960a', fontSize: 13 }}>★</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-sm px-2 py-1 rounded ml-3 flex-shrink-0"
          style={{
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* Read-only notice */}
      <div
        className="px-4 py-2 text-xs flex-shrink-0"
        style={{
          color: 'var(--color-text-secondary)',
          background: 'var(--color-surface-raised)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        Read-only — preset write endpoints under investigation
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 selectable">
        {voice ? <VoiceData data={config.data} /> : <OutputData data={config.data} />}

        {/* Favorites */}
        {config.isFavorite && (
          <Section title="Favorites">
            <DataRow label="Position">
              <span className="mono">#{config.favoritePosition}</span>
            </DataRow>
          </Section>
        )}

        {/* Metadata */}
        <Section title="Info">
          {config.isPreset && (
            <DataRow label="Type">
              <span>Built-in preset</span>
            </DataRow>
          )}
          <DataRow label="Updated">
            <span>{new Date(config.updatedAt).toLocaleDateString()}</span>
          </DataRow>
        </Section>
      </div>
    </div>
  )
}
