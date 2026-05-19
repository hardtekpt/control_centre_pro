import { useEffect, useRef, useState } from 'react'
import type { Plugin } from '@shared/types'
import { StatusPill } from './StatusPill'
import { Toggle } from './Toggle'
import { useDiscordStore } from '../../stores/discordStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { KvmConfigSection } from './KvmConfigSection'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

interface ConfigurePageProps {
  plugin: Plugin
  onBack: () => void
  onTogglePlugin: (pluginId: string) => void
}

export function ConfigurePage({ plugin, onBack, onTogglePlugin }: ConfigurePageProps): JSX.Element {
  const { discordState } = useDiscordStore()
  const { setDirty, registerSave } = useSettingsForm()

  const [savedClientId, setSavedClientId] = useState('')
  const [draftClientId, setDraftClientId] = useState('')
  const draftClientIdRef = useRef(draftClientId)

  const [savedClientSecret, setSavedClientSecret] = useState('')
  const [draftClientSecret, setDraftClientSecret] = useState('')
  const draftClientSecretRef = useRef(draftClientSecret)

  const [dragInputVolume, setDragInputVolume] = useState<number | null>(null)
  const [dragOutputVolume, setDragOutputVolume] = useState<number | null>(null)

  const displayInputVolume = dragInputVolume ?? (discordState?.inputVolume ?? 100)
  const displayOutputVolume = dragOutputVolume ?? (discordState?.outputVolume ?? 100)

  useEffect(() => {
    draftClientIdRef.current = draftClientId
  }, [draftClientId])

  useEffect(() => {
    draftClientSecretRef.current = draftClientSecret
  }, [draftClientSecret])

  useEffect(() => {
    window.api
      .getSettings()
      .then((s) => {
        setSavedClientId(s.discordClientId ?? '')
        setDraftClientId(s.discordClientId ?? '')
        setSavedClientSecret(s.discordClientSecret ?? '')
        setDraftClientSecret(s.discordClientSecret ?? '')
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setDirty(draftClientId !== savedClientId || draftClientSecret !== savedClientSecret)
  }, [draftClientId, savedClientId, draftClientSecret, savedClientSecret, setDirty])

  useEffect(() => {
    registerSave(async () => {
      const trimmedId = draftClientIdRef.current.trim()
      const trimmedSecret = draftClientSecretRef.current.trim()
      const current = await window.api.getSettings()
      await window.api.setSettings({
        ...current,
        discordClientId: trimmedId,
        discordClientSecret: trimmedSecret,
      })
      setSavedClientId(trimmedId)
      setDraftClientId(trimmedId)
      setSavedClientSecret(trimmedSecret)
      setDraftClientSecret(trimmedSecret)
      await window.api.discordReconnect()
    })
    return () => registerSave(null)
  }, [registerSave])

  const connected = discordState?.available && discordState?.authenticated

  return (
    <div>
      {/* Header */}
      <div className="cfg-header">
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            marginBottom: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            padding: 0,
          }}
        >
          <BackIcon />
          Plugins
        </button>
        <div className="cfg-header-row">
          <div className="glyph">{plugin.glyph}</div>
          <div className="meta">
            <div className="name">{plugin.name}</div>
            <div className="blurb">{plugin.blurb}</div>
            <div className="stat-row">
              <StatusPill status={plugin.status} />
              <span>v{plugin.version}</span>
              <span>{plugin.author}</span>
            </div>
          </div>
          <div className="actions">
            <div className="action-label">{plugin.enabled ? 'On' : 'Off'}</div>
            <Toggle
              checked={plugin.enabled}
              onChange={() => onTogglePlugin(plugin.id)}
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="cfg-body">
        {/* KVM Detector configuration */}
        {plugin.id === 'kvm-detector' && <KvmConfigSection plugin={plugin} />}

        {/* Discord-specific configuration */}
        {plugin.id === 'discord' && (
          <>
            {/* Status banner */}
            {!connected && (
              <div className="banner info">
                <div className="banner-content">
                  <div className="banner-title">Not authenticated</div>
                  <div className="banner-sub">Configure your Discord credentials below to connect.</div>
                </div>
              </div>
            )}

            {/* Credentials section */}
            <div className="cfg-section">
              <div className="cfg-section-h">
                <h3>Discord Application</h3>
                <span className="desc">OAuth2 credentials</span>
              </div>
              <div className="ff">
                <div className="ff-label">
                  <div className="ff-label-title">Client ID</div>
                  <div className="ff-label-desc">Find this in your Discord Developer Portal</div>
                </div>
                <input
                  type="text"
                  value={draftClientId}
                  onChange={(e) => setDraftClientId(e.target.value)}
                  placeholder="e.g. 1234567890123456789"
                  className="input mono"
                  spellCheck={false}
                />
              </div>
              <div className="ff">
                <div className="ff-label">
                  <div className="ff-label-title">Client Secret</div>
                  <div className="ff-label-desc">Keep this confidential</div>
                </div>
                <input
                  type="password"
                  value={draftClientSecret}
                  onChange={(e) => setDraftClientSecret(e.target.value)}
                  placeholder="OAuth2 client secret"
                  className="input mono"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Voice controls */}
            {connected && (
              <div className="cfg-section">
                <div className="cfg-section-h">
                  <h3>Voice Controls</h3>
                </div>
                <div className="ff">
                  <div className="ff-label">
                    <div className="ff-label-title">Mic Input Volume</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={displayInputVolume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDragInputVolume(v)
                        window.api.discordSetInputVolume(v).catch(console.error)
                      }}
                      onPointerUp={() => setDragInputVolume(null)}
                      style={{ flex: 1 }}
                    />
                    <span
                      className="mono"
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        minWidth: '32px',
                        textAlign: 'right',
                      }}
                    >
                      {displayInputVolume}%
                    </span>
                  </div>
                </div>
                <div className="ff">
                  <div className="ff-label">
                    <div className="ff-label-title">Output Volume</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={displayOutputVolume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDragOutputVolume(v)
                        window.api.discordSetOutputVolume(v).catch(console.error)
                      }}
                      onPointerUp={() => setDragOutputVolume(null)}
                      style={{ flex: 1 }}
                    />
                    <span
                      className="mono"
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        minWidth: '32px',
                        textAlign: 'right',
                      }}
                    >
                      {displayOutputVolume}%
                    </span>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  )
}
