import { useSonarStore } from '../stores/sonarStore'
import { sonarSetVolume, sonarSetMute, sonarSelectPreset, sonarSetMode } from '../stores/sonarStore'
import type { SonarChannel } from '@shared/types'

const CHANNEL_LABELS: Record<SonarChannel, string> = {
  master: 'Master',
  game: 'Game',
  chatRender: 'Chat',
  chatCapture: 'Mic',
  media: 'Media',
  aux: 'Aux',
}

const CHANNELS: SonarChannel[] = ['master', 'game', 'chatRender', 'chatCapture', 'media', 'aux']

export function Sonar(): JSX.Element {
  const sonarState = useSonarStore((s) => s.sonarState)
  const activePresetIds = useSonarStore((s) => s.activePresetIds)
  const { beginDrag, endDrag } = useSonarStore()

  if (!sonarState?.available) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          GG Sonar
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>GG Sonar not available</p>
      </div>
    )
  }

  const classic = sonarState.classic
  const configs = sonarState.configs

  return (
    <div style={{ padding: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          GG Sonar
        </h1>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['classic', 'streamer'] as const).map((m) => (
            <button
              key={m}
              onClick={() => void sonarSetMode(m)}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: sonarState.mode === m ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                color: sonarState.mode === m ? 'var(--color-bg)' : 'var(--color-text-primary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {m === 'classic' ? 'Classic' : 'Streamer'}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      {configs.length > 0 && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Presets
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {configs.map((config) => {
              const isActive = activePresetIds[config.virtualAudioDevice] === config.id || config.isSelected
              return (
                <button
                  key={config.id}
                  onClick={() => void sonarSelectPreset(config.id, config.virtualAudioDevice)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--color-border)',
                    background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                    color: 'var(--color-text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{config.name}</span>
                  {isActive && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>ACTIVE</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Channel mixer */}
      {classic && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Mixer
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="sonar-channel-mixer">
            {CHANNELS.map((ch) => {
              const vol = ch === 'master'
                ? classic.masters.classic
                : classic.devices[ch as keyof typeof classic.devices]?.classic
              if (!vol) return null

              return (
                <div
                  key={ch}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40 }}
                  className="channel-strip"
                >
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, minWidth: 56 }}>
                    {CHANNEL_LABELS[ch]}
                  </span>
                  <div className="slider-track" style={{ flex: 1 }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(vol.volume * 100)}
                      onChange={(e) => {
                        void sonarSetVolume(ch, Number(e.target.value) / 100)
                      }}
                      onMouseDown={beginDrag}
                      onTouchStart={beginDrag}
                      onMouseUp={endDrag}
                      onTouchEnd={endDrag}
                      style={{
                        width: '100%',
                        accentColor: vol.muted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                        cursor: 'pointer',
                        opacity: vol.muted ? 0.5 : 1,
                      }}
                    />
                  </div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, minWidth: 34, textAlign: 'right' }}>
                    {Math.round(vol.volume * 100)}%
                  </span>
                  <button
                    onClick={() => void sonarSetMute(ch, !vol.muted)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      background: vol.muted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                      color: vol.muted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                      fontSize: 10,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {vol.muted ? 'M' : 'M'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
