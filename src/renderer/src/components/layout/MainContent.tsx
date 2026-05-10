import { useAppStore } from '../../stores/appStore'
import { Home } from '../../pages/Home'

/**
 * Main content area — renders whichever page the user has navigated to.
 * New pages: add a case here and a NavItemDef entry in Sidebar.tsx.
 */
export function MainContent(): JSX.Element {
  const { currentView } = useAppStore()

  return (
    <main
      className="flex-1 overflow-y-auto selectable"
      style={{ background: 'var(--color-bg)' }}
    >
      {currentView === 'home' && <Home />}
    </main>
  )
}
