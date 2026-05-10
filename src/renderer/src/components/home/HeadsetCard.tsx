import type { ArctisState } from '@shared/types'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  bar,
}: {
  label: string
  value: string
  bar: number
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs w-28 shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 4, background: 'var(--color-border)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, bar))}%`,
            background: 'var(--color-accent)',
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <span
        className="text-xs mono w-9 text-right shrink-0"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}

function Badge({ label, active }: { label: string; active?: boolean }): JSX.Element {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded mono"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
    </span>
  )
}

// ─── Headset icon ─────────────────────────────────────────────────────────────

function HeadphonesIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}

// ─── HeadsetCard ──────────────────────────────────────────────────────────────

const ANC_LABELS: Record<ArctisState['ancMode'], string> = {
  OFF: 'ANC Off',
  TRANSPARENCY: 'Transparency',
  ANC: 'ANC',
}

export function HeadsetCard({ state }: { state: ArctisState }): JSX.Element {
  const batteryHeadset = Math.round(state.batteryHeadset)
  const batteryDock = Math.round(state.batteryDock)
  const volume = Math.round(state.volume)

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col gap-3"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}>
            <HeadphonesIcon />
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Arctis Nova Pro Wireless
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge label={ANC_LABELS[state.ancMode]} active={state.ancMode !== 'OFF'} />
          <Badge label={state.micMuted ? 'Mic Muted' : 'Mic On'} active={!state.micMuted} />
        </div>
      </div>

      {/* Stat bars */}
      <div className="flex flex-col gap-2">
        <StatRow
          label="Headset battery"
          value={`${batteryHeadset}%`}
          bar={batteryHeadset}
        />
        <StatRow
          label="Dock battery"
          value={`${batteryDock}%`}
          bar={batteryDock}
        />
        <StatRow
          label="Volume"
          value={`${volume}%`}
          bar={volume}
        />
      </div>
    </div>
  )
}
