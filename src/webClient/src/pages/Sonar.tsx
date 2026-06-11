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
import { LightningIcon, MuteIcon, EditIcon, TrashIcon, RefreshIcon, PlusIcon } from '../components/icons'
import { PageHeader, Field, Toggle, IconButton, Button, Chip, text, space } from '../theme'
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
      <div className="page">
        <PageHeader title="GG Sonar" />
        <p style={text.bodyMuted}>GG Sonar not available</p>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="GG Sonar" />
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
                minWidth: 48,
              }}
            >
              <span style={text.caption}>{CHANNEL_LABELS[ch]}</span>
              <VerticalFader
                value={vol.volume}
                muted={vol.muted}
                onChange={(v) => void sonarSetVolume(ch, v)}
                onDragStart={beginDrag}
                onDragEnd={endDrag}
              />
              <span style={text.value}>{Math.round(vol.volume * 100)}%</span>
              <IconButton
                active={vol.muted}
                title={vol.muted ? 'Unmute' : 'Mute'}
                ariaLabel={`${CHANNEL_LABELS[ch]} ${vol.muted ? 'unmute' : 'mute'}`}
                onClick={() => void sonarSetMute(ch, !vol.muted)}
              >
                <MuteIcon muted={vol.muted} size={15} />
              </IconButton>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Card 2: per-channel settings (preset · output · routed apps) ────────────────

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
            <div key={ch} style={{ display: 'flex', flexDirection: 'column', gap: space.fieldGap }}>
              <span style={text.subtitle}>{CHANNEL_LABELS[ch]}</span>

              {favorites.length > 0 && (
                <Field label="Preset">
                  <Select
                    compact
                    ariaLabel={`${CHANNEL_LABELS[ch]} preset`}
                    value={activeId ?? ''}
                    placeholder="Preset"
                    onChange={(v) => void sonarSelectPreset(v, ch)}
                    options={favorites.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </Field>
              )}

              {sonarState.audioDevices.length > 0 && (
                <Field label="Output">
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
                </Field>
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
    <Field label="Apps" align="start">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sessions.length === 0 && (
          <span style={{ ...text.caption, fontSize: 12, color: 'var(--color-text-tertiary)', paddingTop: 4 }}>No apps</span>
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
    </Field>
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
        <span style={{ ...text.sectionLabel, letterSpacing: '0.05em', padding: '4px 8px' }}>
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
          <Chip
            label={enabled ? 'AUTO ON' : 'AUTO OFF'}
            color={enabled ? 'var(--color-ok)' : undefined}
            background={enabled ? 'var(--color-accent-subtle)' : undefined}
          />
          <Toggle checked={enabled} onChange={(v) => void setEnabled(v)} />
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.rowGap }}>
        {/* Active app */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LightningIcon color="var(--color-text-secondary)" size={13} />
          <span style={{ ...text.caption, fontSize: 12 }}>
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
            <span style={{ ...text.caption, fontSize: 12, color: 'var(--color-text-tertiary)' }}>No rules yet</span>
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
          <Button
            variant="ghost"
            disabled={rules.length >= 10}
            onClick={openAddForm}
            style={{ alignSelf: 'flex-start' }}
          >
            <PlusIcon size={12} />
            {rules.length >= 10 ? 'Limit reached' : 'Add rule'}
          </Button>
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
        gap: space.fieldGap,
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${isActive ? 'var(--color-ok)' : 'var(--color-border)'}`,
        background: 'var(--color-surface-raised)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space.fieldGap }}>
        <span style={{ ...text.body, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rule.displayName}
        </span>
        <span style={{ ...text.caption, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {channel ? `${CHANNEL_LABELS[channel as SonarChannel] ?? channel} · ${presetName}` : '—'}
        </span>
        <IconButton ariaLabel="Edit rule" onClick={() => setEditing((e) => !e)} style={{ background: 'var(--color-surface)' }}>
          <EditIcon size={14} />
        </IconButton>
        <IconButton ariaLabel="Delete rule" onClick={onRemove} style={{ background: 'var(--color-surface)' }}>
          <TrashIcon size={14} />
        </IconButton>
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
        gap: space.fieldGap,
        padding: 10,
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <div style={{ display: 'flex', gap: space.fieldGap, alignItems: 'center' }}>
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
        <IconButton ariaLabel="Refresh apps" onClick={onRefresh} style={{ background: 'var(--color-surface)' }}>
          <RefreshIcon size={14} />
        </IconButton>
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
      <div style={{ display: 'flex', gap: space.fieldGap, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) return
            const display = availableApps.find((a) => a.processName === app)?.displayName ?? app
            onAdd({ appProcessName: app, displayName: display, channel, presetId, enabled: true })
          }}
        >
          Add rule
        </Button>
      </div>
    </div>
  )
}
