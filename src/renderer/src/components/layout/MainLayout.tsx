import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { useAppStore } from '../../stores/appStore'

/**
 * Main application shell: vertical stack of TopBar + horizontal row of
 * Sidebar and MainContent. Sidebar is hidden when collapsed; FloatingSidebar
 * lives in App.tsx and provides the hover-peek panel across all views.
 */
export function MainLayout(): JSX.Element {
  const { sidebarCollapsed } = useAppStore()

  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {!sidebarCollapsed && <Sidebar />}
        <MainContent />
      </div>
    </div>
  )
}
