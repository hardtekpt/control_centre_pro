import { useEffect, useRef, useState } from 'react'
import { useDiscordStore } from '../../stores/discordStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'

export function DiscordSettings(): JSX.Element {
  const { discordState } = useDiscordStore()
  const { setDirty, registerSave } = useSettingsForm()

  const [savedClientId, setSavedClientId] = useState('')
  const [draftClientId, setDraftClientId] = useState('')
  const draftClientIdRef = useRef(draftClientId)

  const [savedClientSecret, setSavedClientSecret] = useState('')
  const [draftClientSecret, setDraftClientSecret] = useState('')
  const draftClientSecretRef = useRef(draftClientSecret)

  useEffect(() => {
    draftClientIdRef.current = draftClientId
  }, [draftClientId])

  useEffect(() => {
    draftClientSecretRef.current = draftClientSecret
  }, [draftClientSecret])

  // Load persisted settings on mount
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

  // Dirty detection
  useEffect(() => {
    setDirty(draftClientId !== savedClientId || draftClientSecret !== savedClientSecret)
  }, [draftClientId, savedClientId, draftClientSecret, savedClientSecret, setDirty])

  // Register save handler
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
      ? 'Not connected'
      : !discordState.authenticated
        ? 'Connected — auth failed'
        : discordState.voiceChannel
          ? `In voice: ${discordState.voiceChannel.name} (${discordState.voiceChannel.guildName})`
          : 'Connected — not in a voice channel'

  const statusColor = connected ? '#22c55e' : '#ef4444'

  return (
    <div>
      <h1
        className="text-xl font-semibold mb-7 tracking-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Discord
      </h1>

      {/* Connection status */}
      <section className="mb-8">
        <h2
          className="text-sm font-semibold mb-4 uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Status
        </h2>
        <div
          className="flex items-center gap-3 p-4 rounded"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor,
              flexShrink: 0,
            }}
          />
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
          className="mt-2 text-xs px-3 py-1.5 rounded transition-colors"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Reconnect
        </button>
      </section>

      {/* Client ID */}
      <section className="mb-8">
        <h2
          className="text-sm font-semibold mb-1 uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Discord Application
        </h2>
        <div className="mb-4 space-y-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Setup (one-time):
          </p>
          <ol className="space-y-1 list-none">
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
                </button>{' '}
                and create a new application.
              </>,
              <>
                Go to <strong>OAuth2</strong> → <strong>Redirects</strong> and add exactly:{' '}
                <code className="mono" style={{ fontSize: '0.75rem' }}>
                  http://127.0.0.1
                </code>
                . This is required for the OAuth popup to work.
              </>,
              <>
                Copy the <strong>Client ID</strong> from the <strong>General Information</strong>{' '}
                tab and the <strong>Client Secret</strong> from the <strong>OAuth2</strong> tab, and
                paste both below.
              </>,
              <>
                Make sure Discord desktop is running, then click <strong>Save</strong>. A browser
                popup will ask you to authorise the app — click <strong>Authorise</strong>. This
                only happens once.
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
          </p>
        </div>
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
              width: 320,
            }}
            spellCheck={false}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            The token is saved locally and reused. You will only be prompted in the browser once,
            unless you revoke access in Discord's Authorised Apps settings.
          </p>
        </div>
        <div className="mt-3">
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
            placeholder="Your app's OAuth2 client secret"
            className="text-sm mono px-3 py-2 rounded"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              width: 320,
            }}
            spellCheck={false}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Found in the <strong>OAuth2</strong> tab of your Discord application. Stored locally
            in app settings — never sent anywhere except discord.com during the one-time token
            exchange.
          </p>
        </div>
      </section>

      {/* Self voice controls */}
      {connected && (
        <section className="mb-8">
          <h2
            className="text-sm font-semibold mb-4 uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            My Voice
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() =>
                window.api.discordSetSelfMute(!discordState!.selfMuted).catch(console.error)
              }
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{
                background: discordState!.selfMuted ? '#ef4444' : 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: discordState!.selfMuted ? '#fff' : 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              {discordState!.selfMuted ? 'Unmute Mic' : 'Mute Mic'}
            </button>
            <button
              onClick={() =>
                window.api.discordSetSelfDeaf(!discordState!.selfDeafened).catch(console.error)
              }
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{
                background: discordState!.selfDeafened ? '#ef4444' : 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: discordState!.selfDeafened ? '#fff' : 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              {discordState!.selfDeafened ? 'Undeafen' : 'Deafen'}
            </button>
          </div>

          {/* Input / Output volume */}
          <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
            {[
              {
                label: 'Mic Input Volume',
                value: discordState!.inputVolume,
                onChange: (v: number) => window.api.discordSetInputVolume(v).catch(console.error),
              },
              {
                label: 'Output Volume',
                value: discordState!.outputVolume,
                onChange: (v: number) => window.api.discordSetOutputVolume(v).catch(console.error),
              },
            ].map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                  <span
                    className="text-xs mono w-7 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live voice state (informational) */}
      {connected && discordState?.voiceChannel && (
        <section className="mb-8">
          <h2
            className="text-sm font-semibold mb-4 uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Voice Channel — {discordState.voiceChannel.name}
          </h2>
          <div className="space-y-2">
            {discordState.participants.map((p) => (
              <div
                key={p.userId}
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
                {/* Per-participant volume slider */}
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={p.localVolume}
                  onChange={(e) => {
                    const vol = Number(e.target.value)
                    window.api.discordSetLocalVolume(p.userId, vol).catch(console.error)
                  }}
                  style={{ width: 80, cursor: 'pointer' }}
                  title={`${p.localVolume}%`}
                />
                <span
                  className="text-xs mono w-8 text-right"
                  style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
                >
                  {p.localVolume}
                </span>
                {/* Local mute toggle */}
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
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
