import { useCallback } from 'react'
import { useDiscordStore } from '../../stores/discordStore'
import { useAppStore } from '../../stores/appStore'
import { SliderInput } from '../SliderInput'
import type { DiscordParticipant } from '@shared/types'

// ─── Icons ────────────────────────────────────────────────────────────────────

function DiscordIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

function MicIcon({ muted }: { muted: boolean }): JSX.Element {
  if (muted) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function HeadphonesIcon({ deafened }: { deafened: boolean }): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      {deafened && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoiceButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        cursor: 'pointer',
        color: active ? 'var(--color-bg)' : 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '26px',
        padding: 0,
        flexShrink: 0,
        transition: 'all 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <div
      className="text-xs font-medium uppercase tracking-wider pb-1 mb-1"
      style={{
        color: 'var(--color-text-secondary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {title}
    </div>
  )
}

function ParticipantRow({ participant }: { participant: DiscordParticipant }): JSX.Element {
  const patchParticipantVolume = useDiscordStore((s) => s.patchParticipantVolume)
  const patchParticipantMute = useDiscordStore((s) => s.patchParticipantMute)

  const handleMute = useCallback(() => {
    const next = !participant.localMuted
    patchParticipantMute(participant.userId, next)
    window.api.discordSetLocalMute(participant.userId, next).catch(console.error)
  }, [participant.userId, participant.localMuted, patchParticipantMute])

  const handleVolume = useCallback(
    (v: number) => {
      const vol = Math.round(v * 200)
      patchParticipantVolume(participant.userId, vol)
      window.api.discordSetLocalVolume(participant.userId, vol).catch(console.error)
    },
    [participant.userId, patchParticipantVolume],
  )

  const displayName = participant.nick || participant.username

  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Speaking indicator dot */}
      <div
        title={participant.speaking ? 'Speaking' : ''}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: participant.speaking
            ? 'var(--color-status-ok)'
            : 'var(--color-border)',
          flexShrink: 0,
          transition: 'background 150ms ease',
        }}
      />
      <span
        className="text-xs"
        style={{
          color:
            participant.muted || participant.deafened
              ? 'var(--color-text-secondary)'
              : 'var(--color-text-primary)',
          flex: '0 0 80px',
          maxWidth: '80px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={displayName}
      >
        {displayName}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SliderInput
          value={participant.localVolume / 200}
          onChange={handleVolume}
          muted={participant.localMuted}
          showMuted
        />
        <span
          className="mono text-xs shrink-0"
          style={{ color: 'var(--color-text-secondary)', width: 30, textAlign: 'right' }}
        >
          {participant.localVolume}%
        </span>
        <button
          title={participant.localMuted ? 'Unmute' : 'Mute'}
          onClick={handleMute}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
          style={{
            background: participant.localMuted
              ? 'var(--color-status-error-bg)'
              : 'transparent',
            border: '1px solid var(--color-border)',
            color: participant.localMuted
              ? 'var(--color-status-error)'
              : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <MicIcon muted={participant.localMuted} />
        </button>
      </div>
    </div>
  )
}

// ─── Discord Card ─────────────────────────────────────────────────────────────

export function DiscordCard(): JSX.Element {
  const discordState = useDiscordStore((s) => s.discordState)
  const { setView } = useAppStore()

  const connected = !!(discordState?.available && discordState?.authenticated)
  const selfMuted = discordState?.selfMuted ?? false
  const selfDeafened = discordState?.selfDeafened ?? false

  if (!connected) {
    return (
      <div
        className="rounded-lg px-4 py-3"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              <DiscordIcon />
            </span>
            <button
              onClick={() => setView('settings')}
              className="card-title"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              Discord
            </button>
            <div
              title="Not connected"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-text-secondary)',
                opacity: 0.4,
                flexShrink: 0,
              }}
            />
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {discordState?.error ? 'Error' : 'Not connected'}
          </span>
        </div>
        {discordState?.error && (
          <p
            className="text-xs mt-1.5"
            style={{ color: 'var(--color-text-secondary)', paddingLeft: '24px', margin: 0 }}
          >
            {discordState.error}
          </p>
        )}
      </div>
    )
  }

  const participants = discordState?.participants ?? []
  const channelName = discordState?.voiceChannel
    ? `${discordState.voiceChannel.guildName} · ${discordState.voiceChannel.name}`
    : null

  return (
    <div className="card card-surface">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}>
            <DiscordIcon />
          </span>
          <button
            onClick={() => setView('settings')}
            className="card-title"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Discord
          </button>
          <div
            title="Connected"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-status-ok)',
              flexShrink: 0,
            }}
          />
        </div>
        {channelName && (
          <span
            className="text-xs"
            style={{
              color: 'var(--color-text-secondary)',
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={channelName}
          >
            {channelName}
          </span>
        )}
      </div>

      {/* Voice controls */}
      <div className="flex flex-col gap-0.5 mb-3">
        <SectionHeader title="Voice" />

        {/* Mute / Deafen */}
        <div className="flex items-center gap-3 py-1">
          <span className="card-row-label shrink-0" style={{ minWidth: '60px' }}>
            Controls
          </span>
          <div className="flex items-center gap-1.5">
            <VoiceButton
              title={selfMuted ? 'Unmute mic' : 'Mute mic'}
              active={selfMuted}
              onClick={() => window.api.discordSetSelfMute(!selfMuted).catch(console.error)}
            >
              <MicIcon muted={selfMuted} />
            </VoiceButton>
            <VoiceButton
              title={selfDeafened ? 'Undeafen' : 'Deafen'}
              active={selfDeafened}
              onClick={() => window.api.discordSetSelfDeaf(!selfDeafened).catch(console.error)}
            >
              <HeadphonesIcon deafened={selfDeafened} />
            </VoiceButton>
          </div>
        </div>

        {/* Mic input volume */}
        <div className="flex items-center gap-3 py-1">
          <span className="card-row-label shrink-0" style={{ minWidth: '60px' }}>
            Mic
          </span>
          <div className="flex items-center gap-2 flex-1">
            <SliderInput
              value={(discordState?.inputVolume ?? 100) / 100}
              onChange={(v) =>
                window.api.discordSetInputVolume(Math.round(v * 100)).catch(console.error)
              }
              muted={selfMuted}
              showMuted
            />
            <span
              className="mono text-xs shrink-0"
              style={{ color: 'var(--color-text-secondary)', width: 28 }}
            >
              {discordState?.inputVolume ?? 100}%
            </span>
          </div>
        </div>

        {/* Output volume */}
        <div className="flex items-center gap-3 py-1">
          <span className="card-row-label shrink-0" style={{ minWidth: '60px' }}>
            Output
          </span>
          <div className="flex items-center gap-2 flex-1">
            <SliderInput
              value={(discordState?.outputVolume ?? 100) / 100}
              onChange={(v) =>
                window.api.discordSetOutputVolume(Math.round(v * 100)).catch(console.error)
              }
              muted={selfDeafened}
              showMuted
            />
            <span
              className="mono text-xs shrink-0"
              style={{ color: 'var(--color-text-secondary)', width: 28 }}
            >
              {discordState?.outputVolume ?? 100}%
            </span>
          </div>
        </div>
      </div>

      {/* Participants — only shown when in a voice channel */}
      {participants.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <SectionHeader title="Voice Channel" />
          <div className="flex flex-col">
            {participants.map((p) => (
              <ParticipantRow key={p.userId} participant={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
