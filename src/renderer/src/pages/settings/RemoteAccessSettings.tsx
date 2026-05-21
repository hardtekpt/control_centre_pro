import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, ToggleSetting, SettingsPageWrapper } from '../../components/SettingsComponents'

export function RemoteAccessSettings(): JSX.Element {
  const { setDirty, registerSave } = useSettingsForm()

  const [draftEnabled, setDraftEnabled] = useState(false)
  const [savedEnabled, setSavedEnabled] = useState(false)
  const [draftPort, setDraftPort] = useState(8080)
  const [savedPort, setSavedPort] = useState(8080)
  const [liveUrl, setLiveUrl] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setDraftEnabled(s.remoteEnabled)
      setSavedEnabled(s.remoteEnabled)
      setDraftPort(s.remotePort)
      setSavedPort(s.remotePort)
    })
    window.api.remoteGetInfo().then((info) => {
      setLiveUrl(info.url)
    })
  }, [])

  useEffect(() => {
    setDirty(draftEnabled !== savedEnabled || draftPort !== savedPort)
  }, [draftEnabled, savedEnabled, draftPort, savedPort, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const current = await window.api.getSettings()
      await window.api.setSettings({ ...current, remoteEnabled: draftEnabled, remotePort: draftPort })
      setSavedEnabled(draftEnabled)
      setSavedPort(draftPort)
      // Refresh live URL after settings apply
      const info = await window.api.remoteGetInfo()
      setLiveUrl(info.url)
    })
  }, [draftEnabled, draftPort, registerSave])

  const portValid = Number.isInteger(draftPort) && draftPort >= 1024 && draftPort <= 65535

  return (
    <SettingsPageWrapper>
      <PageHeader title="Remote Access" description="Control your devices from a browser on the same network." />

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

      {liveUrl && (
        <SettingSection title="Connect">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
                fontSize: 13,
                color: 'var(--color-text-primary)',
                background: 'var(--color-code-bg)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                userSelect: 'all',
              }}
            >
              {liveUrl}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: 12,
                  borderRadius: 8,
                  display: 'inline-flex',
                }}
              >
                <QRCodeSVG value={liveUrl} size={160} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
              Scan with your phone to open the web client
            </p>
          </div>
        </SettingSection>
      )}

      {!liveUrl && draftEnabled && (
        <SettingSection title="Connect">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            Save settings to start the server and see the connection URL.
          </p>
        </SettingSection>
      )}
    </SettingsPageWrapper>
  )
}
