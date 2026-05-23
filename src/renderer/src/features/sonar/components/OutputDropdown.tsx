import { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import type { SonarAudioDevice, SonarChannel } from '@shared/types'

interface OutputDropdownProps {
  devices: SonarAudioDevice[]
  currentDevice?: SonarAudioDevice
  channel: SonarChannel
  onChange: (channel: SonarChannel, deviceId: string) => void
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

export function OutputDropdown({ devices, currentDevice, channel, onChange }: OutputDropdownProps): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ bottom: number; left: number; width: number } | null>(null)

  function toggle(): void {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({
        bottom: window.innerHeight - r.top + 4,
        left: r.left,
        width: Math.max(r.width, 180),
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

  if (devices.length === 0) return null

  return (
    <div className="sn-out-dd">
      <button
        ref={btnRef}
        className={`sn-out-dd-btn${open ? ' open' : ''}`}
        onClick={toggle}
        title={`Output: ${currentDevice?.name ?? 'Not set'}`}
      >
        <span className="sn-out-dd-arrow">→</span>
        <span className="sn-out-dd-name">{currentDevice?.name ?? '—'}</span>
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
          <div className="sn-dd-menu-h">Route to</div>
          {devices.map((d) => {
            const selected = d.id === currentDevice?.id
            return (
              <button
                key={d.id}
                className={`sn-dd-opt${selected ? ' sel' : ''}`}
                onClick={() => { onChange(channel, d.id); setOpen(false) }}
              >
                <span className="sn-dd-opt-name">{d.name}</span>
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
