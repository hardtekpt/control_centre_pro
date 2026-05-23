import { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import type { SonarConfig, SonarChannel } from '@shared/types'

interface PresetSelectorProps {
  configs: SonarConfig[]
  activePresetId?: string
  channel: SonarChannel
  onSelect: (channel: SonarChannel, configId: string) => void
}

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function PresetSelector({ configs, activePresetId, channel, onSelect }: PresetSelectorProps): JSX.Element | null {
  const channelConfigs = configs.filter((c) => c.virtualAudioDevice === channel)
  if (channelConfigs.length === 0) return null

  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ bottom: number; left: number; width: number } | null>(null)

  const resolvedActiveId = activePresetId ?? channelConfigs.find((c) => c.isSelected)?.id
  const activeConfig = channelConfigs.find((c) => c.id === resolvedActiveId)

  function toggle(): void {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({
        bottom: window.innerHeight - r.top + 4,
        left: r.left,
        width: Math.max(r.width, 160),
      })
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

  return (
    <div className="sn-preset-sel">
      <button
        ref={btnRef}
        className={`sn-preset-sel-btn${open ? ' open' : ''}`}
        onClick={toggle}
        title={`Preset: ${activeConfig?.name ?? 'None'}`}
      >
        <span className="sn-preset-sel-ic">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </span>
        <span className="sn-preset-sel-name">{activeConfig?.name ?? '—'}</span>
        <ChevronIcon open={open} />
      </button>

      {open && pos && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="sn-out-dd-menu"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            minWidth: pos.width,
            zIndex: 9999,
          }}
        >
          <div className="sn-dd-menu-h">Preset</div>
          {channelConfigs.map((c) => {
            const selected = c.id === resolvedActiveId
            return (
              <button
                key={c.id}
                className={`sn-dd-opt${selected ? ' sel' : ''}`}
                onClick={() => { onSelect(channel, c.id); setOpen(false) }}
              >
                <span className="sn-dd-opt-name">{c.name}</span>
                {selected && <span className="sn-dd-check">✓</span>}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
