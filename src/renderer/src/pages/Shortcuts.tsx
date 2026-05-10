export function Shortcuts(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <ShortcutsIcon />
      </div>
      <div>
        <h1
          className="text-2xl font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Shortcuts
        </h1>
        <p className="text-sm max-w-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          Keyboard and macro shortcuts will appear here.
        </p>
      </div>
    </div>
  )
}

function ShortcutsIcon(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary)' }}>
      <rect x="1.5" y="3" width="11" height="8" rx="1.5" />
      <path d="M4 6.5h6M4 8.5h4" />
    </svg>
  )
}
