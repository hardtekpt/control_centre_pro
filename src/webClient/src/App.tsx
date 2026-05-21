import { useState, useCallback } from 'react'
import { useWebSocket } from './api/websocket'
import { useServiceStore } from './stores/serviceStore'
import { useSonarStore } from './stores/sonarStore'
import { Home } from './pages/Home'
import { Arctis } from './pages/Arctis'
import { Sonar } from './pages/Sonar'
import type { ArctisState, SonarState, DdcMonitor } from '@shared/types'

type Tab = 'home' | 'arctis' | 'sonar'
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

const TAB_LABELS: Record<Tab, string> = {
  home: 'Home',
  arctis: 'Arctis',
  sonar: 'Sonar',
}

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('home')
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected')

  const { setArctisConnected, setArctisDisconnected, updateArctisState, setDdcMonitors } = useServiceStore()

  const handleInit = useCallback((payload: unknown) => {
    const { arctis, sonar, ddc } = payload as { arctis: ArctisState | null; sonar: SonarState | null; ddc?: DdcMonitor[] }
    if (arctis) {
      setArctisConnected(arctis)
    } else {
      setArctisDisconnected()
    }
    if (sonar) {
      useSonarStore.getState().setSonarState(sonar)
    }
    if (ddc) {
      setDdcMonitors(ddc)
    }
  }, [setArctisConnected, setArctisDisconnected, setDdcMonitors])

  const handleArctisConnected = useCallback((payload: unknown) => {
    setArctisConnected(payload as ArctisState)
  }, [setArctisConnected])

  const handleArctisDisconnected = useCallback(() => {
    setArctisDisconnected()
  }, [setArctisDisconnected])

  const handleArctisEvent = useCallback((payload: unknown) => {
    const { data } = payload as { eventName: string; data: Record<string, unknown> }
    updateArctisState(data as Partial<ArctisState>)
  }, [updateArctisState])

  const handleSonarStateChange = useCallback((payload: unknown) => {
    useSonarStore.getState().setSonarState(payload as SonarState)
  }, [])

  const handleDdcUpdate = useCallback((payload: unknown) => {
    setDdcMonitors(payload as DdcMonitor[])
  }, [setDdcMonitors])

  useWebSocket({
    handlers: {
      'init': handleInit,
      'arctis:connected': handleArctisConnected,
      'arctis:disconnected': handleArctisDisconnected,
      'arctis:event': handleArctisEvent,
      'sonar:stateChange': handleSonarStateChange,
      'ddc:update': handleDdcUpdate,
    },
    onStatusChange: setWsStatus,
  })

  const dotStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background:
      wsStatus === 'connected'
        ? 'var(--color-ok)'
        : wsStatus === 'reconnecting'
          ? 'var(--color-warn)'
          : 'var(--color-text-secondary)',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--color-bg)',
        color: 'var(--color-text-primary)',
        fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: 14,
      }}
    >
      {/* Connection status dot — fixed top right */}
      <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 100 }}>
        <div style={dotStyle} title={wsStatus} />
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 56 }}>
        {tab === 'home'   && <Home />}
        {tab === 'arctis' && <Arctis />}
        {tab === 'sonar'  && <Sonar />}
      </div>

      {/* Bottom tab bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: 56,
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          zIndex: 50,
        }}
      >
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontSize: 11,
              fontWeight: tab === t ? 600 : 400,
              fontFamily: 'inherit',
              padding: 0,
              transition: 'color 100ms',
            }}
          >
            <TabIcon tab={t} active={tab === t} />
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>
    </div>
  )
}

function TabIcon({ tab, active }: { tab: Tab; active: boolean }): JSX.Element {
  const color = active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
  const size = 20

  if (tab === 'home') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M7 18v-6h6v6" />
      </svg>
    )
  }
  if (tab === 'arctis') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10a6 6 0 0112 0" />
        <path d="M3 10a1.5 1.5 0 013 0v3a1.5 1.5 0 01-3 0v-3z" />
        <path d="M14 10a1.5 1.5 0 013 0v3a1.5 1.5 0 01-3 0v-3z" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
    </svg>
  )
}
