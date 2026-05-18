import { useEffect, useRef, useState } from 'react'
import { useDiscordStore } from '../../stores/discordStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import type { DiscordParticipant } from '@shared/types'

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="currentColor" stroke="none"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22"/>
      <path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/>
      <path d="M5 10v2a7 7 0 0 0 7 7v0"/>
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  )
}

function HeadphonesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  )
}

function HeadphonesOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 14.5V12a9 9 0 0 0-9-9 9 9 0 0 0-7.5 4.04"/>
      <path d="M3.14 9.44A9 9 0 0 0 3 12v2"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  )
}

function ParticipantRow({ p }: { p: DiscordParticipant }): JSX.Element {
  const [dragVolume, setDragVolume] = useState<number | null>(null)
  const displayVolume = dragVolume ?? p.localVolume

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {p.avatar ? (
        <img
          src={p.avatar}
          alt={p.nick}
          style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'var(--color-surface-raised)',
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium truncate"
          style={{ color: p.speaking ? '#22c55e' : 'var(--color-text-primary)' }}
        >
          {p.nick}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {p.muted && 'muted '}
          {p.deafened && 'deafened '}
          {p.localMuted && '(local mute)'}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        value={displayVolume}
        onChange={(e) => {
          const vol = Number(e.target.value)
          setDragVolume(vol)
          window.api.discordSetLocalVolume(p.userId, vol).catch(console.error)
        }}
        onPointerUp={() => setDragVolume(null)}
        style={{ width: 80, cursor: 'pointer' }}
        title={`${displayVolume}%`}
      />
      <span
        className="text-xs mono w-8 text-right"
        style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
      >
        {displayVolume}
      </span>
      <button
        onClick={() =>
          window.api.discordSetLocalMute(p.userId, !p.localMuted).catch(console.error)
        }
        className="text-xs px-2 py-1 rounded transition-colors"
        style={{
          background: p.localMuted ? '#ef4444' : 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          color: p.localMuted ? '#fff' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {p.localMuted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  )
}

export function Plugins(): JSX.Element {
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

  const statusText =
    !discordState || !discordState.available
      ? 'Discord app not running'
      : !discordState.authenticated
        ? 'Connected — auth failed'
        : discordState.voiceChannel
          ? `In voice: ${discordState.voiceChannel.name} (${discordState.voiceChannel.guildName})`
          : 'Connected — not in a voice channel'

  const statusColor =
    !discordState || !discordState.available
      ? '#ef4444'
      : discordState.authenticated
        ? '#22c55e'
        : '#f59e0b'

  return (
    <div>
      <h1
        className="text-xl font-semibold mb-5 tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Plugins
      </h1>

      {/* Discord Plugin Section */}
      <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '24px', marginBottom: '24px' }}>
        <h2
          className="text-lg font-semibold mb-4 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Discord
        </h2>

        {/* Connection status */}
        <section className="mb-6">
          <h3
            className="text-sm font-semibold mb-3 uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Status
          </h3>
          <div className="flex items-stretch gap-3">
            <div
              className="flex items-center gap-3 px-3 py-2 rounded flex-1"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {/* Connection indicator */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                style={{ flexShrink: 0 }}
              >
                <circle cx="7" cy="7" r="5" fill={statusColor} />
                {connected && (
                  <circle cx="7" cy="7" r="5" fill={statusColor} opacity="0.3">
                    <animate attributeName="r" from="5" to="7" dur="1.5s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite"/>
                  </circle>
                )}
              </svg>
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {statusText}
              </span>
              {discordState?.error && (
                <span className="text-xs ml-auto" style={{ color: '#ef4444' }}>
                  {discordState.error}
                </span>
              )}
            </div>
            <button
              onClick={() => window.api.discordReconnect().catch(console.error)}
              className="text-xs px-3 rounded transition-colors"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
                alignSelf: 'stretch',
              }}
            >
              Reconnect
            </button>
          </div>
        </section>

        {/* Client ID */}
        <section className="mb-6">
          <h3
            className="text-sm font-semibold mb-1 uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Discord Application
          </h3>
          <div className="mb-4 space-y-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Setup (one-time):
            </p>
            <ol className="space-y-2 list-none">
              {[
                <>
                  Open{' '}
                  <button
                    className="underline"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-accent)',
                      padding: 0,
                      fontSize: 'inherit',
                    }}
                    onClick={() =>
                      window.api.openExternal('https://discord.com/developers/applications')
                    }
                  >
                    discord.com/developers/applications
                  </button>
                  , sign in, and click <strong>New Application</strong>. Give it any name (e.g.
                  "Control Centre Pro"). You land on the <strong>General Information</strong> page.
                </>,
                <>
                  On <strong>General Information</strong>, find <strong>Application ID</strong> and
                  click <strong>Copy</strong>. This is your <strong>Client ID</strong> — paste it in
                  the field below.
                </>,
                <>
                  Click <strong>OAuth2</strong> in the left sidebar. Under{' '}
                  <strong>Client Secret</strong>, click <strong>Reset Secret</strong> (you may need to
                  confirm with your 2FA). Copy the secret that appears and paste it in the{' '}
                  <strong>Client Secret</strong> field below. You can only see it once — if you
                  navigate away, reset it again.
                </>,
                <>
                  Still on <strong>OAuth2</strong>, scroll to <strong>Redirects</strong>. Click{' '}
                  <strong>Add Redirect</strong> and enter exactly{' '}
                  <code className="mono" style={{ fontSize: '0.75rem' }}>
                    http://127.0.0.1
                  </code>{' '}
                  (no trailing slash, no port). Click <strong>Save Changes</strong>. This URI is
                  where Discord sends the OAuth code during the one-time authorisation flow.
                </>,
                <>
                  Make sure the <strong>Discord desktop app</strong> is running and you are logged in.
                  Paste your Client ID and Client Secret below, then click <strong>Save</strong> at
                  the top of the page. A Discord popup will ask you to authorise the app — click{' '}
                  <strong>Authorise</strong>. This only happens once; the token is saved locally and
                  reused on every subsequent start.
                </>,
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className="mono shrink-0"
                    style={{ color: 'var(--color-text-secondary)', minWidth: '1.25rem' }}
                  >
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="pt-1">
              Scopes requested:{' '}
              <code className="mono" style={{ fontSize: '0.75rem' }}>
                rpc rpc.voice.read rpc.voice.write
              </code>
              . To revoke access later, open Discord → User Settings → Authorised Apps.
            </p>
          </div>
          <div className="flex gap-4">
            <div>
              <label
                className="block text-xs mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Client ID
              </label>
              <input
                type="text"
                value={draftClientId}
                onChange={(e) => setDraftClientId(e.target.value)}
                placeholder="e.g. 1234567890123456789"
                className="text-sm mono px-3 py-2 rounded"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  width: 240,
                }}
                spellCheck={false}
              />
            </div>
            <div>
              <label
                className="block text-xs mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Client Secret
              </label>
              <input
                type="password"
                value={draftClientSecret}
                onChange={(e) => setDraftClientSecret(e.target.value)}
                placeholder="OAuth2 client secret"
                className="text-sm mono px-3 py-2 rounded"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  width: 240,
                }}
                spellCheck={false}
              />
            </div>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            The token is saved locally — you will only be prompted in the browser once, unless you
            revoke access in Discord's Authorised Apps settings.
          </p>
        </section>

        {/* Self voice controls */}
        {connected && (
          <section className="mb-6">
            <h3
              className="text-sm font-semibold mb-4 uppercase tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              My Voice
            </h3>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() =>
                  window.api.discordSetSelfMute(!discordState!.selfMuted).catch(console.error)
                }
                title={discordState!.selfMuted ? 'Unmute Mic' : 'Mute Mic'}
                className="flex items-center justify-center w-9 h-9 rounded transition-colors"
                style={{
                  background: discordState!.selfMuted ? '#ef4444' : 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: discordState!.selfMuted ? '#fff' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {discordState!.selfMuted ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button
                onClick={() =>
                  window.api.discordSetSelfDeaf(!discordState!.selfDeafened).catch(console.error)
                }
                title={discordState!.selfDeafened ? 'Undeafen' : 'Deafen'}
                className="flex items-center justify-center w-9 h-9 rounded transition-colors"
                style={{
                  background: discordState!.selfDeafened ? '#ef4444' : 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: discordState!.selfDeafened ? '#fff' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {discordState!.selfDeafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
              </button>
            </div>

            {/* Input / Output volume */}
            <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Mic Input Volume
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={displayInputVolume}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setDragInputVolume(v)
                      window.api.discordSetInputVolume(v).catch(console.error)
                    }}
                    onPointerUp={() => setDragInputVolume(null)}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                  <span
                    className="text-xs mono w-7 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {displayInputVolume}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Output Volume
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={displayOutputVolume}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setDragOutputVolume(v)
                      window.api.discordSetOutputVolume(v).catch(console.error)
                    }}
                    onPointerUp={() => setDragOutputVolume(null)}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                  <span
                    className="text-xs mono w-7 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {displayOutputVolume}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Live voice state (informational) */}
        {connected && discordState?.voiceChannel && (
          <section className="mb-8">
            <h3
              className="text-sm font-semibold mb-4 uppercase tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Voice Channel — {discordState.voiceChannel.name}
            </h3>
            <div className="space-y-2">
              {discordState.participants.map((p) => (
                <ParticipantRow key={p.userId} p={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
