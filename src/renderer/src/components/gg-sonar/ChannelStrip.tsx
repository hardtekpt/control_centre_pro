import { useRef } from 'react'
import type { SonarChannel, SonarConfig, SonarAudioSession, SonarStreamerMix, SonarMode } from '@shared/types'

// ─── Vertical fader ───────────────────────────────────────────────────────────

function VerticalFader({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function valueFromClientY(clientY: number): number {
    const el = containerRef.current
    if (!el) return value
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    onChange(valueFromClientY(e.clientY))

    function onMove(e: MouseEvent): void {
      if (dragging.current) onChange(valueFromClientY(e.clientY))
    }
    function onUp(): void {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Track occupies container minus 8px top/bottom padding. Thumb is 20×10.
  const thumbOffset = `calc(8px + ${value} * (100% - 16px) - 5px)`

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 cursor-ns-resize"
      style={{ minHeight: 60 }}
      onMouseDown={onMouseDown}
    >
      {/* Track background */}
      <div
        className="absolute rounded-full"
        style={{
          left: 'calc(50% - 3px)',
          top: 8,
          bottom: 8,
          width: 6,
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
        }}
      />
      {/* Fill — bottom up */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: 'calc(50% - 3px)',
          bottom: 8,
          width: 6,
          height: `calc(${value} * (100% - 16px))`,
          background: disabled ? 'var(--color-text-secondary)' : 'var(--color-accent)',
        }}
      />
      {/* Thumb */}
      <div
        className="absolute rounded pointer-events-none"
        style={{
          left: 'calc(50% - 10px)',
          bottom: thumbOffset,
          width: 20,
          height: 10,
          background: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}

// ─── Streamer dual fader ──────────────────────────────────────────────────────

function StreamerFaders({ mix }: { mix: SonarStreamerMix }): JSX.Element {
  return (
    <div className="flex flex-1 gap-1 w-full min-h-0">
      <div className="flex flex-col items-center flex-1 min-h-0">
        <span className="text-xs mb-1 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
          STR
        </span>
        <VerticalFader value={mix.streaming.volume} onChange={() => {}} disabled />
        <span className="mono text-xs mt-1 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          {Math.round(mix.streaming.volume * 100)}%
        </span>
      </div>
      <div className="flex flex-col items-center flex-1 min-h-0">
        <span className="text-xs mb-1 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
          MON
        </span>
        <VerticalFader value={mix.monitoring.volume} onChange={() => {}} disabled />
        <span className="mono text-xs mt-1 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          {Math.round(mix.monitoring.volume * 100)}%
        </span>
      </div>
    </div>
  )
}

// ─── Routed apps list ─────────────────────────────────────────────────────────

function RoutedApps({ sessions }: { sessions: SonarAudioSession[] }): JSX.Element {
  if (sessions.length === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>—</span>
    )
  }
  return (
    <>
      {sessions.map((s) => (
        <div key={s.id} className="flex items-center gap-1.5 mb-1 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: s.state === 'active' ? '#5a9a5a' : 'var(--color-border)' }}
          />
          <span
            className="text-xs truncate"
            style={{ color: 'var(--color-text-secondary)' }}
            title={s.displayName || s.processName}
          >
            {s.displayName || s.processName}
          </span>
        </div>
      ))}
    </>
  )
}

// ─── Channel strip ────────────────────────────────────────────────────────────

export interface ChannelStripProps {
  channel: SonarChannel
  label: string
  volume: number
  muted: boolean
  streamerMix?: SonarStreamerMix
  mode: SonarMode
  presets: SonarConfig[]
  activePresetId?: string
  routedSessions: SonarAudioSession[]
  onVolume: (channel: SonarChannel, value: number) => void
  onMute: (channel: SonarChannel) => void
  onPresetSelect: (channel: SonarChannel, presetId: string) => void
  onPresetEdit: (config: SonarConfig) => void
}

export function ChannelStrip({
  channel,
  label,
  volume,
  muted,
  streamerMix,
  mode,
  presets,
  activePresetId,
  routedSessions,
  onVolume,
  onMute,
  onPresetSelect,
  onPresetEdit,
}: ChannelStripProps): JSX.Element {
  const activeConfig = presets.find((p) => p.id === activePresetId)

  return (
    <div
      className="flex flex-col h-full"
      style={{
        minWidth: 110,
        flex: '1 1 0',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Channel label */}
      <div
        className="flex-shrink-0 px-3 pt-3 pb-2 text-center"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
      </div>

      {/* Fader zone */}
      <div className="flex flex-col items-center px-3 pt-2 pb-1 flex-1 min-h-0">
        {mode === 'streamer' && streamerMix ? (
          <StreamerFaders mix={streamerMix} />
        ) : (
          <>
            <span
              className="mono text-xs mb-2 flex-shrink-0"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {Math.round(volume * 100)}%
            </span>
            <VerticalFader
              value={volume}
              onChange={(v) => onVolume(channel, v)}
            />
          </>
        )}
      </div>

      {/* Mute button */}
      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={() => onMute(channel)}
          className="w-full text-xs py-1.5 rounded transition-colors"
          style={{
            background: muted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: muted ? 'var(--color-bg)' : 'var(--color-text-primary)',
            border: `1px solid ${muted ? 'var(--color-accent)' : 'var(--color-border)'}`,
            cursor: 'pointer',
          }}
        >
          {muted ? '✕ Muted' : '○ Mute'}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 flex-shrink-0" style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Preset selector */}
      <div className="px-3 py-2 flex-shrink-0">
        {presets.length > 0 ? (
          <div className="flex items-center gap-1">
            <div className="relative flex-1 min-w-0">
              <select
                value={activePresetId ?? ''}
                onChange={(e) => {
                  if (e.target.value) onPresetSelect(channel, e.target.value)
                }}
                className="w-full text-xs rounded px-2 py-1 appearance-none truncate"
                style={{
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  outline: 'none',
                  cursor: 'pointer',
                  paddingRight: 20,
                }}
              >
                <option value="">— preset —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {/* Dropdown chevron */}
              <span
                className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                ▾
              </span>
            </div>
            {activeConfig && (
              <button
                onClick={() => onPresetEdit(activeConfig)}
                className="text-xs px-1.5 py-1 rounded flex-shrink-0"
                title="Edit preset"
                style={{
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ✎
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            —
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 flex-shrink-0" style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Routed apps */}
      <div
        className="px-3 py-2 overflow-y-auto flex-shrink-0"
        style={{ maxHeight: 96 }}
      >
        <RoutedApps sessions={routedSessions} />
      </div>
    </div>
  )
}
