import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useResourceStore } from '../../stores/resourceStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import type { ResourceCpuInfo, ResourceRamInfo, ResourceGpuInfo, ResourceDiskInfo, ResourceNetInfo, ResourceMonitorMetrics } from '@shared/types'
import { DEFAULT_RESOURCE_MONITOR_METRICS } from '@shared/types'

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

const METRIC_LABELS: { key: keyof ResourceMonitorMetrics; label: string; desc: string }[] = [
  { key: 'cpu',     label: 'CPU',     desc: 'Processor usage, core bars, and temperature' },
  { key: 'ram',     label: 'Memory',  desc: 'RAM and swap usage' },
  { key: 'gpu',     label: 'GPU',     desc: 'GPU usage, VRAM, and temperature' },
  { key: 'disk',    label: 'Storage', desc: 'Disk usage and I/O rates' },
  { key: 'network', label: 'Network', desc: 'Network adapter throughput' },
]

export function ResourceMonitorConfigSection(): JSX.Element {
  const { snapshot } = useResourceStore()
  const { setDirty, registerSave } = useSettingsForm()

  const [savedInterval, setSavedInterval] = useState(2)
  const [draftInterval, setDraftInterval] = useState('2')
  const [savedMetrics, setSavedMetrics] = useState<ResourceMonitorMetrics>(DEFAULT_RESOURCE_MONITOR_METRICS)
  const [draftMetrics, setDraftMetrics] = useState<ResourceMonitorMetrics>(DEFAULT_RESOURCE_MONITOR_METRICS)

  const draftIntervalRef = useRef(draftInterval)
  const draftMetricsRef = useRef(draftMetrics)

  useEffect(() => { draftIntervalRef.current = draftInterval }, [draftInterval])
  useEffect(() => { draftMetricsRef.current = draftMetrics }, [draftMetrics])

  useEffect(() => {
    window.api.getSettings().then((s) => {
      const interval = s.resourceMonitorInterval ?? 2
      const metrics = { ...DEFAULT_RESOURCE_MONITOR_METRICS, ...s.resourceMonitorMetrics }
      setSavedInterval(interval)
      setDraftInterval(String(interval))
      setSavedMetrics(metrics)
      setDraftMetrics(metrics)
    }).catch(console.error)
  }, [])

  // Mark dirty when draft diverges from saved
  useEffect(() => {
    const parsedInterval = parseFloat(draftInterval)
    const intervalDirty = !isNaN(parsedInterval) && parsedInterval !== savedInterval
    const metricsDirty = (Object.keys(draftMetrics) as (keyof ResourceMonitorMetrics)[])
      .some((k) => draftMetrics[k] !== savedMetrics[k])
    setDirty(intervalDirty || metricsDirty)
  }, [draftInterval, savedInterval, draftMetrics, savedMetrics, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const raw = parseFloat(draftIntervalRef.current)
      const interval = isNaN(raw) ? savedInterval : Math.max(0.5, Math.min(60, raw))
      const metrics = draftMetricsRef.current

      const current = await window.api.getSettings()
      await window.api.setSettings({ ...current, resourceMonitorInterval: interval, resourceMonitorMetrics: metrics })
      await window.api.resourceSetConfig({ interval, metrics })

      setSavedInterval(interval)
      setDraftInterval(String(interval))
      setSavedMetrics(metrics)
    })
    return () => registerSave(null)
  }, [registerSave, savedInterval])

  return (
    <>
      {/* Configuration section */}
      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>Configuration</h3>
          <span className="desc">Metrics and refresh rate</span>
        </div>

        {/* Refresh interval */}
        <div className="ff">
          <div className="ff-label">
            <div className="ff-label-title">Refresh interval</div>
            <div className="ff-label-desc">How often metrics are collected (0.5 – 60 s)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min={0.5}
              max={60}
              step={0.5}
              value={draftInterval}
              onChange={(e) => setDraftInterval(e.target.value)}
              className="input mono"
              style={{ width: '64px', textAlign: 'right' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>s</span>
          </div>
        </div>

        {/* Metric toggles */}
        {METRIC_LABELS.map(({ key, label, desc }) => (
          <div key={key} className="ff">
            <div className="ff-label">
              <div className="ff-label-title">{label}</div>
              <div className="ff-label-desc">{desc}</div>
            </div>
            <input
              type="checkbox"
              checked={draftMetrics[key]}
              onChange={(e) => setDraftMetrics((prev) => ({ ...prev, [key]: e.target.checked }))}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
            />
          </div>
        ))}
      </div>

      {/* Live stats section */}
      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>Statistics</h3>
          <span className="desc">{snapshot ? `Live · updates every ${savedInterval} s` : 'Enable the plugin to see live data'}</span>
        </div>
        {!snapshot ? (
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '2px 0' }}>
            Waiting for data…
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {snapshot.cpu && <CpuCard cpu={snapshot.cpu} />}
            {snapshot.ram && <RamCard ram={snapshot.ram} />}
            {snapshot.gpu && <GpuCard gpu={snapshot.gpu} />}
            {snapshot.disks.length > 0 && <StorageCard disks={snapshot.disks} />}
            {snapshot.network.length > 0 && <NetworkCard network={snapshot.network} />}
          </div>
        )}
      </div>
    </>
  )
}
