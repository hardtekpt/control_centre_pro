import { useEffect, useRef, useState } from 'react'
import type { Plugin } from '@shared/types'
import { StatusPill } from './StatusPill'
import { Toggle } from './Toggle'
import { useDiscordStore } from '../../stores/discordStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { KvmConfigSection } from './KvmConfigSection'
import { SliderInput } from '../SliderInput'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

function DeafenIcon({ deafened }: { deafened: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      {deafened && <line x1="3" y1="3" x2="21" y2="21" />}
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

  const [labelInputVolume, setLabelInputVolume] = useState(100)
  const [labelOutputVolume, setLabelOutputVolume] = useState(100)

  useEffect(() => {
    setLabelInputVolume(discordState?.inputVolume ?? 100)
  }, [discordState?.inputVolume])

  useEffect(() => {
    setLabelOutputVolume(discordState?.outputVolume ?? 100)
  }, [discordState?.outputVolume])

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
    if (plugin.id !== 'discord') return
    setDirty(draftClientId !== savedClientId || draftClientSecret !== savedClientSecret)
  }, [plugin.id, draftClientId, savedClientId, draftClientSecret, savedClientSecret, setDirty])

  useEffect(() => {
    if (plugin.id !== 'discord') return
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
  }, [plugin.id, registerSave])

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                    <button
                      title={discordState?.selfMuted ? 'Unmute mic' : 'Mute mic'}
                      onClick={() => window.api.discordSetSelfMute(!discordState?.selfMuted).catch(console.error)}
                      style={{
                        background: discordState?.selfMuted ? 'var(--color-accent)' : 'none',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: discordState?.selfMuted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        padding: 0,
                      }}
                    >
                      <MicIcon muted={discordState?.selfMuted ?? false} />
                    </button>
                    <button
                      title={discordState?.selfDeafened ? 'Undeafen' : 'Deafen'}
                      onClick={() => window.api.discordSetSelfDeaf(!discordState?.selfDeafened).catch(console.error)}
                      style={{
                        background: discordState?.selfDeafened ? 'var(--color-accent)' : 'none',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: discordState?.selfDeafened ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        padding: 0,
                      }}
                    >
                      <DeafenIcon deafened={discordState?.selfDeafened ?? false} />
                    </button>
                  </div>
                </div>
                <div className="ff">
                  <div className="ff-label">
                    <div className="ff-label-title">Mic Input Volume</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SliderInput
                      value={(discordState?.inputVolume ?? 100) / 100}
                      onChange={(v) => {
                        const val = Math.round(v * 100)
                        setLabelInputVolume(val)
                        window.api.discordSetInputVolume(val).catch(console.error)
                      }}
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
                      {labelInputVolume}%
                    </span>
                  </div>
                </div>
                <div className="ff">
                  <div className="ff-label">
                    <div className="ff-label-title">Output Volume</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SliderInput
                      value={(discordState?.outputVolume ?? 100) / 100}
                      onChange={(v) => {
                        const val = Math.round(v * 100)
                        setLabelOutputVolume(val)
                        window.api.discordSetOutputVolume(val).catch(console.error)
                      }}
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
                      {labelOutputVolume}%
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
