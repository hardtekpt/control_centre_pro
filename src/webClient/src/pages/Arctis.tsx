import { useServiceStore } from '../stores/serviceStore'
import { post } from '../api/http'
import type { ArctisState, TimeoutStep } from '@shared/types'

const TIMEOUT_STEPS: TimeoutStep[] = ['OFF', 'ONE_MIN', 'FIVE_MIN', 'TEN_MIN', 'FIFTEEN_MIN', 'THIRTY_MIN', 'SIXTY_MIN']
const TIMEOUT_LABELS: Record<TimeoutStep, string> = {
  OFF: 'Off',
  ONE_MIN: '1 min',
  FIVE_MIN: '5 min',
  TEN_MIN: '10 min',
  FIFTEEN_MIN: '15 min',
  THIRTY_MIN: '30 min',
  SIXTY_MIN: '60 min',
}

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

  const disabled = !arctis.baseStationConnected
  const disabledStyle: React.CSSProperties = disabled
    ? { opacity: 0.4, pointerEvents: 'none' }
    : {}

  return (
    <div style={{ padding: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>
        Arctis Nova Pro
      </h1>

      {/* Status */}
      <Section title="Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BatteryRow label="Headset" value={arctis.batteryHeadset} />
          <BatteryRow label="Dock" value={arctis.batteryDock} />
          <InfoRow label="Wireless" value={arctis.wirelessConnected ? 'Connected' : 'Disconnected'} />
          <InfoRow label="BT" value={arctis.btStatus} />
          <InfoRow
            label="Mic"
            value={arctis.micMuted ? 'Muted' : 'Active'}
            valueColor={arctis.micMuted ? 'var(--color-warn)' : 'var(--color-ok)'}
          />
        </div>
      </Section>

      {/* Volume */}
      <Section title="Volume" style={disabledStyle}>
        <SliderRow
          value={arctis.volume}
          max={100}
          label={`${Math.round(arctis.volume)}%`}
          onChange={(v) => {
            updateArctis({ volume: v })
            void sendCmd('setVolume', v)
          }}
        />
      </Section>

      {/* ChatMix */}
      {arctis.chatmixEnabled && (
        <Section title="ChatMix" style={disabledStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            <span>Game {arctis.chatmixGame}</span>
            <span>Chat {arctis.chatmixChat}</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-surface-raised)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${arctis.chatmixGame}%`,
                height: '100%',
                background: 'var(--color-accent)',
                borderRadius: 3,
              }}
            />
          </div>
        </Section>
      )}

      {/* ANC */}
      <Section title="ANC Mode" style={disabledStyle}>
        <div style={{ display: 'flex', gap: 6 }}>
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
        {arctis.ancMode === 'TRANSPARENCY' && (
          <div style={{ marginTop: 8 }}>
            <SliderRow
              value={arctis.transparencyLevel}
              max={10}
              label={`${arctis.transparencyLevel}`}
              onChange={(v) => {
                updateArctis({ transparencyLevel: v })
                void sendCmd('setTransparencyLevel', v)
              }}
            />
          </div>
        )}
      </Section>

      {/* Sidetone */}
      <Section title="Sidetone" style={disabledStyle}>
        <div style={{ display: 'flex', gap: 6 }}>
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

      {/* Audio Options + Wireless — 2-column on wider screens */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {/* Audio Options */}
        <Section title="Audio Options" style={disabledStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>Mic Gain</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['LOW', 'HIGH'] as ArctisState['micGain'][]).map((g) => (
                  <PillButton
                    key={g}
                    label={g === 'LOW' ? 'Low' : 'High'}
                    active={arctis.micGain === g}
                    onClick={() => { updateArctis({ micGain: g }); void sendCmd('setMicGain', g) }}
                    style={{ flex: 1 }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Mic Volume</div>
              <SliderRow
                value={arctis.micVolume}
                max={10}
                label={`${arctis.micVolume}`}
                onChange={(v) => {
                  updateArctis({ micVolume: v })
                  void sendCmd('setMicVolume', v)
                }}
              />
            </div>
          </div>
        </Section>

        {/* Wireless Audio */}
        <Section title="Wireless" style={disabledStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>2.4 GHz Mode</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['PERFORMANCE', 'EXTENDED_RANGE'] as ArctisState['wirelessMode'][]).map((m) => (
                  <PillButton
                    key={m}
                    label={m === 'PERFORMANCE' ? 'Performance' : 'Extended'}
                    active={arctis.wirelessMode === m}
                    onClick={() => { updateArctis({ wirelessMode: m }); void sendCmd('setWirelessMode', m) }}
                    style={{ flex: 1 }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>BT Auto Mute</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['OFF', 'DB_MINUS_12', 'FULL'] as ArctisState['btAutoMute'][]).map((m) => (
                  <PillButton
                    key={m}
                    label={m === 'OFF' ? 'Off' : m === 'DB_MINUS_12' ? '-12 dB' : 'Full'}
                    active={arctis.btAutoMute === m}
                    onClick={() => { updateArctis({ btAutoMute: m }); void sendCmd('setBtAutoMute', m) }}
                    style={{ flex: 1 }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>Audio Output</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['SPEAKERS', 'STREAM'] as ArctisState['audioOutput'][]).map((m) => (
                  <PillButton
                    key={m}
                    label={m === 'SPEAKERS' ? 'Speakers' : 'Stream'}
                    active={arctis.audioOutput === m}
                    onClick={() => { updateArctis({ audioOutput: m }); void sendCmd('setAudioOutput', m) }}
                    style={{ flex: 1 }}
                  />
                ))}
              </div>
            </div>
            {arctis.audioOutput === 'STREAM' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Stream Levels</div>
                <SliderRow
                  value={arctis.streamMain}
                  max={100}
                  label={`Main ${Math.round(arctis.streamMain)}%`}
                  onChange={(v) => { updateArctis({ streamMain: v }); void sendCmd('setStreamMain', v) }}
                />
                <SliderRow
                  value={arctis.streamAux}
                  max={100}
                  label={`Aux ${Math.round(arctis.streamAux)}%`}
                  onChange={(v) => { updateArctis({ streamAux: v }); void sendCmd('setStreamAux', v) }}
                />
                <SliderRow
                  value={arctis.streamMic}
                  max={100}
                  label={`Mic ${Math.round(arctis.streamMic)}%`}
                  onChange={(v) => { updateArctis({ streamMic: v }); void sendCmd('setStreamMic', v) }}
                />
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Base Station */}
      <Section title="Base Station" style={disabledStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>OLED Brightness</div>
            <SliderRow
              value={arctis.oledBrightness}
              max={10}
              label={`${arctis.oledBrightness}`}
              onChange={(v) => { updateArctis({ oledBrightness: v }); void sendCmd('setOledBrightness', v) }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Mic LED</div>
            <SliderRow
              value={arctis.micLedBrightness}
              max={10}
              label={`${arctis.micLedBrightness}`}
              onChange={(v) => { updateArctis({ micLedBrightness: v }); void sendCmd('setMicLedBrightness', v) }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Dim Screen</div>
              <select
                value={arctis.dimTimeout}
                onChange={(e) => {
                  const v = e.target.value as TimeoutStep
                  updateArctis({ dimTimeout: v })
                  void sendCmd('setDimTimeout', v)
                }}
                style={selectStyle}
              >
                {TIMEOUT_STEPS.map((s) => (
                  <option key={s} value={s}>{TIMEOUT_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Auto Off</div>
              <select
                value={arctis.autoOffTimeout}
                onChange={(e) => {
                  const v = e.target.value as TimeoutStep
                  updateArctis({ autoOffTimeout: v })
                  void sendCmd('setAutoOffTimeout', v)
                }}
                style={selectStyle}
              >
                {TIMEOUT_STEPS.map((s) => (
                  <option key={s} value={s}>{TIMEOUT_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>Homescreen</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['DETAILED', 'SIMPLE'] as ArctisState['homescreenMode'][]).map((m) => (
                <PillButton
                  key={m}
                  label={m === 'DETAILED' ? 'Detailed' : 'Simple'}
                  active={arctis.homescreenMode === m}
                  onClick={() => { updateArctis({ homescreenMode: m }); void sendCmd('setHomescreenMode', m) }}
                  style={{ flex: 1 }}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* EQ */}
      <Section title="EQ" style={disabledStyle}>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
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

// ── Primitives ────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  background: 'var(--color-surface-raised)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '4px 6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '12px 14px',
        ...style,
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

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ color: valueColor ?? 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}

function BatteryRow({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-secondary)', minWidth: 60 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'var(--color-surface-raised)', borderRadius: 3, overflow: 'hidden' }}>
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
      <span style={{ color: 'var(--color-text-primary)', fontSize: 12, minWidth: 48, textAlign: 'right' }}>
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
        padding: '5px 10px',
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
  const db = ((value - 20) * 0.5).toFixed(1)
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 40 }}
      className="eq-fader-column"
    >
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{Number(db) > 0 ? `+${db}` : db}</span>
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
