import type { CSSProperties } from 'react'
import { useResourceStore } from '../../stores/resourceStore'
import type { ResourceCpuInfo, ResourceRamInfo, ResourceGpuInfo, ResourceDiskInfo, ResourceNetInfo } from '@shared/types'

const CARD: CSSProperties = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  padding: '10px 12px',
}

const CARD_TITLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '7px',
}

const MONO: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', lineHeight: '18px' }}>
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '11px', color: 'var(--color-text-primary)', textAlign: 'right', ...MONO }}>{value}</span>
    </div>
  )
}

function CoreBars({ cores }: { cores: number[] }) {
  return (
    <div style={{ display: 'flex', gap: '2px', marginTop: '8px', alignItems: 'flex-end', height: '18px' }}>
      {cores.map((pct, i) => (
        <div
          key={i}
          title={`Core ${i}: ${pct.toFixed(0)} %`}
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: '2px',
            background: 'var(--color-border)',
            position: 'relative',
            overflow: 'hidden',
            height: '18px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${pct}%`,
              background: 'var(--color-accent)',
              borderRadius: '2px',
            }}
          />
        </div>
      ))}
    </div>
  )
}

function CpuCard({ cpu }: { cpu: ResourceCpuInfo }) {
  return (
    <div style={CARD}>
      <div style={CARD_TITLE}>CPU</div>
      <Row label="Usage" value={`${cpu.usagePercent.toFixed(1)} %`} />
      <Row label="Temp" value={cpu.temperatureCelsius != null ? `${cpu.temperatureCelsius.toFixed(1)} °C` : '—'} />
      {cpu.coreUsage.length > 0 && <CoreBars cores={cpu.coreUsage} />}
    </div>
  )
}

function RamCard({ ram }: { ram: ResourceRamInfo }) {
  return (
    <div style={CARD}>
      <div style={CARD_TITLE}>Memory</div>
      <Row label="Used" value={`${ram.usedGb.toFixed(1)} / ${ram.totalGb.toFixed(1)} GB`} />
      <Row label="%" value={`${ram.usedPercent.toFixed(0)} %`} />
      {ram.swapUsedPercent > 0 && <Row label="Swap" value={`${ram.swapUsedPercent.toFixed(0)} %`} />}
    </div>
  )
}

function GpuCard({ gpu }: { gpu: ResourceGpuInfo }) {
  return (
    <div style={{ ...CARD, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px', gap: '8px' }}>
        <div style={CARD_TITLE}>GPU</div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...MONO }}>{gpu.name}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px' }}>
        <Row label="Usage" value={gpu.usagePercent != null ? `${gpu.usagePercent.toFixed(1)} %` : '—'} />
        <Row
          label="VRAM"
          value={
            gpu.vramUsedGb != null && gpu.vramTotalGb != null
              ? `${gpu.vramUsedGb.toFixed(1)} / ${gpu.vramTotalGb.toFixed(1)} GB`
              : '—'
          }
        />
        <Row label="Temp" value={gpu.temperatureCelsius != null ? `${gpu.temperatureCelsius.toFixed(1)} °C` : '—'} />
      </div>
    </div>
  )
}

function StorageCard({ disks }: { disks: ResourceDiskInfo[] }) {
  return (
    <div style={CARD}>
      <div style={CARD_TITLE}>Storage</div>
      {disks.length === 0 ? (
        <Row label="Drives" value="—" />
      ) : (
        disks.map((d) => (
          <Row
            key={d.mountpoint}
            label={d.label}
            value={`${d.usedPercent.toFixed(0)} %  ${d.usedGb.toFixed(0)} / ${d.totalGb.toFixed(0)} GB`}
          />
        ))
      )}
    </div>
  )
}

function NetworkCard({ network }: { network: ResourceNetInfo[] }) {
  const active = network.filter((n) => n.sentMbps > 0 || n.recvMbps > 0)
  return (
    <div style={CARD}>
      <div style={CARD_TITLE}>Network</div>
      {active.length === 0 ? (
        <Row label="Idle" value="0 MB/s" />
      ) : (
        active.map((n) => (
          <Row
            key={n.adapter}
            label={n.adapter}
            value={`↑ ${n.sentMbps.toFixed(2)}  ↓ ${n.recvMbps.toFixed(2)} MB/s`}
          />
        ))
      )}
    </div>
  )
}

export function ResourceMonitorConfigSection(): JSX.Element {
  const { snapshot } = useResourceStore()

  if (!snapshot) {
    return (
      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>Statistics</h3>
          <span className="desc">Enable the plugin to see live data</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '2px 0' }}>
          Waiting for data…
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-section">
      <div className="cfg-section-h">
        <h3>Statistics</h3>
        <span className="desc">Live · updates every 2 s</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <CpuCard cpu={snapshot.cpu} />
        <RamCard ram={snapshot.ram} />
        {snapshot.gpu && <GpuCard gpu={snapshot.gpu} />}
        <StorageCard disks={snapshot.disks} />
        <NetworkCard network={snapshot.network} />
      </div>
    </div>
  )
}
