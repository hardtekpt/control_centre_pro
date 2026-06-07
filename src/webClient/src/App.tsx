import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from './api/websocket'
import { useServiceStore } from './stores/serviceStore'
import { useSonarStore } from './stores/sonarStore'
import { usePresetSwitcherStore } from './stores/presetSwitcherStore'
import { useDiscordStore } from './stores/discordStore'
import { useHaStore } from './stores/haStore'
import { Home } from './pages/Home'
import { Arctis } from './pages/Arctis'
import { Sonar } from './pages/Sonar'
import { getAuthToken, onAuthFailed } from './api/auth'
import { get } from './api/http'
import { LinkIcon } from './components/icons'
import type { ArctisState, SonarState, DdcMonitor, DiscordState, HaState, HaHomeCardEntity, PresetSwitcherRule } from '@shared/types'

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
  const [unauthorized, setUnauthorized] = useState<boolean>(() => !getAuthToken())
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    onAuthFailed(() => setUnauthorized(true))
  }, [])

  // Validate the stored token via HTTP on boot. A WS handshake rejection comes
  // through as close code 1006 (indistinguishable from a network blip), so we
  // can't rely on the socket alone — `get` already calls notifyAuthFailed on 401.
  useEffect(() => {
    if (!getAuthToken()) return
    void get('/api/info').catch(() => { /* notifyAuthFailed already fired on 401 */ })
  }, [])

  const { setArctisConnected, setArctisDisconnected, updateArctisState, setDdcMonitors } = useServiceStore()
  const setDiscordState = useDiscordStore((s) => s.setDiscordState)
  const setHaData = useHaStore((s) => s.setHaData)
  const setHaState = useHaStore((s) => s.setHaState)

  const handleInit = useCallback((payload: unknown) => {
    const { arctis, sonar, ddc, discord, ha, presetSwitcher, activeWindow } = payload as {
      arctis: ArctisState | null
      sonar: SonarState | null
      ddc?: DdcMonitor[]
      discord?: DiscordState
      ha?: { state: HaState; cardEntities: HaHomeCardEntity[]; cardEnabled: boolean }
      presetSwitcher?: { rules: PresetSwitcherRule[]; enabled: boolean }
      activeWindow?: { processName: string }
    }
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
    if (discord) {
      setDiscordState(discord)
    }
    if (ha) {
      setHaData(ha.state, ha.cardEntities, ha.cardEnabled)
    }
    if (presetSwitcher) {
      usePresetSwitcherStore.getState().initFromSnapshot(presetSwitcher.rules, presetSwitcher.enabled)
    }
    if (activeWindow) {
      usePresetSwitcherStore.getState().setActiveProcessName(activeWindow.processName)
    }
  }, [setArctisConnected, setArctisDisconnected, setDdcMonitors, setDiscordState, setHaData])

  const handleDiscordStateChange = useCallback((payload: unknown) => {
    setDiscordState(payload as DiscordState)
  }, [setDiscordState])

  const handleHaStateChange = useCallback((payload: unknown) => {
    setHaState(payload as HaState)
  }, [setHaState])

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

  const handleActiveWindowChange = useCallback((payload: unknown) => {
    const { processName } = payload as { processName: string }
    usePresetSwitcherStore.getState().setActiveProcessName(processName)
  }, [])

  const handlePresetSwitcherEnabledChange = useCallback((payload: unknown) => {
    usePresetSwitcherStore.getState().setEnabledFromWs(payload as boolean)
  }, [])

  useWebSocket({
    handlers: {
      'init': handleInit,
      'arctis:connected': handleArctisConnected,
      'arctis:disconnected': handleArctisDisconnected,
      'arctis:event': handleArctisEvent,
      'sonar:stateChange': handleSonarStateChange,
      'ddc:update': handleDdcUpdate,
      'discord:stateChange': handleDiscordStateChange,
      'ha:stateChange': handleHaStateChange,
      'activeWindow:change': handleActiveWindowChange,
      'presetSwitcher:enabledChange': handlePresetSwitcherEnabledChange,
    },
    onStatusChange: setWsStatus,
  })

  const wsColor =
    wsStatus === 'connected'
      ? 'var(--color-ok)'
      : wsStatus === 'reconnecting'
        ? 'var(--color-warn)'
        : 'var(--color-text-secondary)'

  if (unauthorized) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          padding: 24,
          background: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
          fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Access expired</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 320, lineHeight: 1.5, marginBottom: 24 }}>
          The access token for this session has expired or been revoked. Open Control Centre Pro on your PC,
          go to Settings → Remote Access, and scan the QR code again.
        </div>
        <button
          onClick={() => setScanning(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-primary)',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="6" height="6" rx="1" />
            <rect x="12" y="2" width="6" height="6" rx="1" />
            <rect x="2" y="12" width="6" height="6" rx="1" />
            <path d="M12 12h2v2h-2zM16 12v2M12 16h2M16 16v2M14 14h4" />
          </svg>
          Scan QR code
        </button>
        {scanning && <QrScanOverlay onClose={() => setScanning(false)} />}
      </div>
    )
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
      {/* Connection status icon — fixed top right */}
      <div style={{ position: 'fixed', top: 10, right: 14, zIndex: 100, display: 'flex' }}>
        <LinkIcon color={wsColor} size={16} title={wsStatus} />
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

// ── QR scanner overlay ────────────────────────────────────────────────────────

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
    }
  }
}

function QrScanOverlay({ onClose }: { onClose: () => void }): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const hasDetector = typeof window.BarcodeDetector !== 'undefined'

  // Start camera stream
  useEffect(() => {
    if (!hasDetector) return
    let stopped = false
    let activeStream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        activeStream = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => undefined)
        }
      })
      .catch(() => setCameraError('Camera access denied'))

    return () => {
      stopped = true
      activeStream?.getTracks().forEach((t) => t.stop())
    }
  }, [hasDetector])

  // Poll BarcodeDetector on video frames
  useEffect(() => {
    if (!hasDetector || !window.BarcodeDetector) return
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    let running = true

    const tick = async (): Promise<void> => {
      if (!running) return
      const video = videoRef.current
      if (video && video.readyState >= 2) {
        try {
          const results = await detector.detect(video)
          if (results.length > 0) {
            const url = results[0].rawValue
            if (url.startsWith('http')) {
              window.location.href = url
              return
            }
          }
        } catch { /* ignore */ }
      }
      if (running) setTimeout(() => { void tick() }, 300)
    }

    void tick()
    return () => { running = false }
  }, [hasDetector])

  const handleManualSubmit = (): void => {
    const url = manualUrl.trim()
    if (url.startsWith('http')) window.location.href = url
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)',
    padding: 24,
    gap: 16,
  }

  const btnStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <div style={overlayStyle}>
      {hasDetector && !cameraError ? (
        <>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Point camera at QR code</div>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', maxWidth: 340, borderRadius: 12, background: '#000' }}
          />
          <button onClick={onClose} style={{ ...btnStyle, marginTop: 8 }}>Cancel</button>
        </>
      ) : (
        <>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
            {cameraError ?? 'Paste the URL from the QR code'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', maxWidth: 300 }}>
            Open the QR code in another QR app, copy the link, and paste it below.
          </div>
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="http://192.168.x.x:PORT/?token=…"
            onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
            style={{
              width: '100%',
              maxWidth: 340,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={btnStyle}>Cancel</button>
            <button
              onClick={handleManualSubmit}
              disabled={!manualUrl.trim().startsWith('http')}
              style={{ ...btnStyle, opacity: manualUrl.trim().startsWith('http') ? 1 : 0.4 }}
            >
              Connect
            </button>
          </div>
        </>
      )}
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
