import { useEffect, useRef, useState } from 'react'
import type { Plugin } from '@shared/types'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { useHaStore } from '../../stores/haStore'

interface Props {
  plugin: Plugin
}

export function HomeAssistantConfigSection({ plugin }: Props): JSX.Element {
  const { setDirty, registerSave } = useSettingsForm()
  const { haState } = useHaStore()

  const [savedUrl, setSavedUrl] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [savedToken, setSavedToken] = useState('')
  const [draftToken, setDraftToken] = useState('')

  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const draftUrlRef = useRef(draftUrl)
  const draftTokenRef = useRef(draftToken)

  useEffect(() => { draftUrlRef.current = draftUrl }, [draftUrl])
  useEffect(() => { draftTokenRef.current = draftToken }, [draftToken])

  // Load settings on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSavedUrl(s.haUrl ?? '')
      setDraftUrl(s.haUrl ?? '')
      setSavedToken(s.haToken ?? '')
      setDraftToken(s.haToken ?? '')
    }).catch(console.error)
  }, [])

  // Dirty tracking
  useEffect(() => {
    if (plugin.id !== 'home-assistant') return
    setDirty(draftUrl !== savedUrl || draftToken !== savedToken)
  }, [plugin.id, draftUrl, savedUrl, draftToken, savedToken, setDirty])

  // Save handler
  useEffect(() => {
    if (plugin.id !== 'home-assistant') return
    registerSave(async () => {
      const trimmedUrl = draftUrlRef.current.trim().replace(/\/$/, '')
      const trimmedToken = draftTokenRef.current.trim()
      const current = await window.api.getSettings()
      await window.api.setSettings({ ...current, haUrl: trimmedUrl, haToken: trimmedToken })
      setSavedUrl(trimmedUrl)
      setDraftUrl(trimmedUrl)
      setSavedToken(trimmedToken)
      setDraftToken(trimmedToken)
      setTestResult(null)
    })
    return () => registerSave(null)
  }, [plugin.id, registerSave])

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.haTestConnection(
        draftUrlRef.current.trim(),
        draftTokenRef.current.trim()
      )
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, error: 'Unexpected error' })
    }
    setTesting(false)
  }

  const isConnected = haState?.status === 'connected'
  const isError = haState?.status === 'error'

  return (
    <>
      {!savedUrl && (
        <div className="banner info">
          <div className="banner-content">
            <div className="banner-title">Not configured</div>
            <div className="banner-sub">Enter your Home Assistant URL and a long-lived access token below.</div>
          </div>
        </div>
      )}

      {savedUrl && isError && (
        <div className="banner error">
          <div className="banner-content">
            <div className="banner-title">Connection error</div>
            <div className="banner-sub">{haState?.error ?? 'Unknown error'}</div>
          </div>
        </div>
      )}

      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>Connection</h3>
          <span className="desc">Home Assistant instance URL and credentials</span>
        </div>

        <div className="ff">
          <div className="ff-label">
            <div className="ff-label-title">URL</div>
            <div className="ff-label-desc">Base URL of your Home Assistant instance</div>
          </div>
          <input
            type="text"
            value={draftUrl}
            onChange={(e) => { setDraftUrl(e.target.value); setTestResult(null) }}
            placeholder="http://homeassistant.local:8123"
            className="input mono"
            spellCheck={false}
          />
        </div>

        <div className="ff">
          <div className="ff-label">
            <div className="ff-label-title">Long-lived access token</div>
            <div className="ff-label-desc">Create one in your HA Profile → Long-Lived Access Tokens</div>
          </div>
          <input
            type="password"
            value={draftToken}
            onChange={(e) => { setDraftToken(e.target.value); setTestResult(null) }}
            placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9…"
            className="input mono"
            spellCheck={false}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-ghost"
            onClick={handleTestConnection}
            disabled={testing || !draftUrl || !draftToken}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {testResult && (
            <span
              className="mono"
              style={{
                fontSize: '12px',
                color: testResult.ok ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {testResult.ok ? 'Connected successfully' : (testResult.error ?? 'Connection failed')}
            </span>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="cfg-section">
          <div className="cfg-section-h">
            <h3>Status</h3>
          </div>
          <div className="ff">
            <div className="ff-label">
              <div className="ff-label-title">Entities loaded</div>
              <div className="ff-label-desc">Total entities synced from Home Assistant</div>
            </div>
            <span
              className="mono"
              style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}
            >
              {haState?.entityCount ?? 0}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
