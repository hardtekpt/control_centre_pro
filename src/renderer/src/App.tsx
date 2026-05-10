import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { MainLayout } from './components/layout/MainLayout'
import { SettingsLayout } from './components/settings/SettingsLayout'

/**
 * Root component — decides which top-level layout to render.
 * Also handles theme application and window state synchronisation.
 */
export default function App(): JSX.Element {
  const { currentView, theme, setMaximized } = useAppStore()

  // Apply / remove the data-theme attribute on <html> whenever theme changes.
  // CSS variables defined in globals.css react to this attribute.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.removeAttribute('data-theme')
    } else {
      // 'system' — follow the OS color scheme preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      prefersDark
        ? root.setAttribute('data-theme', 'dark')
        : root.removeAttribute('data-theme')
    }
  }, [theme])

  // Keep isMaximized in sync with the real window state.
  // The main process pushes events when the window is maximized / restored.
  useEffect(() => {
    // Check the current state on mount
    window.api.isMaximized().then(setMaximized)

    // Subscribe to future state changes
    const cleanup = window.api.onWindowStateChange(setMaximized)
    return cleanup
  }, [setMaximized])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {currentView === 'settings' ? <SettingsLayout /> : <MainLayout />}
    </div>
  )
}
