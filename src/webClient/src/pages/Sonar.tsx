import { useMemo, useState } from 'react'
import {
  useSonarStore,
  sonarSetVolume,
  sonarSetMute,
  sonarSelectPreset,
  sonarSetRedirection,
  sonarRouteProcess,
} from '../stores/sonarStore'
import { usePresetSwitcherStore } from '../stores/presetSwitcherStore'
import { Card } from '../components/Card'
import { Select } from '../components/Select'
import { VerticalFader } from '../components/VerticalFader'
import { LightningIcon } from '../components/icons'
import type {
  SonarChannel,
  SonarDeviceChannel,
  SonarConfig,
  SonarState,
  SonarAudioSession,
  PresetSwitcherRule,
} from '@shared/types'

const CHANNEL_ORDER: SonarChannel[] = ['master', 'game', 'media', 'chatRender', 'chatCapture', 'aux']
const DEVICE_CHANNELS: SonarDeviceChannel[] = ['game', 'media', 'chatRender', 'chatCapture', 'aux']
const CHANNEL_LABELS: Record<SonarChannel, string> = {
  master: 'Master',
  game: 'Game',
  media: 'Media',
  chatRender: 'Chat',
  chatCapture: 'Mic',
  aux: 'Aux',
}

function getFavoritesForChannel(configs: SonarConfig[], device: string): SonarConfig[] {
  return configs
    .filter((c) => c.virtualAudioDevice === device && c.isFavorite)
    .sort((a, b) => (a.favoritePosition ?? 0) - (b.favoritePosition ?? 0))
}

function channelVolume(state: SonarState, ch: SonarChannel): { volume: number; muted: boolean } | null {
  const classic = state.classic
  if (!classic) return null
  if (ch === 'master') return classic.masters.classic
  return classic.devices[ch as SonarDeviceChannel]?.classic ?? null
}

export function Sonar(): JSX.Element {
  const sonarState = useSonarStore((s) => s.sonarState)

  if (!sonarState?.available) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          GG Sonar
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>GG Sonar not available</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>GG Sonar</h1>
      <MixerCard sonarState={sonarState} />
      <ChannelsCard sonarState={sonarState} />
      <AutoPresetCard sonarState={sonarState} />
    </div>
  )
}

// ── Card 1: vertical fader mixer ───────────────────────────────────────────────

function MixerCard({ sonarState }: { sonarState: SonarState }): JSX.Element {
  const { beginDrag, endDrag } = useSonarStore()

  return (
    <Card title="Mixer">
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {CHANNEL_ORDER.map((ch) => {
          const vol = channelVolume(sonarState, ch)
          if (!vol) return null
          return (
            <div
              key={ch}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flex: '1 0 auto',
                minWidth: 52,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{CHANNEL_LABELS[ch]}</span>
              <VerticalFader
                value={vol.volume}
                muted={vol.muted}
                onChange={(v) => void sonarSetVolume(ch, v)}
                onDragStart={beginDrag}
                onDragEnd={endDrag}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {Math.round(vol.volume * 100)}%
              </span>
              <button
                onClick={() => void sonarSetMute(ch, !vol.muted)}
                title={vol.muted ? 'Unmute' : 'Mute'}
                aria-label={`${CHANNEL_LABELS[ch]} ${vol.muted ? 'unmute' : 'mute'}`}
                style={{
                  width: 34,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: vol.muted ? 'var(--segment-active-bg)' : 'var(--color-surface-raised)',
                  color: vol.muted ? 'var(--segment-active-color)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MuteGlyph muted={vol.muted} />
              </button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function MuteGlyph({ muted }: { muted: boolean }): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      )}
    </svg>
  )
}

// ── Card 2: per-channel settings (preset · output · routed apps) ────────────────

function Labeled({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 56, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function ChannelsCard({ sonarState }: { sonarState: SonarState }): JSX.Element {
  const activePresetIds = useSonarStore((s) => s.activePresetIds)

  const sessionsByRole = useMemo(() => {
    const map: Record<string, SonarAudioSession[]> = {}
    for (const route of sonarState.routing) {
      if (route.role === 'none') continue
      if (!map[route.role]) map[route.role] = []
      map[route.role].push(...route.audioSessions)
    }
    return map
  }, [sonarState.routing])

  return (
    <Card title="Channels">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DEVICE_CHANNELS.map((ch) => {
          const favorites = getFavoritesForChannel(sonarState.configs, ch)
          const activeId = activePresetIds[ch] ?? sonarState.configs.find((c) => c.virtualAudioDevice === ch && c.isSelected)?.id
          const currentDevice = sonarState.redirections[ch]
          const activeSessions = sessionsByRole[ch] ?? []

          return (
            <div key={ch} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {CHANNEL_LABELS[ch]}
              </span>

              {favorites.length > 0 && (
                <Labeled label="Preset">
                  <Select
                    compact
                    ariaLabel={`${CHANNEL_LABELS[ch]} preset`}
                    value={activeId ?? ''}
                    placeholder="Preset"
                    onChange={(v) => void sonarSelectPreset(v, ch)}
                    options={favorites.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </Labeled>
              )}

              {sonarState.audioDevices.length > 0 && (
                <Labeled label="Output">
                  <Select
                    compact
                    ariaLabel={`${CHANNEL_LABELS[ch]} output`}
                    value={currentDevice?.id ?? ''}
                    placeholder="Device"
                    onChange={(v) => {
                      const device = sonarState.audioDevices.find((d) => d.id === v)
                      if (device) void sonarSetRedirection(ch, device)
                    }}
                    options={sonarState.audioDevices.map((d) => ({ value: d.id, label: d.name }))}
                  />
                </Labeled>
              )}

              <RoutedApps channel={ch} sessions={activeSessions} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}


function RoutedApps({ channel, sessions }: { channel: SonarDeviceChannel; sessions: SonarAudioSession[] }): JSX.Element {
  const [chooserFor, setChooserFor] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 56, flexShrink: 0, paddingTop: 6 }}>Apps</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sessions.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', paddingTop: 4 }}>No apps</span>
        )}
        {sessions.map((s) => (
          <div key={s.id} style={{ position: 'relative' }}>
            <button
              onClick={() => setChooserFor((cur) => (cur === s.processId ? null : s.processId))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 9px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: chooserFor === s.processId ? 'var(--color-accent-subtle)' : 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                maxWidth: 160,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.displayName || s.processName}
              </span>
            </button>
            {chooserFor === s.processId && (
              <ChannelChooser
                current={channel}
                onPick={(target) => {
                  setChooserFor(null)
                  if (target !== channel) void sonarRouteProcess(s.processId, target)
                }}
                onClose={() => setChooserFor(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChannelChooser({
  current,
  onPick,
  onClose,
}: {
  current: SonarDeviceChannel
  onPick: (target: SonarDeviceChannel) => void
  onClose: () => void
}): JSX.Element {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          zIndex: 41,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-dropdown)',
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 120,
        }}
      >
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', padding: '4px 8px' }}>
          Move to
        </span>
        {DEVICE_CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => onPick(ch)}
            disabled={ch === current}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: 6,
              border: 'none',
              background: ch === current ? 'var(--color-accent-subtle)' : 'transparent',
              color: ch === current ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: ch === current ? 'default' : 'pointer',
            }}
          >
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>
    </>
  )
}

// ── Card 3: auto preset switch ──────────────────────────────────────────────────

function AutoPresetCard({ sonarState }: { sonarState: SonarState }): JSX.Element {
  const { rules, enabled, activeProcessName, openApps } = usePresetSwitcherStore()
  const { saveRules, setEnabled, fetchOpenApps } = usePresetSwitcherStore()
  const [showAdd, setShowAdd] = useState(false)

  const configs = sonarState.configs
  const activeDisplayName = activeProcessName ? activeProcessName.replace(/\.(exe|app)$/i, '') : null
  const existingProcessNames = useMemo(() => new Set(rules.map((r) => r.appProcessName)), [rules])

  function updateRule(id: string, updated: PresetSwitcherRule): void {
    void saveRules(rules.map((r) => (r.id === id ? updated : r)))
  }
  function removeRule(id: string): void {
    void saveRules(rules.filter((r) => r.id !== id))
  }
  function addRule(partial: Omit<PresetSwitcherRule, 'id'>): void {
    void saveRules([...rules, { ...partial, id: crypto.randomUUID() }])
    setShowAdd(false)
  }
  function openAddForm(): void {
    if (!showAdd) void fetchOpenApps()
    setShowAdd(true)
  }

  return (
    <Card
      title="Auto preset switch"
      right={
        <>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              padding: '2px 8px',
              borderRadius: 10,
              background: enabled ? 'var(--color-accent-subtle)' : 'transparent',
              color: enabled ? 'var(--color-ok)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {enabled ? 'AUTO ON' : 'AUTO OFF'}
          </span>
          <Toggle checked={enabled} onChange={() => void setEnabled(!enabled)} />
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Active app */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LightningIcon color="var(--color-text-secondary)" size={13} />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Active app:{' '}
            <span style={{ color: 'var(--color-text-primary)' }}>{activeDisplayName ?? '—'}</span>
          </span>
        </div>

        {/* Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              isActive={enabled && rule.enabled && rule.appProcessName.toLowerCase() === activeProcessName.toLowerCase()}
              configs={configs}
              onUpdate={(u) => updateRule(rule.id, u)}
              onRemove={() => removeRule(rule.id)}
            />
          ))}
          {rules.length === 0 && !showAdd && (
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>No rules yet</span>
          )}
        </div>

        {showAdd ? (
          <AddRuleForm
            openApps={openApps}
            configs={configs}
            existingProcessNames={existingProcessNames}
            onAdd={addRule}
            onCancel={() => setShowAdd(false)}
            onRefresh={() => void fetchOpenApps()}
          />
        ) : (
          <button
            onClick={openAddForm}
            disabled={rules.length >= 10}
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px dashed var(--color-border-strong)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: rules.length >= 10 ? 'default' : 'pointer',
              opacity: rules.length >= 10 ? 0.5 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {rules.length >= 10 ? 'Limit reached' : 'Add rule'}
          </button>
        )}
      </div>
    </Card>
  )
}

function RuleRow({
  rule,
  isActive,
  configs,
  onUpdate,
  onRemove,
}: {
  rule: PresetSwitcherRule
  isActive: boolean
  configs: SonarConfig[]
  onUpdate: (rule: PresetSwitcherRule) => void
  onRemove: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const channel = rule.channel ?? ''
  const presetName = configs.find((c) => c.id === rule.presetId)?.name ?? 'No preset'
  const favorites = channel ? getFavoritesForChannel(configs, channel) : []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${isActive ? 'var(--color-ok)' : 'var(--color-border)'}`,
        background: 'var(--color-surface-raised)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rule.displayName}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {channel ? `${CHANNEL_LABELS[channel as SonarChannel] ?? channel} · ${presetName}` : '—'}
        </span>
        <button onClick={() => setEditing((e) => !e)} aria-label="Edit rule" style={iconBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
          </svg>
        </button>
        <button onClick={onRemove} aria-label="Delete rule" style={iconBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Select
            compact
            ariaLabel="Rule channel"
            value={channel}
            placeholder="Channel"
            onChange={(v) => onUpdate({ ...rule, channel: v, presetId: undefined })}
            options={DEVICE_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
          />
          <Select
            compact
            ariaLabel="Rule preset"
            value={rule.presetId ?? ''}
            placeholder="Preset"
            disabled={!channel || favorites.length === 0}
            onChange={(v) => onUpdate({ ...rule, presetId: v })}
            options={favorites.map((f) => ({ value: f.id, label: f.name }))}
          />
        </div>
      )}
    </div>
  )
}

function AddRuleForm({
  openApps,
  configs,
  existingProcessNames,
  onAdd,
  onCancel,
  onRefresh,
}: {
  openApps: { processName: string; displayName: string }[]
  configs: SonarConfig[]
  existingProcessNames: Set<string>
  onAdd: (rule: Omit<PresetSwitcherRule, 'id'>) => void
  onCancel: () => void
  onRefresh: () => void
}): JSX.Element {
  const [app, setApp] = useState('')
  const [channel, setChannel] = useState('')
  const [presetId, setPresetId] = useState('')

  const availableApps = openApps.filter((a) => !existingProcessNames.has(a.processName))
  const favorites = channel ? getFavoritesForChannel(configs, channel) : []
  const canAdd = app && channel && presetId

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select
            compact
            ariaLabel="Application"
            value={app}
            placeholder="Application"
            onChange={setApp}
            options={availableApps.map((a) => ({ value: a.processName, label: a.displayName }))}
          />
        </div>
        <button onClick={onRefresh} aria-label="Refresh apps" style={iconBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
      <Select
        compact
        ariaLabel="Channel"
        value={channel}
        placeholder="Channel"
        disabled={!app}
        onChange={(v) => { setChannel(v); setPresetId('') }}
        options={DEVICE_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
      />
      <Select
        compact
        ariaLabel="Preset"
        value={presetId}
        placeholder="Preset"
        disabled={!channel || favorites.length === 0}
        onChange={setPresetId}
        options={favorites.map((f) => ({ value: f.id, label: f.name }))}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={textBtnStyle('secondary')}>Cancel</button>
        <button
          onClick={() => {
            if (!canAdd) return
            const display = availableApps.find((a) => a.processName === app)?.displayName ?? app
            onAdd({ appProcessName: app, displayName: display, channel, presetId, enabled: true })
          }}
          disabled={!canAdd}
          style={{ ...textBtnStyle('primary'), opacity: canAdd ? 1 : 0.5 }}
        >
          Add rule
        </button>
      </div>
    </div>
  )
}

// ── Small shared inline controls ────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <div
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: checked ? 'var(--segment-active-bg)' : 'var(--color-border)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 150ms',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--segment-active-color)',
          transition: 'left 150ms',
        }}
      />
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

function textBtnStyle(kind: 'primary' | 'secondary'): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: kind === 'primary' ? 'var(--segment-active-bg)' : 'var(--color-surface)',
    color: kind === 'primary' ? 'var(--segment-active-color)' : 'var(--color-text-primary)',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }
}
