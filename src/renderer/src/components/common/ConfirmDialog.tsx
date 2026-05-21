import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm, onCancel])

  const dialogContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-overlay)',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px',
          minWidth: '300px',
          boxShadow: 'var(--shadow-dialog)',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '12px',
            margin: '0 0 12px 0',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            marginBottom: '20px',
            margin: '0 0 20px 0',
            lineHeight: '1.5',
          }}
        >
          {message.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < message.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.backgroundColor = 'var(--color-border)'
              btn.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.backgroundColor = 'var(--color-surface-raised)'
              btn.style.color = 'var(--color-text-secondary)'
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: isDangerous ? 'var(--color-bg)' : 'var(--color-bg)',
              backgroundColor: isDangerous ? 'var(--color-danger-bright)' : 'var(--color-accent)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              if (isDangerous) {
                btn.style.backgroundColor = 'var(--color-danger-hover)'
              } else {
                btn.style.opacity = '0.8'
              }
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              if (isDangerous) {
                btn.style.backgroundColor = 'var(--color-danger-bright)'
              } else {
                btn.style.opacity = '1'
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(dialogContent, document.body)
}
