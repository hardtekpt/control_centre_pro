import { useCallback, memo } from 'react'
import type { SonarChannel, SonarAudioDevice, SonarConfig } from '@shared/types'
import { VerticalFader } from './VerticalFader'
import { LevelMeter } from './LevelMeter'
import { OutputDropdown } from './OutputDropdown'
import { PresetSelector } from './PresetSelector'
import { dbFor } from '../data/catalogues'
import { useSonarStore } from '../../../stores/sonarStore'

function SpeakerIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

export interface MasterStripProps {
  /** 0-1 */
  volume: number
  muted: boolean
  /** Peak level 0-100 (0 = no data yet) */
  peak: number
  audioDevices: SonarAudioDevice[]
  currentDevice?: SonarAudioDevice
  configs: SonarConfig[]
  activePresetId?: string
  onVolume: (channel: SonarChannel, v: number) => void
  onMute: (channel: SonarChannel) => void
  onDeviceSelect: (channel: SonarChannel, deviceId: string) => void
  onPresetSelect: (channel: SonarChannel, configId: string) => void
}

function MasterStripComponent({
  volume,
  muted,
  peak,
  audioDevices,
  currentDevice,
  configs,
  activePresetId,
  onVolume,
  onMute,
  onDeviceSelect,
  onPresetSelect,
}: MasterStripProps): JSX.Element {
  const beginDrag = useSonarStore((s) => s.beginDrag)
  const endDrag   = useSonarStore((s) => s.endDrag)

  const handleVolume = useCallback((v: number) => onVolume('master', v / 100), [onVolume])
  const handleMute   = useCallback(() => onMute('master'), [onMute])

  const level = Math.round(volume * 100)

  return (
    <div className={`sn-strip master-strip${muted ? ' muted' : ''}`}>
      {/* Header */}
      <div className="sn-strip-head">
        <div className="sn-strip-ic"><SpeakerIcon /></div>
        <div className="sn-strip-meta">
          <div className="sn-strip-name">Master</div>
          <div className="sn-strip-sub">sum bus</div>
        </div>
      </div>

      {/* App zone — static tag */}
      <div className="sn-app-zone master-zone">
        <span className="sn-master-tag">SUM OF ALL CHANNELS</span>
      </div>

      {/* Fader + meter */}
      <div className="sn-strip-body">
        <VerticalFader
          value={level}
          onChange={handleVolume}
          muted={muted}
          height={200}
          onDragStart={beginDrag}
          onDragEnd={endDrag}
        />
        <LevelMeter peak={peak} muted={muted} height={200} />
      </div>

      {/* dB readout */}
      <div className="sn-strip-readout">
        <span className="sn-db-val">{dbFor(level)}</span>
        <span className="sn-db-unit">dB</span>
      </div>

      {/* Mute only — no Solo on master */}
      <div className="sn-strip-actions">
        <button
          className={`sn-mute-btn${muted ? ' on' : ''}`}
          onClick={handleMute}
          title={muted ? 'Unmute' : 'Mute'}
          style={{ flex: 1 }}
        >
          M
        </button>
      </div>

      {/* Preset selector */}
      <PresetSelector
        configs={configs}
        activePresetId={activePresetId}
        channel="master"
        onSelect={onPresetSelect}
      />

      {/* Output */}
      <OutputDropdown
        devices={audioDevices}
        currentDevice={currentDevice}
        channel="master"
        onChange={onDeviceSelect}
      />
    </div>
  )
}

export const MasterStrip = memo(MasterStripComponent)
