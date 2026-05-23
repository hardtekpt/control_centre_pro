import { useState, useCallback, memo } from 'react'
import type { SonarChannel, SonarAudioSession, SonarAudioDevice } from '@shared/types'
import { VerticalFader } from './VerticalFader'
import { LevelMeter } from './LevelMeter'
import { AppChip } from './AppChip'
import { OutputDropdown } from './OutputDropdown'
import { dbFor } from '../data/catalogues'
import { useSonarStore } from '../../../stores/sonarStore'

export interface ChannelStripProps {
  channel: SonarChannel
  label: string
  icon: React.ReactNode
  /** 0-1 */
  volume: number
  muted: boolean
  /** Peak level 0-100 (0 = no data yet) */
  peak: number
  routedSessions: SonarAudioSession[]
  audioDevices: SonarAudioDevice[]
  currentDevice?: SonarAudioDevice
  onVolume: (channel: SonarChannel, v: number) => void
  onMute: (channel: SonarChannel) => void
  onDeviceSelect: (channel: SonarChannel, deviceId: string) => void
  onProcessDrop: (processId: number) => void
}

function ChannelStripComponent({
  channel,
  label,
  icon,
  volume,
  muted,
  peak,
  routedSessions,
  audioDevices,
  currentDevice,
  onVolume,
  onMute,
  onDeviceSelect,
  onProcessDrop,
}: ChannelStripProps): JSX.Element {
  const isMic = channel === 'chatCapture'
  const [isDragOver, setIsDragOver] = useState(false)

  const handleVolume = useCallback(
    (v: number) => onVolume(channel, v / 100),
    [channel, onVolume],
  )
  const handleMute = useCallback(() => onMute(channel), [channel, onMute])
  const beginDrag = useSonarStore((s) => s.beginDrag)
  const endDrag   = useSonarStore((s) => s.endDrag)

  const activeSession = routedSessions.filter((s) => s.state === 'active')
  const appCount = activeSession.length

  function handleDragOver(e: React.DragEvent): void {
    if (isMic) return
    if (e.dataTransfer.types.includes('application/sonar-session')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }
  function handleDragLeave(e: React.DragEvent): void {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }
  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/sonar-session')) as {
        processId: number
        sourceRole: string
      }
      if (data.sourceRole !== channel) onProcessDrop(data.processId)
    } catch {
      // malformed drag — ignore
    }
  }

  const level = Math.round(volume * 100)

  return (
    <div
      className={`sn-strip${muted ? ' muted' : ''}${isDragOver ? ' drop-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="sn-strip-head">
        <div className="sn-strip-ic">{icon}</div>
        <div className="sn-strip-meta">
          <div className="sn-strip-name">{label}</div>
          <div className="sn-strip-sub">
            {isMic ? 'input' : `${appCount} app${appCount === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* App zone */}
      <div className={`sn-app-zone${isMic ? ' mic-zone' : ''}${isDragOver ? ' drop-over' : ''}${appCount === 0 && !isMic ? ' empty' : ''}`}>
        {isMic ? (
          <span className="sn-mic-tag">ARCTIS · MIC IN</span>
        ) : appCount > 0 ? (
          activeSession.map((s) => (
            <AppChip
              key={s.id}
              session={s}
              size="sm"
              draggable
              onDragStart={() => {}}
              onDragEnd={() => {}}
            />
          ))
        ) : (
          <span className="sn-app-zone-empty">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            drop app
          </span>
        )}
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

      {/* Mute / Solo */}
      <div className="sn-strip-actions">
        <button
          className={`sn-mute-btn${muted ? ' on' : ''}`}
          onClick={handleMute}
          title={muted ? 'Unmute' : 'Mute'}
        >
          M
        </button>
        <button className="sn-solo-btn" title="Solo">S</button>
      </div>

      {/* Output */}
      <OutputDropdown
        devices={audioDevices}
        currentDevice={currentDevice}
        channel={channel}
        onChange={onDeviceSelect}
      />
    </div>
  )
}

export const ChannelStrip = memo(ChannelStripComponent)
