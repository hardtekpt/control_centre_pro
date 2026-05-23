import { useEffect, useRef, useState } from 'react'
import { useSonarStore } from '../../stores/sonarStore'
import { useSettingsForm } from '../../contexts/settingsFormContext'
import { PageHeader, SettingSection, SettingRow, ToggleSetting, SettingsPageWrapper } from '../../components/SettingsComponents'
import type { SonarChannel, SonarMode, SonarPollingConfig } from '@shared/types'
import { SONAR_CHANNELS } from '@shared/types'
import type { UserPresetChip } from '../../features/sonar/data/catalogues'
import { PresetChipsList } from './PresetChipsList'

const CHANNEL_DEFS: { channel: SonarChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'game', label: 'Game' },
  { channel: 'media', label: 'Media' },
  { channel: 'chatRender', label: 'Chat' },
  { channel: 'chatCapture', label: 'Mic' },
  { channel: 'aux', label: 'Aux' },
]

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export function GGSonarSettings(): JSX.Element {
  const { sonarState, visibleChannels, setChannelVisibility, presetChips, setPresetChips } = useSonarStore()
  const { setDirty, registerSave } = useSettingsForm()

  // ── Polling config ───────────────────────────────────────────────────────────
  const [savedPollingConfig, setSavedPollingConfig] = useState<SonarPollingConfig | null>(null)
  const [draftPollingInterval, setDraftPollingInterval] = useState('')

  // ── Visible channels ─────────────────────────────────────────────────────────
  const [draftVisibleChannels, setDraftVisibleChannels] = useState(() => new Set(visibleChannels))

  // ── Preset chips ─────────────────────────────────────────────────────────────
  const [draftChips, setDraftChips] = useState<UserPresetChip[]>(() => presetChips)

  // ── Preset switcher enabled ──────────────────────────────────────────────────
  // Start as null to avoid rendering with wrong value before fetch completes
  const [savedPresetSwitcherEnabled, setSavedPresetSwitcherEnabled] = useState<boolean | null>(null)
  const [draftPresetSwitcherEnabled, setDraftPresetSwitcherEnabled] = useState<boolean | null>(null)

  // Refs mirror every draft value so the save handler always reads the latest
  // state even if registered before the most recent state update's effect fired.
  const draftPollingIntervalRef = useRef(draftPollingInterval)
  const draftVisibleChannelsRef = useRef(draftVisibleChannels)
  const draftChipsRef = useRef(draftChips)
  const draftPresetSwitcherEnabledRef = useRef(draftPresetSwitcherEnabled)

  useEffect(() => { draftPollingIntervalRef.current = draftPollingInterval }, [draftPollingInterval])
  useEffect(() => { draftVisibleChannelsRef.current = draftVisibleChannels }, [draftVisibleChannels])
  useEffect(() => { draftChipsRef.current = draftChips }, [draftChips])
  useEffect(() => { draftPresetSwitcherEnabledRef.current = draftPresetSwitcherEnabled }, [draftPresetSwitcherEnabled])

  useEffect(() => {
    window.api.sonarGetPollingConfig()
      .then((config) => {
        setSavedPollingConfig(config)
        setDraftPollingInterval(config.pollingIntervalMs.toString())
      })
      .catch(console.error)

    window.api.getPresetSwitcherEnabled()
      .then((enabled) => {
        setSavedPresetSwitcherEnabled(enabled)
        setDraftPresetSwitcherEnabled(enabled)
      })
      .catch(console.error)
  }, [])

  // ── Dirty detection ──────────────────────────────────────────────────────────
  const pollingDirty = savedPollingConfig !== null && (
    draftPollingInterval !== savedPollingConfig.pollingIntervalMs.toString()
  )
  const channelsDirty = !setsEqual(draftVisibleChannels, visibleChannels)
  const chipsDirty = JSON.stringify(draftChips) !== JSON.stringify(presetChips)
  const presetSwitcherDirty = savedPresetSwitcherEnabled !== null && draftPresetSwitcherEnabled !== savedPresetSwitcherEnabled

  useEffect(() => {
    setDirty(pollingDirty || channelsDirty || chipsDirty || presetSwitcherDirty)
  }, [pollingDirty, channelsDirty, chipsDirty, presetSwitcherDirty, setDirty])

  // ── Register save handler (once — reads latest values via refs) ───────────────
  useEffect(() => {
    registerSave(async () => {
      // Preset switcher — save first so it's never skipped by an error below
      const psEnabled = draftPresetSwitcherEnabledRef.current
      if (psEnabled !== null) {
        await window.api.setPresetSwitcherEnabled(psEnabled)
        setSavedPresetSwitcherEnabled(psEnabled)
        setDraftPresetSwitcherEnabled(psEnabled)
      }

      // Polling config
      const pollingMs = Math.max(100, parseInt(draftPollingIntervalRef.current, 10) || 1000)
      const newConfig: SonarPollingConfig = { pollingIntervalMs: pollingMs }
      await window.api.sonarSetPollingConfig(newConfig)
      setSavedPollingConfig(newConfig)
      setDraftPollingInterval(pollingMs.toString())

      // Visible channels (persisted via Zustand localStorage middleware)
      const channels = draftVisibleChannelsRef.current
      for (const ch of SONAR_CHANNELS) {
        setChannelVisibility(ch, channels.has(ch))
      }

      // Preset chips (persisted via Zustand localStorage middleware)
      setPresetChips(draftChipsRef.current)
    })
    return () => registerSave(null)
  }, [registerSave, setChannelVisibility, setPresetChips])

  function handleToggleChannel(channel: SonarChannel): void {
    setDraftVisibleChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) next.delete(channel)
      else next.add(channel)
      return next
    })
  }

  function handleTogglePresetSwitcher(): void {
    const next = !draftPresetSwitcherEnabledRef.current
    draftPresetSwitcherEnabledRef.current = next
    setDraftPresetSwitcherEnabled(next)
  }

  // Mixer mode is live audio state — applied immediately, not deferred
  function handleModeChange(mode: SonarMode): void {
    window.api.sonarSetMode(mode).catch(console.error)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="GG Sonar" description="Audio mixer mode, channel visibility, and preset switching configuration" />
      <div className="flex-1 overflow-y-auto">
        <SettingsPageWrapper>
          <SettingSection title="Mixer Mode">
        {sonarState && (
          <div className="px-5 py-3.5">
            <div className="segment-group w-fit">
              {(['classic', 'streamer'] as SonarMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`segment-btn px-4 py-2 capitalize font-medium${sonarState.mode === m ? ' active' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </SettingSection>

      <SettingSection title="Visible Channels">
        <div className="grid grid-cols-2 gap-0">
          {CHANNEL_DEFS.map(({ channel, label }, idx, arr) => (
            <SettingRow
              key={channel}
              label={label}
              last={idx === arr.length - 1}
            >
              <ToggleSetting
                checked={draftVisibleChannels.has(channel)}
                onChange={() => handleToggleChannel(channel)}
              />
            </SettingRow>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Preset Chips">
        <PresetChipsList chips={draftChips} onChange={setDraftChips} />
      </SettingSection>

      {savedPresetSwitcherEnabled !== null && draftPresetSwitcherEnabled !== null && (
        <SettingSection title="Preset Switcher">
          <SettingRow
            label="Enable Automatic Preset Switching"
            description="Automatically switch presets based on active window"
            last
          >
            <ToggleSetting
              checked={draftPresetSwitcherEnabled}
              onChange={handleTogglePresetSwitcher}
            />
          </SettingRow>
        </SettingSection>
      )}

      <SettingSection title="State Polling">
        <SettingRow
          label="Polling Interval"
          description="Updates all state: mode, volumes, presets, routing, and devices"
          stacked
          last
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="100"
              step="100"
              value={draftPollingInterval}
              onChange={(e) => setDraftPollingInterval(e.target.value)}
              className="px-3 py-2 rounded text-sm font-mono"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
              }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>ms</span>
          </div>
        </SettingRow>
      </SettingSection>
        </SettingsPageWrapper>
      </div>
    </div>
  )
}
