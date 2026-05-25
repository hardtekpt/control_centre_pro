import { useEffect, useRef, useState } from 'react'
import type { HaHomeCardEntity, Plugin } from '@shared/types'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { useHaStore } from '../../stores/haStore'
import { HaEntityPicker } from './HaEntityPicker'

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

  const [savedHomeCardEnabled, setSavedHomeCardEnabled] = useState(false)
  const [draftHomeCardEnabled, setDraftHomeCardEnabled] = useState(false)
  const [savedHomeCardEntities, setSavedHomeCardEntities] = useState<HaHomeCardEntity[]>([])
  const [draftHomeCardEntities, setDraftHomeCardEntities] = useState<HaHomeCardEntity[]>([])
  const [showPicker, setShowPicker] = useState(false)

  const draftUrlRef = useRef(draftUrl)
  const draftTokenRef = useRef(draftToken)
  const draftHomeCardEnabledRef = useRef(false)
  const draftHomeCardEntitiesRef = useRef<HaHomeCardEntity[]>([])

  useEffect(() => { draftUrlRef.current = draftUrl }, [draftUrl])
  useEffect(() => { draftTokenRef.current = draftToken }, [draftToken])
  useEffect(() => { draftHomeCardEnabledRef.current = draftHomeCardEnabled }, [draftHomeCardEnabled])
  useEffect(() => { draftHomeCardEntitiesRef.current = draftHomeCardEntities }, [draftHomeCardEntities])

  // Load settings on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSavedUrl(s.haUrl ?? '')
      setDraftUrl(s.haUrl ?? '')
      setSavedToken(s.haToken ?? '')
      setDraftToken(s.haToken ?? '')
      setSavedHomeCardEnabled(s.haHomeCardEnabled ?? false)
      setDraftHomeCardEnabled(s.haHomeCardEnabled ?? false)
      setSavedHomeCardEntities(s.haHomeCardEntities ?? [])
      setDraftHomeCardEntities(s.haHomeCardEntities ?? [])
    }).catch(console.error)
  }, [])

  // Dirty tracking
  useEffect(() => {
    if (plugin.id !== 'home-assistant') return
    setDirty(
      draftUrl !== savedUrl ||
      draftToken !== savedToken ||
      draftHomeCardEnabled !== savedHomeCardEnabled ||
      JSON.stringify(draftHomeCardEntities) !== JSON.stringify(savedHomeCardEntities)
    )
  }, [plugin.id, draftUrl, savedUrl, draftToken, savedToken, draftHomeCardEnabled, savedHomeCardEnabled, draftHomeCardEntities, savedHomeCardEntities, setDirty])

  // Save handler
  useEffect(() => {
    if (plugin.id !== 'home-assistant') return
    registerSave(async () => {
      const trimmedUrl = draftUrlRef.current.trim().replace(/\/$/, '')
      const trimmedToken = draftTokenRef.current.trim()
      const current = await window.api.getSettings()
      await window.api.setSettings({
        ...current,
        haUrl: trimmedUrl,
        haToken: trimmedToken,
        haHomeCardEnabled: draftHomeCardEnabledRef.current,
        haHomeCardEntities: draftHomeCardEntitiesRef.current,
      })
      setSavedUrl(trimmedUrl)
      setDraftUrl(trimmedUrl)
      setSavedToken(trimmedToken)
      setDraftToken(trimmedToken)
      setSavedHomeCardEnabled(draftHomeCardEnabledRef.current)
      setSavedHomeCardEntities(draftHomeCardEntitiesRef.current)
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

  const moveEntity = (i: number, dir: 'up' | 'down'): void => {
    const j = dir === 'up' ? i - 1 : i + 1
    setDraftHomeCardEntities(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setDirty(true)
  }

  const removeEntity = (i: number): void => {
    setDraftHomeCardEntities(prev => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

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
            style={{ border: 'none' }}
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

      <div className="cfg-section">
        <div className="cfg-section-h">
          <h3>Home Card</h3>
          <span className="desc">Entities shown on the home page dashboard</span>
        </div>

        <div className="ff">
          <div className="ff-label">
            <div className="ff-label-title">Show on home page</div>
          </div>
          <input
            type="checkbox"
            checked={draftHomeCardEnabled}
            onChange={e => { setDraftHomeCardEnabled(e.target.checked); setDirty(true) }}
          />
        </div>

        {draftHomeCardEnabled && (
          <>
            {draftHomeCardEntities.map((cfg, i) => (
              <div key={cfg.entityId + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <button
                  onClick={() => moveEntity(i, 'up')}
                  disabled={i === 0}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--color-text-secondary)', opacity: i === 0 ? 0.3 : 1, fontSize: 14 }}
                >↑</button>
                <button
                  onClick={() => moveEntity(i, 'down')}
                  disabled={i === draftHomeCardEntities.length - 1}
                  style={{ background: 'none', border: 'none', cursor: i === draftHomeCardEntities.length - 1 ? 'default' : 'pointer', color: 'var(--color-text-secondary)', opacity: i === draftHomeCardEntities.length - 1 ? 0.3 : 1, fontSize: 14 }}
                >↓</button>
                <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 64, flexShrink: 0 }}>
                  {cfg.type}
                </span>
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cfg.displayName ?? haState?.entities.find(e => e.entity_id === cfg.entityId)?.attributes?.friendly_name as string ?? cfg.entityId}
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                  {cfg.entityId}
                </span>
                <button
                  onClick={() => removeEntity(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14, flexShrink: 0 }}
                  title="Remove"
                >🗑</button>
              </div>
            ))}

            <button
              className="btn-ghost"
              onClick={() => setShowPicker(true)}
              disabled={haState?.status !== 'connected'}
              title={haState?.status !== 'connected' ? 'Connect to Home Assistant to browse entities' : undefined}
              style={{ marginTop: 4 }}
            >
              + Add entity
            </button>

            {showPicker && (
              <HaEntityPicker
                entities={haState?.entities ?? []}
                configured={draftHomeCardEntities}
                onAdd={(entity) => {
                  setDraftHomeCardEntities(prev => [...prev, entity])
                  setDirty(true)
                }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
