import { useServiceStore } from '../stores/serviceStore'
import { post } from '../api/http'
import { Card } from '../components/Card'
import { Select } from '../components/Select'
import { WifiIcon, BluetoothIcon, HeadsetIcon, MicIcon } from '../components/icons'
import {
  PageHeader, Field, Slider, SliderInput, OptionGroup, BatteryIndicator,
  text, space,
} from '../theme'
import type { SegmentOption } from '../theme'
import type { ArctisState, TimeoutStep } from '@shared/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMEOUT_OPTIONS: SegmentOption<TimeoutStep>[] = [
  { value: 'OFF',         label: 'Off' },
  { value: 'ONE_MIN',     label: '1m' },
  { value: 'FIVE_MIN',    label: '5m' },
  { value: 'TEN_MIN',     label: '10m' },
  { value: 'FIFTEEN_MIN', label: '15m' },
  { value: 'THIRTY_MIN',  label: '30m' },
  { value: 'SIXTY_MIN',   label: '60m' },
]

const EQ_CUSTOM_INDEX = 0x04
const EQ_NAMED_PRESETS: { index: number; label: string }[] = [
  { index: 0x00, label: 'Flat' },
  { index: 0x01, label: 'Bass Boost' },
  { index: 0x02, label: 'Focus' },
  { index: 0x03, label: 'Smiley' },
  { index: 0x05, label: 'Apex Legends' },
  { index: 0x06, label: "Baldur's Gate 3" },
  { index: 0x07, label: 'COD Modern Warfare II' },
  { index: 0x08, label: 'COD Warzone 2' },
  { index: 0x09, label: 'Destiny 2' },
  { index: 0x0A, label: 'Diablo IV' },
  { index: 0x0B, label: 'Fortnite' },
  { index: 0x0C, label: 'FPS Footsteps' },
  { index: 0x0D, label: 'GTA V' },
  { index: 0x0E, label: 'Minecraft' },
  { index: 0x0F, label: 'Overwatch 2' },
  { index: 0x10, label: 'Player Unknown Battleground' },
  { index: 0x11, label: 'Rainbow Six Siege' },
  { index: 0x12, label: 'Rocket League' },
]
const EQ_BAND_FREQS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K']

// ── Page-specific icons ────────────────────────────────────────────────────────

function SonarIcon(): JSX.Element {
  return <span className="mono" style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.5px' }}>GG</span>
}

function VolumeLimiterIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="1"  y="14" width="4" height="9"  rx="1" />
      <rect x="7"  y="10" width="4" height="13" rx="1" />
      <rect x="13" y="6"  width="4" height="17" rx="1" />
      <rect x="19" y="2"  width="4" height="21" rx="1" />
      <rect x="1"  y="1"  width="22" height="2" rx="1" />
    </svg>
  )
}

function BaseStationIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="12" rx="2" />
      <path d="M6 12h12M6 16h12" />
    </svg>
  )
}

function EqIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="3" height="16" rx="1" />
      <rect x="10" y="8" width="3" height="12" rx="1" />
      <rect x="18" y="6" width="3" height="14" rx="1" />
    </svg>
  )
}

// ── Connectivity status indicators ─────────────────────────────────────────────

function ConnectivityIcon({
  icon, active, title,
}: {
  icon: React.ReactNode; active: boolean; title: string
}): JSX.Element {
  return (
    <span
      title={title}
      style={{
        color: active ? 'var(--color-status-ok)' : 'var(--color-text-secondary)',
        opacity: active ? 1 : 0.45,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {icon}
    </span>
  )
}

function StatusBadge({
  on, title, children, errorWhenOn = false,
}: {
  on: boolean
  title: string
  children: React.ReactNode
  /** When true, the "on" state renders in error colors (e.g. mic muted). */
  errorWhenOn?: boolean
}): JSX.Element {
  const fg = on
    ? errorWhenOn ? 'var(--color-status-error)' : 'var(--color-status-ok)'
    : 'var(--color-text-secondary)'
  const bg = on
    ? errorWhenOn ? 'var(--color-status-error-bg)' : 'var(--color-status-ok-bg)'
    : 'var(--color-status-inactive-bg)'
  const border = on
    ? errorWhenOn ? 'var(--color-status-error)' : 'var(--color-status-ok)'
    : 'var(--color-border)'
  return (
    <div
      title={title}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

function MicMuteIndicator({ muted }: { muted: boolean }): JSX.Element {
  // Mic indicator is always "lit": green when active, red when muted.
  return (
    <div
      title={muted ? 'Microphone muted' : 'Microphone active'}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: muted ? 'var(--color-status-error-bg)' : 'var(--color-status-ok-bg)',
        border: `1px solid ${muted ? 'var(--color-status-error)' : 'var(--color-status-ok)'}`,
        color: muted ? 'var(--color-status-error)' : 'var(--color-status-ok)',
        flexShrink: 0,
      }}
    >
      <MicIcon size={10} />
    </div>
  )
}

// ── HeadsetCard ────────────────────────────────────────────────────────────────

function HeadsetCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  const batteryHeadset = Math.round(s.batteryHeadset)
  const batteryDock = Math.round(s.batteryDock)
  const volume = Math.round(s.volume)

  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }

  const disabledStyle: React.CSSProperties = s.baseStationConnected
    ? {}
    : { opacity: 0.4, pointerEvents: 'none' }

  return (
    <Card
      title="Arctis Nova Pro Wireless"
      icon={
        <span style={{ color: s.baseStationConnected && s.headsetPowered !== false ? 'var(--color-status-ok)' : 'var(--color-accent)', display: 'flex' }}>
          <HeadsetIcon size={16} />
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.rowGap }}>
        {/* Status row: connectivity + indicators + batteries (wraps on narrow screens) */}
        {s.baseStationConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ConnectivityIcon
              icon={<WifiIcon size={13} />}
              active={s.wirelessConnected}
              title={`2.4 GHz — ${s.wirelessConnected ? 'Active' : 'Absent'}`}
            />
            <ConnectivityIcon
              icon={<BluetoothIcon size={13} />}
              active={s.btStatus === 'CONNECTED'}
              title={`Bluetooth — ${s.btStatus === 'CONNECTED' ? 'Connected' : s.btStatus === 'PAIRING' ? 'Pairing' : s.btStatus === 'ON' ? 'On' : 'Off'}`}
            />
            <StatusBadge on={s.sonarConnected} title={s.sonarConnected ? 'GG Sonar connected' : 'GG Sonar not detected'}>
              <SonarIcon />
            </StatusBadge>
            <StatusBadge on={s.volumeLimiterOn} title={s.volumeLimiterOn ? 'Volume limiter on' : 'Volume limiter off'}>
              <VolumeLimiterIcon />
            </StatusBadge>
            <MicMuteIndicator muted={s.micMuted} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              {s.headsetPowered !== false && (
                <BatteryIndicator level={batteryHeadset} title={`Headset: ${batteryHeadset}%`} />
              )}
              <BatteryIndicator level={batteryDock} charging title={`Dock: ${batteryDock}%`} hidePercent />
            </div>
          </div>
        )}

        {/* Volume */}
        <div style={disabledStyle}>
          <Field label="Volume">
            <Slider
              value={volume}
              unit="%"
              onChange={(v) => { update({ volume: v }); cmd('setVolume', v) }}
            />
          </Field>
        </div>

        {/* ChatMix */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...disabledStyle }}>
          <button
            onClick={() => { update({ chatmixEnabled: !s.chatmixEnabled }); cmd('setChatmixEnabled', !s.chatmixEnabled) }}
            className="card-row-label"
            style={{
              width: 68,
              flexShrink: 0,
              textAlign: 'left',
              textDecoration: s.chatmixEnabled ? 'none' : 'line-through',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            ChatMix
          </button>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: s.chatmixEnabled ? 1 : 0.3,
              transition: 'opacity 150ms ease',
              pointerEvents: 'none',
            }}
          >
            <span style={{ ...text.value, flexShrink: 0 }}>Game {s.chatmixGame}</span>
            <div style={{ flex: 1, minWidth: 0, height: 4, borderRadius: 9999, overflow: 'hidden', background: 'var(--color-border)' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 9999,
                  width: `${(s.chatmixChat - s.chatmixGame + 100) / 2}%`,
                  background: 'var(--color-accent)',
                  transition: 'width 150ms ease',
                }}
              />
            </div>
            <span style={{ ...text.value, flexShrink: 0 }}>{s.chatmixChat} Chat</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── AudioOptionsCard ───────────────────────────────────────────────────────────

const ANC_OPTIONS: SegmentOption<ArctisState['ancMode']>[] = [
  { value: 'OFF',          label: 'Off' },
  { value: 'TRANSPARENCY', label: 'Transparency' },
  { value: 'ANC',          label: 'ANC' },
]
const GAIN_OPTIONS: SegmentOption<ArctisState['micGain']>[] = [
  { value: 'LOW',  label: 'Low' },
  { value: 'HIGH', label: 'High' },
]
const SIDETONE_OPTIONS: SegmentOption<ArctisState['sidetone']>[] = [
  { value: 'OFF',    label: 'Off' },
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Med' },
  { value: 'HIGH',   label: 'High' },
]

function AudioOptionsCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }
  return (
    <Card title="Audio Options" icon={<MicIcon size={14} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sectionGap }}>
        <Field stack label="ANC">
          <OptionGroup
            value={s.ancMode}
            options={ANC_OPTIONS}
            onChange={(v) => { update({ ancMode: v }); cmd('setAncMode', v) }}
          />
          {s.ancMode === 'TRANSPARENCY' && (
            <div style={{ marginTop: 8 }}>
              <Slider
                value={s.transparencyLevel}
                min={1}
                max={10}
                onChange={(v) => { update({ transparencyLevel: v }); cmd('setTransparencyLevel', v) }}
              />
            </div>
          )}
        </Field>
        <Field stack label="Gain">
          <OptionGroup
            value={s.micGain}
            options={GAIN_OPTIONS}
            onChange={(v) => { update({ micGain: v }); cmd('setMicGain', v) }}
          />
        </Field>
        <Field stack label="Sidetone">
          <OptionGroup
            value={s.sidetone}
            options={SIDETONE_OPTIONS}
            onChange={(v) => { update({ sidetone: v }); cmd('setSidetone', v) }}
          />
        </Field>
        <Field stack label="Mic Volume">
          <Slider
            value={s.micVolume}
            min={1}
            max={10}
            onChange={(v) => { update({ micVolume: v }); cmd('setMicVolume', v) }}
          />
        </Field>
      </div>
    </Card>
  )
}

// ── WirelessCard ───────────────────────────────────────────────────────────────

const WIRELESS_MODE_OPTIONS: SegmentOption<ArctisState['wirelessMode']>[] = [
  { value: 'PERFORMANCE',    label: 'Performance' },
  { value: 'EXTENDED_RANGE', label: 'Range' },
]
const BT_AUTO_MUTE_OPTIONS: SegmentOption<ArctisState['btAutoMute']>[] = [
  { value: 'OFF',         label: 'Off' },
  { value: 'DB_MINUS_12', label: '-12 dB' },
  { value: 'FULL',        label: 'Full' },
]
const BOOL_OPTIONS: SegmentOption<'OFF' | 'ON'>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'ON',  label: 'On' },
]
const AUDIO_OUTPUT_OPTIONS: SegmentOption<ArctisState['audioOutput']>[] = [
  { value: 'SPEAKERS', label: 'Speakers' },
  { value: 'STREAM',   label: 'Stream' },
]

function WirelessCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }
  return (
    <Card title="Wireless & Audio Output" icon={<WifiIcon size={14} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sectionGap }}>
        <Field stack label="2.4 GHz Mode">
          <OptionGroup
            value={s.wirelessMode}
            options={WIRELESS_MODE_OPTIONS}
            onChange={(v) => { update({ wirelessMode: v }); cmd('setWirelessMode', v) }}
          />
        </Field>
        <Field stack label="BT Default">
          <OptionGroup
            value={s.btDefault ? 'ON' : 'OFF'}
            options={BOOL_OPTIONS}
            onChange={(v) => {
              const val = v === 'ON'
              update({ btDefault: val }); cmd('setBtDefault', val)
            }}
          />
        </Field>
        <Field stack label="BT Auto Mute">
          <OptionGroup
            value={s.btAutoMute}
            options={BT_AUTO_MUTE_OPTIONS}
            onChange={(v) => { update({ btAutoMute: v }); cmd('setBtAutoMute', v) }}
          />
        </Field>
        <Field stack label="Output">
          <OptionGroup
            value={s.audioOutput}
            options={AUDIO_OUTPUT_OPTIONS}
            onChange={(v) => { update({ audioOutput: v }); cmd('setAudioOutput', v) }}
          />
        </Field>
        {s.audioOutput === 'STREAM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
            {(
              [
                { label: 'Main', key: 'streamMain' as const, value: s.streamMain },
                { label: 'Aux',  key: 'streamAux'  as const, value: s.streamAux  },
                { label: 'Mic',  key: 'streamMic'  as const, value: s.streamMic  },
              ]
            ).map(({ label, key, value }) => (
              <Field key={key} label={label}>
                <Slider
                  value={value}
                  unit="%"
                  onChange={(v) => {
                    update({ [key]: v } as Partial<ArctisState>)
                    void post('/api/arctis/cmd', {
                      cmd: 'setStreamVolumes',
                      value: {
                        main: key === 'streamMain' ? v : s.streamMain,
                        aux:  key === 'streamAux'  ? v : s.streamAux,
                        mic:  key === 'streamMic'  ? v : s.streamMic,
                      },
                    })
                  }}
                />
              </Field>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── BaseStationCard ────────────────────────────────────────────────────────────

function BaseStationCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }
  return (
    <Card title="Base Station" icon={<BaseStationIcon />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sectionGap }}>
        <Field stack label="OLED Brightness">
          <Slider
            value={s.oledBrightness}
            min={1}
            max={10}
            onChange={(v) => { update({ oledBrightness: v }); cmd('setOledBrightness', v) }}
          />
        </Field>
        <Field stack label="Dim Screen">
          <OptionGroup
            value={s.dimTimeout}
            options={TIMEOUT_OPTIONS}
            onChange={(v) => { update({ dimTimeout: v }); cmd('setDimTimeout', v) }}
          />
        </Field>
        <Field stack label="Homescreen">
          <OptionGroup
            value={s.homescreenMode}
            options={[
              { value: 'DETAILED' as const, label: 'Detailed' },
              { value: 'SIMPLE'   as const, label: 'Simple' },
            ]}
            onChange={(v) => { update({ homescreenMode: v }); cmd('setHomeScreenMode', v) }}
          />
        </Field>
        <Field stack label="Mic LED">
          <Slider
            value={s.micLedBrightness}
            min={1}
            max={10}
            onChange={(v) => { update({ micLedBrightness: v }); cmd('setMicLedBrightness', v) }}
          />
        </Field>
        <Field stack label="Auto Off">
          <OptionGroup
            value={s.autoOffTimeout}
            options={TIMEOUT_OPTIONS}
            onChange={(v) => { update({ autoOffTimeout: v }); cmd('setAutoOffTimeout', v) }}
          />
        </Field>
      </div>
    </Card>
  )
}

// ── EqCard ─────────────────────────────────────────────────────────────────────

function EqCard({ s, update }: { s: ArctisState; update: (p: Partial<ArctisState>) => void }): JSX.Element {
  const isCustom = s.eqPresetIndex === EQ_CUSTOM_INDEX
  const bands = s.eqBands?.length === 10 ? s.eqBands : Array(10).fill(20)

  function cmd(c: string, v: unknown): void {
    void post('/api/arctis/cmd', { cmd: c, value: v })
  }

  const presetOptions = [
    ...EQ_NAMED_PRESETS.map((p) => ({ value: String(p.index), label: p.label })),
    ...(!isCustom && !EQ_NAMED_PRESETS.some((p) => p.index === s.eqPresetIndex)
      ? [{ value: String(s.eqPresetIndex), label: `Preset ${s.eqPresetIndex}` }]
      : []),
  ]

  return (
    <Card title="EQ" icon={<EqIcon />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sectionGap }}>
        <Field stack label="Mode">
          <OptionGroup
            value={isCustom ? 'CUSTOM' : 'PRESET'}
            options={[
              { value: 'CUSTOM' as const, label: 'Custom' },
              { value: 'PRESET' as const, label: 'Preset' },
            ]}
            onChange={(v) => {
              if (v === 'CUSTOM') {
                update({ eqPresetIndex: EQ_CUSTOM_INDEX }); cmd('setEqBands', bands)
              } else {
                const idx = EQ_NAMED_PRESETS[0].index
                update({ eqPresetIndex: idx }); cmd('setEqPreset', idx)
              }
            }}
          />
        </Field>

        {!isCustom && (
          <Field stack label="Preset">
            <Select
              compact
              ariaLabel="EQ preset"
              value={String(s.eqPresetIndex)}
              onChange={(v) => {
                const idx = Number(v)
                if (idx === EQ_CUSTOM_INDEX) {
                  update({ eqPresetIndex: EQ_CUSTOM_INDEX }); cmd('setEqBands', bands)
                } else {
                  update({ eqPresetIndex: idx }); cmd('setEqPreset', idx)
                }
              }}
              options={presetOptions}
            />
          </Field>
        )}

        {isCustom && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: '0 4px',
            }}
          >
            {EQ_BAND_FREQS.map((freq, i) => {
              const raw = bands[i] ?? 20
              const db = raw - 20
              const normalized = raw / 40
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ ...text.value, fontSize: 9, lineHeight: 1 }}>{freq}</span>
                  <div style={{ height: 144, width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SliderInput
                      value={normalized}
                      onChange={(v) => {
                        const newBands = [...bands]
                        newBands[i] = Math.round(v * 40)
                        update({ eqBands: newBands })
                        cmd('setEqBands', newBands)
                      }}
                      orientation="vertical"
                    />
                  </div>
                  <span style={{ ...text.value, fontSize: 9, lineHeight: 1 }}>
                    {db > 0 ? `+${db}` : db}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function Arctis(): JSX.Element {
  const arctis = useServiceStore((s) => s.arctisState)
  const updateArctis = useServiceStore((s) => s.updateArctisState)

  if (!arctis) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', padding: 24 }}>
        <span style={text.bodyMuted}>Arctis Nova Pro not connected</span>
      </div>
    )
  }

  const panelStyle: React.CSSProperties = !arctis.baseStationConnected
    ? { opacity: 0.4, pointerEvents: 'none' }
    : {}

  return (
    <div className="page">
      <PageHeader title="Arctis" />

      <HeadsetCard s={arctis} update={updateArctis} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: space.cardGap, ...panelStyle }}>
        <AudioOptionsCard s={arctis} update={updateArctis} />
        <WirelessCard s={arctis} update={updateArctis} />
      </div>

      <div style={panelStyle}>
        <BaseStationCard s={arctis} update={updateArctis} />
      </div>

      <div style={panelStyle}>
        <EqCard s={arctis} update={updateArctis} />
      </div>
    </div>
  )
}
