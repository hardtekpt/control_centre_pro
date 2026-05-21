import { useServiceStore } from '../stores/serviceStore'
import { post } from '../api/http'
import type { ArctisState } from '@shared/types'

export function Arctis(): JSX.Element {
  const arctis = useServiceStore((s) => s.arctisState)
  const updateArctis = useServiceStore((s) => s.updateArctisState)

  if (!arctis) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          Arctis Nova Pro
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Headset not connected</p>
      </div>
    )
  }

  async function sendCmd(cmd: string, value: unknown): Promise<void> {
    await post('/api/arctis/cmd', { cmd, value })
  }

  return (
    <div style={{ padding: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>
        Arctis Nova Pro
      </h1>

      {/* Status row */}
      <Section title="Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BatteryRow label="Headset" value={arctis.batteryHeadset} />
          <BatteryRow label="Dock" value={arctis.batteryDock} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Wireless</span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              {arctis.wirelessConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </Section>

      {/* Volume */}
      <Section title="Volume">
        <SliderRow
          value={arctis.volume}
          max={100}
          label={`${arctis.volume}%`}
          onChange={(v) => {
            updateArctis({ volume: v })
            void sendCmd('setVolume', v)
          }}
        />
      </Section>

      {/* Mic */}
      <Section title="Microphone">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <PillButton
              label="Muted"
              active={arctis.micMuted}
              onClick={() => { updateArctis({ micMuted: true }); void sendCmd('setMicMute', true) }}
            />
            <PillButton
              label="Active"
              active={!arctis.micMuted}
              onClick={() => { updateArctis({ micMuted: false }); void sendCmd('setMicMute', false) }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Gain</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['LOW', 'HIGH'] as ArctisState['micGain'][]).map((g) => (
                <PillButton
                  key={g}
                  label={g === 'LOW' ? 'Low' : 'High'}
                  active={arctis.micGain === g}
                  onClick={() => { updateArctis({ micGain: g }); void sendCmd('setMicGain', g) }}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ANC */}
      <Section title="ANC Mode">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['OFF', 'TRANSPARENCY', 'ANC'] as ArctisState['ancMode'][]).map((m) => (
            <PillButton
              key={m}
              label={m === 'OFF' ? 'Off' : m === 'TRANSPARENCY' ? 'Transparency' : 'ANC'}
              active={arctis.ancMode === m}
              onClick={() => { updateArctis({ ancMode: m }); void sendCmd('setAncMode', m) }}
              style={{ flex: 1 }}
            />
          ))}
        </div>
      </Section>

      {/* Sidetone */}
      <Section title="Sidetone">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['OFF', 'LOW', 'MEDIUM', 'HIGH'] as ArctisState['sidetone'][]).map((s) => (
            <PillButton
              key={s}
              label={s === 'OFF' ? 'Off' : s === 'LOW' ? 'Low' : s === 'MEDIUM' ? 'Med' : 'High'}
              active={arctis.sidetone === s}
              onClick={() => { updateArctis({ sidetone: s }); void sendCmd('setSidetone', s) }}
              style={{ flex: 1 }}
            />
          ))}
        </div>
      </Section>

      {/* EQ */}
      <Section title="EQ">
        <div
          style={{
            overflowX: 'auto',
            paddingBottom: 8,
          }}
          className="eq-panel-faders"
        >
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, minWidth: 'max-content' }}>
            {arctis.eqBands.map((band, i) => (
              <EqFader
                key={i}
                band={i}
                value={band}
                onChange={(v) => {
                  const bands = [...arctis.eqBands]
                  bands[i] = v
                  updateArctis({ eqBands: bands, eqPresetIndex: 0x04 })
                  void sendCmd('setEqBand', { band: i, value: v })
                }}
              />
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
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
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function BatteryRow({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-secondary)', minWidth: 60 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: 'var(--color-surface-raised)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: value > 20 ? 'var(--color-ok)' : 'var(--color-warn)',
            borderRadius: 3,
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <span style={{ color: 'var(--color-text-primary)', minWidth: 36, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

function SliderRow({
  value, max, label, onChange,
}: {
  value: number
  max: number
  label: string
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
      />
      <span style={{ color: 'var(--color-text-primary)', fontSize: 13, minWidth: 36, textAlign: 'right' }}>
        {label}
      </span>
    </div>
  )
}

function PillButton({
  label, active, onClick, style,
}: {
  label: string
  active: boolean
  onClick: () => void
  style?: React.CSSProperties
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid var(--color-border)',
        background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        color: active ? 'var(--color-bg)' : 'var(--color-text-primary)',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 100ms, color 100ms',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

const EQ_LABELS = ['65', '125', '250', '500', '1k', '2k', '4k', '8k', '16k', '20k']

function EqFader({ band, value, onChange }: { band: number; value: number; onChange: (v: number) => void }): JSX.Element {
  // value: 0–40 where 20 = flat (0 dB), range is ±6 dB in 0.5 dB steps
  const db = ((value - 20) * 0.5).toFixed(1)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 40,
      }}
      className="eq-fader-column"
    >
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{db > '0' ? `+${db}` : db}</span>
      <input
        type="range"
        min={0}
        max={40}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          writingMode: 'vertical-lr',
          direction: 'rtl',
          accentColor: 'var(--color-accent)',
          height: 80,
          cursor: 'pointer',
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{EQ_LABELS[band]}</span>
    </div>
  )
}
