import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, ToggleSetting, SettingsPageWrapper } from '../../components/SettingsComponents'

const DURATION_OPTIONS: { label: string; value: number }[] = [
  { label: '1 hour',  value: 60 * 60 * 1000 },
  { label: '12 hours', value: 12 * 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
  { label: '7 days',   value: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Never',    value: 0 },
]

function formatRemaining(expiresAt: number): string {
  if (expiresAt === 0) return 'Never expires'
  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'Expired'
  const totalMin = Math.floor(ms / 60_000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const mins  = totalMin % 60
  if (days > 0)  return `Expires in ${days}d ${hours}h`
  if (hours > 0) return `Expires in ${hours}h ${mins}m`
  return `Expires in ${mins}m`
}

export function RemoteAccessSettings(): JSX.Element {
  const { setDirty, registerSave } = useSettingsForm()

  const [draftEnabled, setDraftEnabled]     = useState(false)
  const [savedEnabled, setSavedEnabled]     = useState(false)
  const [draftPort, setDraftPort]           = useState(8080)
  const [savedPort, setSavedPort]           = useState(8080)
  const [draftDuration, setDraftDuration]   = useState<number>(24 * 60 * 60 * 1000)
  const [savedDuration, setSavedDuration]   = useState<number>(24 * 60 * 60 * 1000)
  const [info, setInfo] = useState<RemoteInfo | null>(null)
  const [, forceTick] = useState(0)

  // Refresh the "expires in …" line every 30s so it stays current
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setDraftEnabled(s.remoteEnabled)
      setSavedEnabled(s.remoteEnabled)
      setDraftPort(s.remotePort)
      setSavedPort(s.remotePort)
      setDraftDuration(s.remoteTokenDurationMs)
      setSavedDuration(s.remoteTokenDurationMs)
    })
    window.api.remoteGetInfo().then(setInfo)
  }, [])

  useEffect(() => {
    setDirty(
      draftEnabled !== savedEnabled ||
      draftPort !== savedPort ||
      draftDuration !== savedDuration,
    )
  }, [draftEnabled, savedEnabled, draftPort, savedPort, draftDuration, savedDuration, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const current = await window.api.getSettings()
      await window.api.setSettings({
        ...current,
        remoteEnabled: draftEnabled,
        remotePort: draftPort,
        remoteTokenDurationMs: draftDuration,
      })
      setSavedEnabled(draftEnabled)
      setSavedPort(draftPort)
      setSavedDuration(draftDuration)
      setInfo(await window.api.remoteGetInfo())
    })
  }, [draftEnabled, draftPort, draftDuration, registerSave])

  const portValid = Number.isInteger(draftPort) && draftPort >= 1024 && draftPort <= 65535

  const regenerate = async (): Promise<void> => {
    const next = await window.api.remoteRegenerateToken()
    setInfo(next)
  }

  const showQr = info?.qrUrl && !info.expired

  const expiryLabel = useMemo(
    () => (info ? formatRemaining(info.expiresAt) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info, info?.expiresAt, Date.now()],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Remote Access" description="Control your devices from a browser on the same network." />
      <div className="flex-1 overflow-y-auto">
      <SettingsPageWrapper>
      <SettingSection title="Server">
        <SettingRow
          label="Enable remote access"
          description="Starts an HTTP server so you can open the web client from any device on your LAN."
        >
          <ToggleSetting checked={draftEnabled} onChange={setDraftEnabled} />
        </SettingRow>
        <SettingRow label="Port" description="Port the HTTP server listens on (1024–65535).">
          <input
            type="number"
            min={1024}
            max={65535}
            value={draftPort}
            onChange={(e) => setDraftPort(Number(e.target.value))}
            className="text-sm px-2 py-1 rounded"
            style={{
              width: 90,
              background: 'var(--color-surface-raised)',
              border: `1px solid ${portValid ? 'var(--color-border)' : 'var(--color-warn)'}`,
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Authentication">
        <SettingRow
          label="Token validity"
          description="How long the QR code stays valid after it is generated. Saving with a new value issues a fresh token."
        >
          <select
            value={draftDuration}
            onChange={(e) => setDraftDuration(Number(e.target.value))}
            className="text-sm px-2 py-1 rounded"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow
          label="Current token"
          description={info?.token ? expiryLabel : 'Save settings to generate a token.'}
        >
          <button
            type="button"
            onClick={regenerate}
            disabled={!savedEnabled}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
              fontSize: 13,
              cursor: savedEnabled ? 'pointer' : 'not-allowed',
              opacity: savedEnabled ? 1 : 0.5,
            }}
          >
            Regenerate now
          </button>
        </SettingRow>
      </SettingSection>

      {showQr && info?.qrUrl && (
        <SettingSection title="Connect">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
                fontSize: 12,
                color: 'var(--color-text-primary)',
                background: 'var(--color-code-bg)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                userSelect: 'all',
                wordBreak: 'break-all',
              }}
            >
              {info.qrUrl}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div
                style={{
                  background: 'var(--color-qr-bg)',
                  padding: 12,
                  borderRadius: 8,
                  display: 'inline-flex',
                }}
              >
                <QRCodeSVG value={info.qrUrl} size={180} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
              Scan with your phone to open the web client. The link includes the access token — anyone with this QR can control the app until it expires.
            </p>
          </div>
        </SettingSection>
      )}

      {info?.expired && savedEnabled && (
        <SettingSection title="Connect">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            The current token has expired. Click <strong>Regenerate now</strong> above to issue a new one.
          </p>
        </SettingSection>
      )}

      {!info?.enabled && draftEnabled && (
        <SettingSection title="Connect">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            Save settings to start the server and see the connection URL.
          </p>
        </SettingSection>
      )}
      </SettingsPageWrapper>
      </div>
    </div>
  )
}
