export function SonarPresetSwitcher(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <PresetSwitcherIcon />
      </div>
      <div>
        <h1
          className="text-2xl font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Automatic Sonar Preset Switcher
        </h1>
        <p className="text-sm max-w-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          Automatic preset switching rules and triggers will appear here.
        </p>
      </div>
    </div>
  )
}

function PresetSwitcherIcon(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary)' }}>
      <path d="M2 4h10M2 7h7M2 10h4" />
      <path d="M11 8l2 2-2 2" />
    </svg>
  )
}
