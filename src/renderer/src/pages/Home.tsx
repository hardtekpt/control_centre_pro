import { useServiceStore } from '../stores/serviceStore'
import { HeadsetCard } from '../components/home/HeadsetCard'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function HomeSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wider px-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────

export function Home(): JSX.Element {
  const { arctisState } = useServiceStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      <HomeSection title="Audio">
        {arctisState ? (
          <HeadsetCard state={arctisState} />
        ) : null}
      </HomeSection>
    </div>
  )
}
