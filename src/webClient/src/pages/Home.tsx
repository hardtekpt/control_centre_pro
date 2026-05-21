import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore } from '../stores/sonarStore'

export function Home(): JSX.Element {
  const arctis = useServiceStore((s) => s.arctisState)
  const sonar = useSonarStore((s) => s.sonarState)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        Home
      </h1>

      {/* Arctis status card */}
      <StatusCard title="Arctis Nova Pro">
        {arctis ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatusRow label="Headset" value={`${arctis.batteryHeadset}%`} />
            <StatusRow label="Dock" value={`${arctis.batteryDock}%`} />
            <StatusRow label="Wireless" value={arctis.wirelessConnected ? 'Connected' : 'Disconnected'} />
            <StatusRow label="Volume" value={`${arctis.volume}%`} />
            <StatusRow label="Mic" value={arctis.micMuted ? 'Muted' : 'Active'} />
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Not connected</span>
        )}
      </StatusCard>

      {/* Sonar status card */}
      <StatusCard title="GG Sonar">
        {sonar?.available ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatusRow label="Mode" value={sonar.mode === 'classic' ? 'Classic' : 'Streamer'} />
            {sonar.classic && (
              <StatusRow
                label="Master"
                value={sonar.classic.masters.classic.muted
                  ? 'Muted'
                  : `${Math.round(sonar.classic.masters.classic.volume * 100)}%`}
              />
            )}
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Not available</span>
        )}
      </StatusCard>
    </div>
  )
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
