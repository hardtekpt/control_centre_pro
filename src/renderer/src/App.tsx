import { useEffect, useRef } from 'react'
import './styles/globals.css'
import { useAppStore } from './stores/appStore'
import { useServiceStore } from './stores/serviceStore'
import { useSonarStore } from './stores/sonarStore'
import { useDiscordStore } from './stores/discordStore'
import { useShortcutStore } from './stores/shortcutStore'
import { usePluginStore } from './stores/pluginStore'
import { useKvmStore } from './stores/kvmStore'
import { useHaStore } from './stores/haStore'
import { combinationFromEvent } from './lib/shortcuts/keys'
import { MainLayout } from './components/layout/MainLayout'
import { SettingsLayout } from './components/settings/SettingsLayout'
import { FloatingSidebar } from './components/layout/FloatingSidebar'
import { MAIN_NAV } from './components/layout/navItems'
import { SETTINGS_NAV } from './components/settings/SettingsSidebar'
import { notifyArctisConnected, notifyArctisDisconnected, notifyArctisEvent, seedArctisTrackingState } from './lib/notifyFromEvent'
import type { ArctisState, AppView } from '@shared/types'

/**
 * Root component — decides which top-level layout to render and wires up
 * cross-cutting effects: theme, window state sync, menu navigation, and
 * global keyboard shortcuts.
 */
export default function App(): JSX.Element {
  const {
    currentView, previousView, currentSettingsTab, theme, accentColor, sidebarWidth, sidebarCollapsed,
    setMaximized, setView, setSettingsTab, toggleSidebar,
    setTheme, setAccentColor, setSidebarWidth, setSidebarCollapsed,
  } = useAppStore()
  const { setServices, setLogs, addLog, setArctisConnected, setArctisDisconnected, updateArctisState, setDdcMonitors, setSettings: setStoreSettings, services } =
    useServiceStore()
  const { setSonarState } = useSonarStore()
  const { setDiscordState } = useDiscordStore()
  const { items: shortcutItems, load: loadShortcuts } = useShortcutStore()
  const { syncDiscordServiceState, syncKvmState, syncHaState } = usePluginStore()
  const { setKvmState } = useKvmStore()
  const { setHaState } = useHaStore()

  // Track whether initial settings have been loaded so we don't auto-save before loading
  const settingsLoadedRef = useRef(false)

  // Load persisted settings on startup and apply them
  useEffect(() => {
    window.api.getSettings().then((settings) => {
      setTheme(settings.theme)
      setAccentColor(settings.accentColor ?? '')
      setSidebarWidth(settings.sidebarWidth)
      setSidebarCollapsed(settings.sidebarCollapsed)
      setStoreSettings(settings)
      settingsLoadedRef.current = true
    }).catch(console.error)
  }, [setTheme, setAccentColor, setSidebarWidth, setSidebarCollapsed, setStoreSettings])

  // Auto-save sidebar width and collapsed state (debounced)
  useEffect(() => {
    if (!settingsLoadedRef.current) return
    const timer = setTimeout(() => {
      window.api.getSettings().then((current) => {
        const updated = { ...current, sidebarWidth, sidebarCollapsed }
        window.api.setSettings(updated)
        setStoreSettings(updated)
      }).catch(console.error)
    }, 500)
    return () => clearTimeout(timer)
  }, [sidebarWidth, sidebarCollapsed, setStoreSettings])

  // Apply custom accent color override (or remove it to fall back to theme default)
  useEffect(() => {
    const root = document.documentElement
    if (accentColor) {
      root.style.setProperty('--color-accent', accentColor)
    } else {
      root.style.removeProperty('--color-accent')
    }
  }, [accentColor])

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

  // Handle navigation events pushed from the main process (e.g. via menu)
  useEffect(() => {
    const cleanup = window.api.onNavigate((target) => {
      if (target.startsWith('settings:')) {
        const tab = target.slice(9) as any
        setView('settings')
        setSettingsTab(tab)
      } else if (target === 'home' || target === 'arctis' || target === 'gg-sonar' || target === 'shortcuts' || target === 'notifications' || target === 'settings') {
        setView(target)
      }
    })
    return cleanup
  }, [setView, setSettingsTab])

  // Global keyboard shortcuts
  useEffect(() => {
    const mainViews = MAIN_NAV.map((item) => item.id)
    const settingsTabs = SETTINGS_NAV.map((item) => item.id)

    const onKeyDown = (e: KeyboardEvent): void => {
      // Esc — exit settings back to main view
      if (e.key === 'Escape' && currentView === 'settings') {
        e.preventDefault()
        setView(previousView ?? 'home')
        return
      }

      if (!e.ctrlKey) return

      // Ctrl+B — toggle sidebar
      if (e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      const inSettings = currentView === 'settings'

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle pages
      if (e.key === 'Tab') {
        e.preventDefault()
        if (inSettings) {
          const idx = settingsTabs.indexOf(currentSettingsTab)
          const base = idx === -1 ? 0 : idx
          const next = e.shiftKey
            ? (base - 1 + settingsTabs.length) % settingsTabs.length
            : (base + 1) % settingsTabs.length
          setSettingsTab(settingsTabs[next])
        } else {
          const idx = mainViews.indexOf(currentView)
          const base = idx === -1 ? 0 : idx
          const next = e.shiftKey
            ? (base - 1 + mainViews.length) % mainViews.length
            : (base + 1) % mainViews.length
          setView(mainViews[next] as AppView)
        }
        return
      }

      // Ctrl+N — jump to Nth page (position matches sidebar order)
      const digit = parseInt(e.key, 10)
      if (!isNaN(digit) && digit >= 1) {
        if (inSettings) {
          const tab = settingsTabs[digit - 1]
          if (tab) { e.preventDefault(); setSettingsTab(tab) }
        } else {
          const view = mainViews[digit - 1]
          if (view) { e.preventDefault(); setView(view as AppView) }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar, currentView, previousView, currentSettingsTab, setView, setSettingsTab])

  // Load user-defined shortcuts on startup
  useEffect(() => {
    window.api.shortcutsGet().then(loadShortcuts).catch(console.error)
  }, [loadShortcuts])

  // Dispatch focused-scope shortcuts app-wide (not just on the Shortcuts page)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const combo = combinationFromEvent(e)
      if (!combo) return
      const match = shortcutItems.find(
        (s) => s.scope === 'focused' && s.enabled && JSON.stringify(s.keys) === JSON.stringify(combo)
      )
      if (match) {
        e.preventDefault()
        void window.api.shortcutsDispatch(match.actionId, match.value)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcutItems])

  // Load cached service logs on startup so we don't miss early logs
  useEffect(() => {
    window.api.getServiceLogHistory().then(setLogs).catch(console.error)
  }, [setLogs])

  // Load initial service list and subscribe to changes
  useEffect(() => {
    window.api.servicesList().then(setServices)
    const cleanups = [
      window.api.onServicesStateChange(setServices),
      window.api.onServiceLog(addLog),
    ]
    return () => cleanups.forEach((fn) => fn())
  }, [setServices, addLog])

  // Sync Discord plugin state with service state
  useEffect(() => {
    const discordService = services.find((s) => s.id === 'discord')
    syncDiscordServiceState(discordService)
  }, [services, syncDiscordServiceState])

  // Load initial Arctis state and subscribe to device events
  useEffect(() => {
    window.api.arctisGetState().then((state) => {
      if (state) {
        setArctisConnected(state)
        seedArctisTrackingState(state)
        // Trigger a fresh full read so the UI always shows live values on open/reload
        window.api.arctisCmd('refresh', null).catch(console.error)
      }
    })
    const cleanups = [
      window.api.onArctisConnected((state) => {
        setArctisConnected(state)
        notifyArctisConnected(state)
      }),
      window.api.onArctisDisconnected(() => {
        setArctisDisconnected()
        notifyArctisDisconnected()
      }),
      window.api.onArctisEvent((eventName, data) => {
        notifyArctisEvent(eventName, data)
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
            const d = data as { wirelessConnected: boolean; headsetPowered: boolean | null; btStatus: ArctisState['btStatus'] }
            updateArctisState({ wirelessConnected: d.wirelessConnected, headsetPowered: d.headsetPowered, btStatus: d.btStatus })
            break
          }
          case 'HeadsetPoweredEvent':
            updateArctisState({ headsetPowered: (data as { headsetPowered: boolean }).headsetPowered })
            break
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
          // ── Base Station USB ──────────────────────────────────────────────
          case 'DeviceDisconnectedEvent':
            updateArctisState({ baseStationConnected: false })
            break
          case 'DeviceReconnectedEvent':
            updateArctisState({ baseStationConnected: true })
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

  // Load initial Discord state and subscribe to RPC push events
  useEffect(() => {
    window.api.discordGetState().then(setDiscordState)
    const cleanup = window.api.onDiscordStateChange(setDiscordState)
    return cleanup
  }, [setDiscordState])

  // Load initial KVM state and subscribe to connection change events
  useEffect(() => {
    window.api.getSettings().then((s) => {
      window.api.kvmGetState().then((state) => {
        setKvmState(state)
        syncKvmState(state, s.kvmEnabled)
      }).catch(console.error)
    }).catch(console.error)
    const cleanup = window.api.onKvmStateChange((state) => {
      setKvmState(state)
      window.api.getSettings().then((s) => syncKvmState(state, s.kvmEnabled)).catch(console.error)
    })
    return cleanup
  }, [setKvmState, syncKvmState])

  // Load initial HA state and subscribe to push events
  useEffect(() => {
    window.api.haGetState().then((state) => {
      setHaState(state)
      syncHaState(state)
    }).catch(console.error)
    return window.api.onHaStateChange((state) => {
      setHaState(state)
      syncHaState(state)
    })
  }, [setHaState, syncHaState])

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

  // Refresh Sonar device routing when navigating to GG Sonar page
  useEffect(() => {
    if (currentView === 'gg-sonar') {
      window.api.sonarRefreshDevices().catch(console.error)
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
