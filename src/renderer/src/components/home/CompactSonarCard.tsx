import { useMemo, useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useSonarStore } from '../../stores/sonarStore'
import { notifySonarPresetChange } from '../../lib/notifyFromEvent'
import type { SonarChannel, SonarDeviceChannel, SonarConfig } from '@shared/types'

// ─── Icons ────────────────────────────────────────────────────────────────────

function SonarIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }): JSX.Element {
  if (muted) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function MicIcon({ muted }: { muted: boolean }): JSX.Element {
  if (muted) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

// ─── Preset selector ──────────────────────────────────────────────────────────

function InlinePresetSelector({
  presets,
  activePresetId,
  onSelect,
}: {
  presets: SonarConfig[]
  activePresetId?: string
  onSelect: (id: string) => void
}): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const favoritePresets = presets.filter((p) => p.isFavorite)
  const activePreset = presets.find((p) => p.id === activePresetId)

  function toggle(): void {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent): void {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (favoritePresets.length === 0) return null

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-1 rounded text-xs px-1.5 py-0.5 w-full min-w-0"
        title={activePreset?.name ?? 'Select preset'}
        style={{
          background: open ? 'var(--color-surface-raised)' : 'transparent',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span className="truncate flex-1 text-left">{activePreset?.name ?? '—'}</span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            overflow: 'hidden',
            minWidth: 140,
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {favoritePresets.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs"
              style={{
                background: p.id === activePresetId ? 'var(--color-surface-raised)' : 'transparent',
                color: p.id === activePresetId ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                border: 'none',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 12, color: 'var(--color-accent)', flexShrink: 0 }}>
                {p.id === activePresetId ? '✓' : ''}
              </span>
              {p.name}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Channel row ──────────────────────────────────────────────────────────────

const CHANNEL_DEFS: { channel: SonarChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'game', label: 'Game' },
  { channel: 'media', label: 'Media' },
  { channel: 'chatRender', label: 'Chat' },
]

function ChannelRow({
  channel,
  label,
  volume,
  muted,
  presets,
  activePresetId,
  hasAnyPresets,
  onVolume,
  onMute,
  onPresetSelect,
}: {
  channel: SonarChannel
  label: string
  volume: number
  muted: boolean
  presets: SonarConfig[]
  activePresetId?: string
  hasAnyPresets: boolean
  onVolume: (channel: SonarChannel, v: number) => void
  onMute: (channel: SonarChannel) => void
  onPresetSelect: (channel: SonarChannel, id: string) => void
}): JSX.Element {
  const isMic = channel === 'chatCapture'
  const pct = Math.round(volume * 100)
  const channelHasPresets = presets.filter((p) => p.isFavorite).length > 0

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className="text-xs shrink-0 text-right"
        style={{ color: 'var(--color-text-secondary)', width: 36 }}
      >
        {label}
      </span>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => onVolume(channel, Number(e.target.value) / 100)}
        className="flex-1"
        style={{
          accentColor: 'var(--color-accent)',
          cursor: 'pointer',
          opacity: muted ? 0.35 : 1,
          transition: 'opacity 150ms ease',
        }}
      />

      <span
        className="mono shrink-0 text-right"
        style={{ color: 'var(--color-text-secondary)', fontSize: 11, width: 30 }}
      >
        {pct}%
      </span>

      <button
        onClick={() => onMute(channel)}
        title={muted ? 'Unmute' : 'Mute'}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
        style={{
          background: muted ? 'rgba(239,68,68,0.12)' : 'transparent',
          border: muted ? '1px solid rgba(239,68,68,0.35)' : '1px solid transparent',
          color: muted ? '#ef4444' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {isMic ? <MicIcon muted={muted} /> : <SpeakerIcon muted={muted} />}
      </button>

      {/* Preset slot — always rendered to keep rows aligned */}
      {hasAnyPresets && (
        <div style={{ width: 88, flexShrink: 0 }}>
          {channelHasPresets && (
            <InlinePresetSelector
              presets={presets}
              activePresetId={activePresetId}
              onSelect={(id) => onPresetSelect(channel, id)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Compact Sonar Card ───────────────────────────────────────────────────────

export function CompactSonarCard(): JSX.Element {
  const { sonarState, activePresetIds, patchClassicVolume, setActivePreset } = useSonarStore()

  const presetsByChannel = useMemo(() => {
    const map: Record<string, SonarConfig[]> = {}
    if (!sonarState) return map
    for (const config of sonarState.configs) {
      const ch = config.virtualAudioDevice
      if (!map[ch]) map[ch] = []
      map[ch].push(config)
    }
    return map
  }, [sonarState?.configs])

  const hasAnyPresets = useMemo(
    () => Object.values(presetsByChannel).some((ps) => ps.some((p) => p.isFavorite)),
    [presetsByChannel],
  )

  const isActive = !!(sonarState?.available && sonarState.classic)

  if (!isActive) {
    return (
      <div
        className="rounded-lg px-4 py-3 flex flex-col"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}><SonarIcon /></span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            GG Sonar
          </span>
          <div
            title="Unavailable"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-text-secondary)',
              opacity: 0.4,
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    )
  }

  function getVolume(channel: SonarChannel): { volume: number; muted: boolean } {
    const classic = sonarState!.classic!
    if (channel === 'master') return classic.masters.classic
    return classic.devices[channel as SonarDeviceChannel].classic
  }

  function handleVolume(channel: SonarChannel, value: number): void {
    patchClassicVolume(channel, { volume: value })
    window.api.sonarSetVolume(channel, value).catch(console.error)
  }

  function handleMute(channel: SonarChannel): void {
    const { muted } = getVolume(channel)
    patchClassicVolume(channel, { muted: !muted })
    window.api.sonarSetMute(channel, !muted).catch(console.error)
  }

  function handlePresetSelect(channel: SonarChannel, presetId: string): void {
    setActivePreset(channel, presetId)
    window.api.sonarSelectPreset(presetId).catch(console.error)
    const preset = sonarState!.configs.find((c) => c.id === presetId)
    if (preset) notifySonarPresetChange(preset.name)
  }

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}><SonarIcon /></span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            GG Sonar
          </span>
          <div
            title="Active"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              flexShrink: 0,
            }}
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {sonarState.mode === 'streamer' ? 'Streamer' : 'Classic'}
        </span>
      </div>

      {/* Channel rows */}
      <div className="flex flex-col gap-0.5">
        {CHANNEL_DEFS.map(({ channel, label }) => {
          const { volume, muted } = getVolume(channel)
          return (
            <ChannelRow
              key={channel}
              channel={channel}
              label={label}
              volume={volume}
              muted={muted}
              presets={presetsByChannel[channel] ?? []}
              activePresetId={activePresetIds[channel]}
              hasAnyPresets={hasAnyPresets}
              onVolume={handleVolume}
              onMute={handleMute}
              onPresetSelect={handlePresetSelect}
            />
          )
        })}
      </div>
    </div>
  )
}
