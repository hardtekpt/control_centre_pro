import { useAppStore } from '../../stores/appStore'
import { Home } from '../../pages/Home'
import { Arctis } from '../../pages/Arctis'
import { GGSonar } from '../../pages/GGSonar'
import { Shortcuts } from '../../pages/Shortcuts'
import { Notifications } from '../../pages/Notifications'
import { NotificationStack } from '../notifications/NotificationStack'

const FLOAT_GAP = 6 // matches Sidebar's SIDEBAR_FLOAT_GAP

/**
 * Main content area — renders the active page.
 * Top/right/bottom padding matches the sidebar's float gap so the visual
 * baseline of the content aligns with the top of the floating sidebar card.
 *
 * New pages: add a case here and a NavItemDef in Sidebar.tsx.
 */
export function MainContent(): JSX.Element {
  const { currentView } = useAppStore()

  return (
    <main
      className="flex-1 overflow-y-auto selectable"
      style={{
        background: 'var(--color-bg)',
        padding: `${FLOAT_GAP}px ${FLOAT_GAP}px ${FLOAT_GAP}px 0`,
      }}
    >
      {/* Inner card that mirrors the floating sidebar card height */}
      <div className="h-full">
        {currentView === 'home' && <Home />}
        {currentView === 'arctis' && <Arctis />}
        {currentView === 'gg-sonar' && <GGSonar />}
        {currentView === 'shortcuts' && <Shortcuts />}
        {currentView === 'notifications' && <Notifications />}
      </div>
      <NotificationStack />
    </main>
  )
}
