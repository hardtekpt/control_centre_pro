import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { MainLayout } from './components/layout/MainLayout'
import { SettingsLayout } from './components/settings/SettingsLayout'
import { FloatingSidebar } from './components/layout/FloatingSidebar'

/**
 * Root component — decides which top-level layout to render and wires up
 * cross-cutting effects: theme, window state sync, menu navigation, and
 * global keyboard shortcuts.
 */
export default function App(): JSX.Element {
  const { currentView, theme, setMaximized, setView, setSettingsTab, toggleSidebar } = useAppStore()

  // Apply / remove data-theme on <html> so CSS custom properties switch
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.removeAttribute('data-theme')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      prefersDark
        ? root.setAttribute('data-theme', 'dark')
        : root.removeAttribute('data-theme')
    }
  }, [theme])

  // Sync isMaximized with real window state
  useEffect(() => {
    window.api.isMaximized().then(setMaximized)
    const cleanup = window.api.onWindowStateChange(setMaximized)
    return cleanup
  }, [setMaximized])

  // Handle navigation events pushed from the main process (e.g. via File menu)
  useEffect(() => {
    const cleanup = window.api.onNavigate((target) => {
      if (target === 'settings') {
        setView('settings')
      } else if (target === 'settings:about') {
        setView('settings')
        setSettingsTab('about')
      } else if (target === 'home') {
        setView('home')
      }
    })
    return cleanup
  }, [setView, setSettingsTab])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Ctrl+B — toggle sidebar (matches Claude Code convention)
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {currentView === 'settings' ? <SettingsLayout /> : <MainLayout />}
      <FloatingSidebar />
    </div>
  )
}
