import { useRef, useState, useEffect, useCallback, memo } from 'react'
import ReactDOM from 'react-dom'
import type { SonarChannel, SonarConfig, SonarAudioSession, SonarStreamerMix, SonarMode, SonarAudioDevice } from '@shared/types'
import { useSonarStore } from '../../stores/sonarStore'

// ─── Vertical fader ───────────────────────────────────────────────────────────

interface VerticalFaderProps {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

function VerticalFaderComponent({
  value,
  onChange,
  disabled,
}: VerticalFaderProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragValueRef = useRef<number | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)

  // While dragging, show dragValue; otherwise show prop value
  const displayValue = dragValue !== null ? dragValue : value

  function valueFromClientY(clientY: number): number {
    const el = containerRef.current
    if (!el) return displayValue
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
  }

  function triggerChange(v: number): void {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      onChange(v)
      debounceTimerRef.current = null
    }, 50)
  }

  function onWheel(e: React.WheelEvent): void {
    if (disabled) return
    e.preventDefault()
    const newValue = Math.max(0, Math.min(1, displayValue - e.deltaY * 0.001))
    setDragValue(newValue)
    triggerChange(newValue)
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    useSonarStore.getState().beginDrag()
    const newValue = valueFromClientY(e.clientY)
    dragValueRef.current = newValue
    setDragValue(newValue)

    function onMove(ev: MouseEvent): void {
      if (dragging.current) {
        const v = valueFromClientY(ev.clientY)
        dragValueRef.current = v
        setDragValue(v)
        triggerChange(v)
      }
    }
    function onUp(): void {
      dragging.current = false
      dragValueRef.current = null
      setDragValue(null)
      useSonarStore.getState().endDrag()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (dragValueRef.current !== null) onChange(dragValueRef.current)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Track occupies container minus 8px top/bottom padding. Thumb is 20×10.
  const thumbOffset = `calc(8px + ${displayValue} * (100% - 16px) - 5px)`

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 cursor-ns-resize"
      style={{ minHeight: 180 }}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
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
          height: `calc(${displayValue} * (100% - 16px))`,
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

const VerticalFader = memo(VerticalFaderComponent)

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

// ─── Mute icons ───────────────────────────────────────────────────────────────

function SpeakerIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function SpeakerMutedIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function MicIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function MicMutedIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

// ─── Drag handle icon ─────────────────────────────────────────────────────────

function DragHandleIcon(): JSX.Element {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="2" cy="10" r="1.2" />
      <circle cx="6" cy="10" r="1.2" />
    </svg>
  )
}

// ─── Routed apps list (draggable) ─────────────────────────────────────────────

interface RoutedAppsProps {
  sessions: SonarAudioSession[]
  channelRole: string
}

function RoutedApps({ sessions, channelRole }: RoutedAppsProps): JSX.Element {
  const active = sessions.filter((s) => s.state === 'active')
  if (active.length === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>—</span>
    )
  }
  return (
    <>
      {active.map((s) => (
        <div
          key={s.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData(
              'application/sonar-session',
              JSON.stringify({ processId: s.processId, sourceRole: channelRole }),
            )
          }}
          className="flex items-center gap-1.5 mb-1 min-w-0 rounded cursor-grab"
          style={{
            padding: '2px 4px',
            userSelect: 'none',
          }}
          title={`${s.displayName || s.processName} — drag to move to another channel`}
        >
          <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, opacity: 0.5 }}>
            <DragHandleIcon />
          </span>
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: '#5a9a5a' }}
          />
          <span
            className="text-xs truncate"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {s.displayName || s.processName}
          </span>
        </div>
      ))}
    </>
  )
}

// ─── Device selector (chip + floating menu) ───────────────────────────────────

function DeviceSelector({
  audioDevices,
  currentDevice,
  channel,
  onSelect,
}: {
  audioDevices: SonarAudioDevice[]
  currentDevice?: SonarAudioDevice
  channel: SonarChannel
  onSelect: (channel: SonarChannel, deviceId: string) => void
}): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

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

  if (audioDevices.length === 0) return null

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs w-full min-w-0"
        title={currentDevice?.name ?? 'No device assigned'}
        style={{
          background: 'transparent',
          border: 'none',
          color: currentDevice ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span className="truncate flex-1 text-left">{currentDevice?.name ?? '—'}</span>
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
            minWidth: 200,
            maxWidth: 320,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {audioDevices.map((d) => (
            <button
              key={d.id}
              onClick={() => { onSelect(channel, d.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs"
              style={{
                background: d.id === currentDevice?.id ? 'var(--color-surface-raised)' : 'transparent',
                color: d.id === currentDevice?.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                border: 'none',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 12, color: 'var(--color-accent)', flexShrink: 0 }}>
                {d.id === currentDevice?.id ? '✓' : ''}
              </span>
              <span className="truncate">{d.name}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 150ms ease',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Preset selector (chip + floating menu) ───────────────────────────────────

function PresetSelector({
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
    <div
      className="flex items-center gap-1 px-3 pb-2 flex-shrink-0"
    >
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs flex-1 min-w-0"
        style={{
          background: 'transparent',
          border: 'none',
          color: activePreset ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span className="truncate flex-1 text-left">{activePreset?.name ?? '—'}</span>
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
            minWidth: 160,
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
        document.body
      )}
    </div>
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
  audioDevices: SonarAudioDevice[]
  currentDevice?: SonarAudioDevice
  onVolume: (channel: SonarChannel, value: number) => void
  onMute: (channel: SonarChannel) => void
  onPresetSelect: (channel: SonarChannel, presetId: string) => void
  onDeviceSelect: (channel: SonarChannel, deviceId: string) => void
  onProcessDrop: (processId: number, sourceRole: string) => void
}

function ChannelStripComponent({
  channel,
  label,
  volume,
  muted,
  streamerMix,
  mode,
  presets,
  activePresetId,
  routedSessions,
  audioDevices,
  currentDevice,
  onVolume,
  onMute,
  onPresetSelect,
  onDeviceSelect,
  onProcessDrop,
}: ChannelStripProps): JSX.Element {
  const isMicChannel = channel === 'chatCapture'
  const [isDragOver, setIsDragOver] = useState(false)

  const handleVolume = useCallback((v: number) => onVolume(channel, v), [channel, onVolume])
  const handleMute = useCallback(() => onMute(channel), [channel, onMute])
  const handlePresetSelect = useCallback((id: string) => onPresetSelect(channel, id), [channel, onPresetSelect])
  const handleDeviceSelect = useCallback((ch: SonarChannel, deviceId: string) => onDeviceSelect(ch, deviceId), [onDeviceSelect])

  function handleDragOver(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes('application/sonar-session')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }

  function handleDragLeave(e: React.DragEvent): void {
    // Only clear when leaving the outer card, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/sonar-session')) as {
        processId: number
        sourceRole: string
      }
      if (data.sourceRole !== channel) {
        onProcessDrop(data.processId, data.sourceRole)
      }
    } catch {
      // malformed drag data — ignore
    }
  }

  return (
    <div
      className="flex flex-col rounded-lg flex-shrink-0"
      onDragOver={channel !== 'master' ? handleDragOver : undefined}
      onDragLeave={channel !== 'master' ? handleDragLeave : undefined}
      onDrop={channel !== 'master' ? handleDrop : undefined}
      style={{
        width: 130,
        minHeight: 420,
        background: 'var(--color-surface)',
        border: isDragOver
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        transition: 'border-color 100ms ease',
      }}
    >
      {/* Channel label + device selector */}
      <div
        className="flex-shrink-0 px-3 pt-3 pb-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="text-center">
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </span>
        </div>
        <div className="mt-1.5">
          {channel === 'master' ? (
            <span
              className="px-1.5 py-0.5 text-xs w-full block text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Devices
            </span>
          ) : (
            <DeviceSelector
              audioDevices={audioDevices}
              currentDevice={currentDevice}
              channel={channel}
              onSelect={handleDeviceSelect}
            />
          )}
        </div>
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
              onChange={handleVolume}
            />
          </>
        )}
      </div>

      {/* Mute button */}
      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={handleMute}
          className="w-full py-1.5 rounded transition-colors flex items-center justify-center"
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            background: muted ? 'var(--color-accent)' : 'transparent',
            color: muted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            border: `1px solid ${muted ? 'var(--color-accent)' : 'var(--color-border)'}`,
            cursor: 'pointer',
          }}
        >
          {isMicChannel
            ? (muted ? <MicMutedIcon /> : <MicIcon />)
            : (muted ? <SpeakerMutedIcon /> : <SpeakerIcon />)
          }
        </button>
      </div>

      {/* Preset selector — hidden for channels with no favorites */}
      <div className="px-3 pt-1 flex-shrink-0">
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          onSelect={handlePresetSelect}
        />
      </div>

      {/* Routed apps — draggable; skipped for master */}
      {channel !== 'master' && (
        <>
          <div className="mx-3 flex-shrink-0" style={{ height: 1, background: 'var(--color-border)' }} />
          <div
            className="px-3 py-2 overflow-y-auto flex-shrink-0"
            style={{
              maxHeight: 96,
              background: isDragOver ? 'var(--color-surface-raised)' : undefined,
              transition: 'background 100ms ease',
            }}
          >
            <RoutedApps sessions={routedSessions} channelRole={channel} />
          </div>
        </>
      )}
    </div>
  )
}

export const ChannelStrip = memo(ChannelStripComponent)
