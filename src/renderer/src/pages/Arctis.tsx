import { useServiceStore } from '../stores/serviceStore'
import { HeadsetCard } from '../components/home/HeadsetCard'
import { AudioOptionsPanel } from '../components/home/AudioOptionsPanel'
import { WirelessAudioPanel } from '../components/home/WirelessAudioPanel'
import { BaseStationPanel } from '../components/home/BaseStationPanel'
import { EqPanel } from '../components/home/EqPanel'

export function Arctis(): JSX.Element {
  const { arctisState } = useServiceStore()

  if (!arctisState) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ color: 'var(--color-text-secondary)' }}>Arctis Nova Pro not connected</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <HeadsetCard state={arctisState} expandByDefault={true} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        <AudioOptionsPanel state={arctisState} expandByDefault={true} />
        <WirelessAudioPanel state={arctisState} />
      </div>
      <BaseStationPanel state={arctisState} expandByDefault={true} />
      <EqPanel state={arctisState} expandByDefault={true} />
    </div>
  )
}
