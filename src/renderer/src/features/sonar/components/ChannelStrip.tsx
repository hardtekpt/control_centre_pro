import { useState, useCallback, useRef, memo } from 'react'
import type { SonarChannel, SonarAudioSession, SonarAudioDevice, SonarConfig } from '@shared/types'
import { VerticalFader } from './VerticalFader'
import { LevelMeter } from './LevelMeter'
import { AppChip } from './AppChip'
import { OutputDropdown } from './OutputDropdown'
import { PresetSelector } from './PresetSelector'
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
  configs: SonarConfig[]
  activePresetId?: string
  isSoloed: boolean
  onVolume: (channel: SonarChannel, v: number) => void
  onMute: (channel: SonarChannel) => void
  onDeviceSelect: (channel: SonarChannel, deviceId: string) => void
  onProcessDrop: (processId: number) => void
  onPresetSelect: (channel: SonarChannel, configId: string) => void
  onSolo: (channel: SonarChannel) => void
  onOpenEditor: () => void
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
  configs,
  activePresetId,
  isSoloed,
  onVolume,
  onMute,
  onDeviceSelect,
  onProcessDrop,
  onPresetSelect,
  onSolo,
  onOpenEditor,
}: ChannelStripProps): JSX.Element {
  const isMic = channel === 'chatCapture'
  const [isDragOver, setIsDragOver] = useState(false)

  const handleVolume = useCallback(
    (v: number) => onVolume(channel, v / 100),
    [channel, onVolume],
  )
  // Coalescing drag handler: one API call in-flight at a time.
  // Saves the latest value and fires it when the previous call settles,
  // so the queue never grows beyond depth 1.
  const dragInFlightRef = useRef(false)
  const dragPendingRef  = useRef<number | null>(null)
  const fireDragCall    = useCallback((v: number): void => {
    dragInFlightRef.current = true
    dragPendingRef.current  = null
    window.api.sonarSetVolume(channel, v / 100)
      .catch(console.error)
      .finally(() => {
        dragInFlightRef.current = false
        const next = dragPendingRef.current
        if (next !== null) fireDragCall(next)
      })
  }, [channel])
  const handleVolumeDrag = useCallback((v: number): void => {
    dragPendingRef.current = v
    if (!dragInFlightRef.current) fireDragCall(v)
  }, [fireDragCall])
  const handleMute = useCallback(() => onMute(channel), [channel, onMute])
  const _beginDrag = useSonarStore((s) => s.beginDrag)
  const _endDrag   = useSonarStore((s) => s.endDrag)
  const beginDrag  = useCallback(() => _beginDrag(channel), [channel, _beginDrag])
  const endDrag    = useCallback(() => _endDrag(channel), [channel, _endDrag])

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
      <div className="sn-strip-head" style={{ cursor: 'pointer' }} onClick={onOpenEditor} title="Manage presets">
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
              sourceRole={channel}
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
          onDragChange={handleVolumeDrag}
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
        <button
          className={`sn-solo-btn${isSoloed ? ' on' : ''}`}
          onClick={() => onSolo(channel)}
          title={isSoloed ? 'Unsolo' : 'Solo'}
        >
          S
        </button>
      </div>

      {/* Preset selector */}
      <PresetSelector
        configs={configs}
        activePresetId={activePresetId}
        channel={channel}
        onSelect={onPresetSelect}
      />

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
