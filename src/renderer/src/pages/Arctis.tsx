import { useServiceStore } from '../stores/serviceStore'
import { HeadsetCard } from '../components/home/HeadsetCard'
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
    <div className="flex flex-col gap-6 px-6 pb-6 pt-0">
      <HeadsetCard state={arctisState} expandByDefault={true} />
      <EqPanel state={arctisState} expandByDefault={true} />
    </div>
  )
}
