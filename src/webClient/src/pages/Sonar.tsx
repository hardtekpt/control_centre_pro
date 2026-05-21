import { useSonarStore, sonarSetVolume, sonarSetMute, sonarSelectPreset, sonarSetMode } from '../stores/sonarStore'
import type { SonarChannel, SonarConfig } from '@shared/types'

const CHANNEL_ORDER: SonarChannel[] = ['master', 'game', 'media', 'chatRender', 'chatCapture', 'aux']
const CHANNEL_LABELS: Record<SonarChannel, string> = {
  master: 'Master',
  game: 'Game',
  media: 'Media',
  chatRender: 'Chat',
  chatCapture: 'Mic',
  aux: 'Aux',
}

function getFavoritesForChannel(configs: SonarConfig[], device: string): SonarConfig[] {
  return configs
    .filter((c) => c.virtualAudioDevice === device && c.isFavorite)
    .sort((a, b) => (a.favoritePosition ?? 0) - (b.favoritePosition ?? 0))
}

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
    <div style={{ padding: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header + mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          GG Sonar
        </h1>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHANNEL_ORDER.map((ch) => {
              const vol = ch === 'master'
                ? classic.masters.classic
                : classic.devices[ch as keyof typeof classic.devices]?.classic
              if (!vol) return null

              const device = ch as string
              const favorites = getFavoritesForChannel(configs, device)
              const activeId = activePresetIds[device] ?? configs.find(c => c.virtualAudioDevice === device && c.isSelected)?.id

              return (
                <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, minWidth: 52 }}>
                    {CHANNEL_LABELS[ch]}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(vol.volume * 100)}
                    onChange={(e) => void sonarSetVolume(ch, Number(e.target.value) / 100)}
                    onMouseDown={beginDrag}
                    onTouchStart={beginDrag}
                    onMouseUp={endDrag}
                    onTouchEnd={endDrag}
                    style={{
                      flex: 1,
                      accentColor: vol.muted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                      cursor: 'pointer',
                      opacity: vol.muted ? 0.5 : 1,
                    }}
                  />
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, minWidth: 34, textAlign: 'right' }}>
                    {Math.round(vol.volume * 100)}%
                  </span>
                  <button
                    onClick={() => void sonarSetMute(ch, !vol.muted)}
                    title={vol.muted ? 'Unmute' : 'Mute'}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      background: vol.muted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                      color: vol.muted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                      fontSize: 10,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    M
                  </button>
                  {favorites.length > 0 && (
                    <select
                      value={activeId ?? ''}
                      onChange={(e) => void sonarSelectPreset(e.target.value, device)}
                      style={{
                        fontSize: 11,
                        background: 'var(--color-surface-raised)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '3px 5px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        maxWidth: 90,
                        flexShrink: 0,
                      }}
                    >
                      <option value="" disabled>Preset</option>
                      {favorites.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
