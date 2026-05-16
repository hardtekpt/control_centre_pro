import { useServiceStore } from '../stores/serviceStore'
import { HeadsetCard } from '../components/home/HeadsetCard'

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
    </div>
  )
}
