import { useEffect, useRef } from 'react'
import { useAppStore } from './stores/appStore'
import { useServiceStore } from './stores/serviceStore'
import { useSonarStore } from './stores/sonarStore'
import { MainLayout } from './components/layout/MainLayout'
import { SettingsLayout } from './components/settings/SettingsLayout'
import { FloatingSidebar } from './components/layout/FloatingSidebar'
import type { ArctisState } from '@shared/types'

/**
 * Root component — decides which top-level layout to render and wires up
 * cross-cutting effects: theme, window state sync, menu navigation, and
 * global keyboard shortcuts.
 */
export default function App(): JSX.Element {
  const {
    currentView, currentSettingsTab, theme, sidebarWidth, sidebarCollapsed,
    setMaximized, setView, setSettingsTab, toggleSidebar,
    setTheme, setSidebarWidth, setSidebarCollapsed,
  } = useAppStore()
  const { setServices, addLog, setArctisConnected, setArctisDisconnected, updateArctisState, setDdcMonitors } =
    useServiceStore()
  const { setSonarState } = useSonarStore()

  // Track whether initial settings have been loaded so we don't auto-save before loading
  const settingsLoadedRef = useRef(false)

  // Load persisted settings on startup and apply them
  useEffect(() => {
    window.api.getSettings().then((settings) => {
      setTheme(settings.theme)
      setSidebarWidth(settings.sidebarWidth)
      setSidebarCollapsed(settings.sidebarCollapsed)
      settingsLoadedRef.current = true
    }).catch(console.error)
  }, [setTheme, setSidebarWidth, setSidebarCollapsed])

  // Auto-save sidebar width and collapsed state (debounced)
  useEffect(() => {
    if (!settingsLoadedRef.current) return
    const timer = setTimeout(() => {
      window.api.getSettings().then((current) => {
        window.api.setSettings({ ...current, sidebarWidth, sidebarCollapsed })
      }).catch(console.error)
    }, 500)
    return () => clearTimeout(timer)
  }, [sidebarWidth, sidebarCollapsed])

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

  // Load initial service list and subscribe to changes
  useEffect(() => {
    window.api.servicesList().then(setServices)
    const cleanups = [
      window.api.onServicesStateChange(setServices),
      window.api.onServiceLog(addLog),
    ]
    return () => cleanups.forEach((fn) => fn())
  }, [setServices, addLog])

  // Load initial Arctis state and subscribe to device events
  useEffect(() => {
    window.api.arctisGetState().then((state) => {
      if (state) {
        setArctisConnected(state)
        // Trigger a fresh full read so the UI always shows live values on open/reload
        window.api.arctisCmd('refresh', null).catch(console.error)
      }
    })
    const cleanups = [
      window.api.onArctisConnected(setArctisConnected),
      window.api.onArctisDisconnected(setArctisDisconnected),
      window.api.onArctisEvent((eventName, data) => {
        // Each event carries only the fields it owns — updateArctisState merges them in
        switch (eventName) {
          // ── Status ────────────────────────────────────────────────────────
          case 'VolumeEvent':
            updateArctisState({ volume: (data as { volume: number }).volume })
            break
          case 'BatteryEvent': {
            const d = data as { batteryHeadset: number; batteryDock: number }
            updateArctisState({ batteryHeadset: d.batteryHeadset, batteryDock: d.batteryDock })
            break
          }
          case 'MicMuteEvent':
            updateArctisState({ micMuted: (data as { micMuted: boolean }).micMuted })
            break
          // ── Connectivity ──────────────────────────────────────────────────
          case 'ConnectivityEvent': {
            const d = data as { btActive: boolean; btConnected: boolean; btPairing: boolean; wirelessConnected: boolean }
            updateArctisState({ btActive: d.btActive, btConnected: d.btConnected, btPairing: d.btPairing, wirelessConnected: d.wirelessConnected })
            break
          }
          // ── ANC ───────────────────────────────────────────────────────────
          case 'AncModeEvent':
            updateArctisState({ ancMode: (data as { ancMode: ArctisState['ancMode'] }).ancMode })
            break
          case 'TransparencyEvent':
            updateArctisState({ transparencyLevel: (data as { transparencyLevel: number }).transparencyLevel })
            break
          // ── Audio Options ─────────────────────────────────────────────────
          case 'GainEvent':
            updateArctisState({ micGain: (data as { micGain: ArctisState['micGain'] }).micGain })
            break
          case 'MicVolumeEvent':
            updateArctisState({ micVolume: (data as { micVolume: number }).micVolume })
            break
          case 'SidetoneEvent':
            updateArctisState({ sidetone: (data as { sidetone: ArctisState['sidetone'] }).sidetone })
            break
          // ── Wireless ──────────────────────────────────────────────────────
          case 'WirelessModeEvent':
            updateArctisState({ wirelessMode: (data as { wirelessMode: ArctisState['wirelessMode'] }).wirelessMode })
            break
          case 'BtDefaultEvent':
            updateArctisState({ btDefault: (data as { btDefault: boolean }).btDefault })
            break
          case 'BtAutoMuteEvent':
            updateArctisState({ btAutoMute: (data as { btAutoMute: ArctisState['btAutoMute'] }).btAutoMute })
            break
          // ── ChatMix ───────────────────────────────────────────────────────
          case 'ChatMixEvent': {
            const d = data as { chatmixGame: number; chatmixChat: number }
            updateArctisState({ chatmixGame: d.chatmixGame, chatmixChat: d.chatmixChat })
            break
          }
          // ── Audio Output ──────────────────────────────────────────────────
          case 'AudioOutputEvent':
            updateArctisState({ audioOutput: (data as { audioOutput: ArctisState['audioOutput'] }).audioOutput })
            break
          case 'StreamVolumesEvent': {
            const d = data as { streamMain: number; streamAux: number; streamMic: number }
            updateArctisState({ streamMain: d.streamMain, streamAux: d.streamAux, streamMic: d.streamMic })
            break
          }
          // ── Base Station ──────────────────────────────────────────────────
          case 'OledBrightnessEvent':
            updateArctisState({ oledBrightness: (data as { oledBrightness: number }).oledBrightness })
            break
          case 'DimTimeoutEvent':
            updateArctisState({ dimTimeout: (data as { dimTimeout: ArctisState['dimTimeout'] }).dimTimeout })
            break
          case 'HomeScreenEvent':
            updateArctisState({ homescreenMode: (data as { homescreenMode: ArctisState['homescreenMode'] }).homescreenMode })
            break
          case 'MicLedEvent':
            updateArctisState({ micLedBrightness: (data as { micLedBrightness: number }).micLedBrightness })
            break
          case 'AutoOffEvent':
            updateArctisState({ autoOffTimeout: (data as { autoOffTimeout: ArctisState['autoOffTimeout'] }).autoOffTimeout })
            break
          case 'EqPresetEvent':
            updateArctisState({ eqPresetIndex: (data as { eqPresetIndex: number }).eqPresetIndex })
            break
          case 'EqBandEvent':
            updateArctisState({ eqBands: (data as { eqBands: number[] }).eqBands })
            break
        }
      }),
    ]
    return () => cleanups.forEach((fn) => fn())
  }, [setArctisConnected, setArctisDisconnected, updateArctisState])

  // Load initial Sonar state and subscribe to polling push events
  useEffect(() => {
    window.api.sonarGetState().then(setSonarState)
    const cleanup = window.api.onSonarStateChange(setSonarState)
    return cleanup
  }, [setSonarState])

  // Load initial DDC monitor list and subscribe to updates
  useEffect(() => {
    window.api.ddcGetMonitors().then(setDdcMonitors)
    const cleanup = window.api.onDdcUpdate(setDdcMonitors)
    return cleanup
  }, [setDdcMonitors])

  // Refresh DDC monitors when navigating to home page
  useEffect(() => {
    if (currentView === 'home') {
      window.api.ddcGetMonitors().catch(console.error)
    }
  }, [currentView])

  // Refresh DDC monitors when navigating to DDC settings
  useEffect(() => {
    if (currentView === 'settings' && currentSettingsTab === 'ddc') {
      window.api.ddcGetMonitors().catch(console.error)
    }
  }, [currentView, currentSettingsTab])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {currentView === 'settings' ? <SettingsLayout /> : <MainLayout />}
      <FloatingSidebar />
    </div>
  )
}
