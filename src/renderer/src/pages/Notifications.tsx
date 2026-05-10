export function Notifications(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <NotificationsIcon />
      </div>
      <div>
        <h1
          className="text-2xl font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Notifications
        </h1>
        <p className="text-sm max-w-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          Notification history and settings will appear here.
        </p>
      </div>
    </div>
  )
}

function NotificationsIcon(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary)' }}>
      <path d="M7 1.5A4 4 0 0 0 3 5.5v2.5L2 9.5h10l-1-1.5V5.5A4 4 0 0 0 7 1.5z" />
      <path d="M5.5 9.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  )
}
