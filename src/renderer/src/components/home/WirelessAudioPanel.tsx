import { useServiceStore } from '../../stores/serviceStore'
import { SliderInput } from '../SliderInput'
import type { ArctisState, Option } from '@shared/types'

const WIRELESS_MODE_OPTIONS: Option<ArctisState['wirelessMode']>[] = [
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'EXTENDED_RANGE', label: 'Range' },
]

const BT_AUTO_MUTE_OPTIONS: Option<ArctisState['btAutoMute']>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'DB_MINUS_12', label: '-12 dB' },
  { value: 'FULL', label: 'Full' },
]

const BOOL_OPTIONS: Option<'OFF' | 'ON'>[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'ON', label: 'On' },
]

const AUDIO_OUTPUT_OPTIONS: Option<ArctisState['audioOutput']>[] = [
  { value: 'SPEAKERS', label: 'Speakers' },
  { value: 'STREAM', label: 'Stream' },
]

function WirelessIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  )
}

function GridRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div
      className="flex overflow-hidden rounded"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 text-xs py-1 px-2 transition-colors"
          style={{
            background: value === opt.value ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: value === opt.value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
            borderRight: i < options.length - 1 ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function WirelessAudioPanel({ state }: { state: ArctisState }): JSX.Element {
  const { updateArctisState } = useServiceStore()

  function cmd<K extends keyof ArctisState>(
    cmdName: string,
    value: unknown,
    patch: Pick<ArctisState, K>,
  ): void {
    updateArctisState(patch)
    window.api.arctisCmd(cmdName, value).catch(console.error)
  }

  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col"
      style={{ background: 'transparent', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}><WirelessIcon /></span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Wireless & Audio Output
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <GridRow label="2.4 GHz Mode">
          <OptionGroup
            value={state.wirelessMode}
            options={WIRELESS_MODE_OPTIONS}
            onChange={(v) => cmd('setWirelessMode', v, { wirelessMode: v })}
          />
        </GridRow>
        <GridRow label="BT Default">
          <OptionGroup
            value={state.btDefault ? 'ON' : 'OFF'}
            options={BOOL_OPTIONS}
            onChange={(v) => {
              const val = v === 'ON'
              cmd('setBtDefault', val, { btDefault: val })
            }}
          />
        </GridRow>
        <GridRow label="BT Auto Mute">
          <OptionGroup
            value={state.btAutoMute}
            options={BT_AUTO_MUTE_OPTIONS}
            onChange={(v) => cmd('setBtAutoMute', v, { btAutoMute: v })}
          />
        </GridRow>
        <GridRow label="Output">
          <OptionGroup
            value={state.audioOutput}
            options={AUDIO_OUTPUT_OPTIONS}
            onChange={(v) => cmd('setAudioOutput', v, { audioOutput: v })}
          />
        </GridRow>
        {state.audioOutput === 'STREAM' && (
          <>
            {(
              [
                { label: 'Main', value: state.streamMain, onChange: (v: number) => { updateArctisState({ streamMain: v }); window.api.arctisCmd('setStreamVolumes', { main: v, aux: state.streamAux, mic: state.streamMic }).catch(console.error) } },
                { label: 'Aux',  value: state.streamAux,  onChange: (v: number) => { updateArctisState({ streamAux: v });  window.api.arctisCmd('setStreamVolumes', { main: state.streamMain, aux: v, mic: state.streamMic }).catch(console.error) } },
                { label: 'Mic',  value: state.streamMic,  onChange: (v: number) => { updateArctisState({ streamMic: v });  window.api.arctisCmd('setStreamVolumes', { main: state.streamMain, aux: state.streamAux, mic: v }).catch(console.error) } },
              ] as const
            ).map(({ label, value, onChange }) => (
              <div key={label} className="flex items-center gap-2 py-1">
                <span className="text-xs w-6 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <SliderInput
                  value={value / 100}
                  onChange={(v) => onChange(Math.round(v * 100))}
                />
                <span className="text-xs mono w-10 text-right shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                  {value}%
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
