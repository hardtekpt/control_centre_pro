import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'

/**
 * Main application shell: vertical stack of TopBar + horizontal row of
 * Sidebar and MainContent. Used for all non-settings views.
 */
export function MainLayout(): JSX.Element {
  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  )
}
