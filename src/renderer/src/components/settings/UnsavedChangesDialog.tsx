interface UnsavedChangesDialogProps {
  onSaveAndContinue: () => Promise<void>
  onLeave: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  onSaveAndContinue,
  onLeave,
  onCancel,
}: UnsavedChangesDialogProps): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          width: 360,
        }}
      >
        <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Unsaved changes
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          You have unsaved changes on this page. What would you like to do?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onLeave}
            className="text-sm px-3 py-1.5 rounded"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Leave without saving
          </button>
          <button
            onClick={onSaveAndContinue}
            className="text-sm px-3 py-1.5 rounded font-medium"
            style={{
              background: 'var(--color-accent)',
              border: 'none',
              color: 'var(--color-bg)',
              cursor: 'pointer',
            }}
          >
            Save &amp; continue
          </button>
        </div>
      </div>
    </div>
  )
}
