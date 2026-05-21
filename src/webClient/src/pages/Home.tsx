import { useServiceStore } from '../stores/serviceStore'
import { useSonarStore, sonarSetVolume, sonarSetMute, sonarSelectPreset } from '../stores/sonarStore'
import { post } from '../api/http'
import type { ArctisState, SonarChannel, SonarConfig, DdcMonitor } from '@shared/types'
import { DDC_INPUT_NAMES } from '@shared/types'

const CHANNEL_ORDER: SonarChannel[] = ['master', 'game', 'media', 'chatRender', 'chatCapture']
const CHANNEL_LABELS: Record<SonarChannel, string> = {
  master: 'Master',
  game: 'Game',
  media: 'Media',
  chatRender: 'Chat',
  chatCapture: 'Mic',
  aux: 'Aux',
}
// Map SonarChannel to the virtualAudioDevice key used in configs
const CHANNEL_TO_DEVICE: Record<SonarChannel, string> = {
  master: 'master',
  game: 'game',
  media: 'media',
  chatRender: 'chatRender',
  chatCapture: 'chatCapture',
  aux: 'aux',
}

export function Home(): JSX.Element {
  const arctis = useServiceStore((s) => s.arctisState)
  const ddcMonitors = useServiceStore((s) => s.ddcMonitors)
  const sonarState = useSonarStore((s) => s.sonarState)
  const activePresetIds = useSonarStore((s) => s.activePresetIds)
  const { beginDrag, endDrag } = useSonarStore()

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        Home
      </h1>

      {/* ── Arctis card ── */}
      <Card title="Arctis Nova Pro">
        {arctis ? (
          <ArctisCard arctis={arctis} />
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Not connected</span>
        )}
      </Card>

      {/* ── Sonar card ── */}
      <Card title="GG Sonar">
        {sonarState?.available ? (
          <SonarCard
            sonarState={sonarState}
            activePresetIds={activePresetIds}
            beginDrag={beginDrag}
            endDrag={endDrag}
          />
        ) : (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Not available</span>
        )}
      </Card>

      {/* ── Display cards ── */}
      {ddcMonitors.length > 0 && (
        <>
          {[...ddcMonitors]
            .sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1))
            .map((m) => (
              <Card key={m.monitor_id} title={m.name}>
                <DisplayCard monitor={m} />
              </Card>
            ))}
        </>
      )}
    </div>
  )
}

// ── Arctis card internals ─────────────────────────────────────────────────────

function ArctisCard({ arctis }: { arctis: ArctisState }): JSX.Element {
  const updateArctis = useServiceStore((s) => s.updateArctisState)

  async function sendCmd(cmd: string, value: unknown): Promise<void> {
    await post('/api/arctis/cmd', { cmd, value })
  }

  const btColor =
    arctis.btStatus === 'CONNECTED' ? 'var(--color-ok)'
    : arctis.btStatus === 'PAIRING' ? 'var(--color-warn)'
    : 'var(--color-text-secondary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header: battery + status dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <BatterySegments value={arctis.batteryHeadset} />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {Math.round(arctis.batteryHeadset)}%
        </span>
        {arctis.batteryDock > 0 && (
          <>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Dock</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
              {Math.round(arctis.batteryDock)}%
            </span>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
          <StatusDot color={arctis.wirelessConnected ? 'var(--color-ok)' : 'var(--color-text-secondary)'} title="2.4 GHz" />
          <StatusDot color={btColor} title={`BT: ${arctis.btStatus}`} />
          <StatusDot
            color={arctis.headsetPowered === true ? 'var(--color-ok)' : 'var(--color-text-secondary)'}
            title="Power"
          />
        </div>
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={arctis.volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            updateArctis({ volume: v })
            void sendCmd('setVolume', v)
          }}
          style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-primary)', minWidth: 32, textAlign: 'right' }}>
          {Math.round(arctis.volume)}%
        </span>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Chip label={`ANC: ${formatAnc(arctis)}`} />
        <Chip label={`Sidetone: ${capitalize(arctis.sidetone)}`} />
        {arctis.chatmixEnabled && (
          <Chip label={`ChatMix: G${arctis.chatmixGame} / C${arctis.chatmixChat}`} />
        )}
        <Chip
          label={`Mic: ${arctis.micMuted ? 'Muted' : 'Active'}`}
          color={arctis.micMuted ? 'var(--color-warn)' : undefined}
        />
      </div>
    </div>
  )
}

// ── Sonar card internals ──────────────────────────────────────────────────────

function SonarCard({
  sonarState,
  activePresetIds,
  beginDrag,
  endDrag,
}: {
  sonarState: NonNullable<ReturnType<typeof useSonarStore.getState>['sonarState']>
  activePresetIds: Record<string, string>
  beginDrag: () => void
  endDrag: () => void
}): JSX.Element {
  const classic = sonarState.classic
  const configs = sonarState.configs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header: mode chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusDot color="var(--color-ok)" title="Active" />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {sonarState.mode === 'classic' ? 'Classic' : 'Streamer'}
        </span>
      </div>

      {/* Channel rows */}
      {classic && CHANNEL_ORDER.map((ch) => {
        const vol = ch === 'master'
          ? classic.masters.classic
          : classic.devices[ch as keyof typeof classic.devices]?.classic
        if (!vol) return null

        const device = CHANNEL_TO_DEVICE[ch]
        const favorites = getFavoritesForChannel(configs, device)
        const activeId = activePresetIds[device] ?? configs.find(c => c.virtualAudioDevice === device && c.isSelected)?.id

        return (
          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 48 }}>
              {CHANNEL_LABELS[ch]}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(vol.volume * 100)}
              onChange={(e) => void sonarSetVolume(ch, Number(e.target.value) / 100)}
              onMouseDown={beginDrag}
              onTouchStart={beginDrag}
              onMouseUp={endDrag}
              onTouchEnd={endDrag}
              style={{
                flex: 1,
                accentColor: vol.muted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                cursor: 'pointer',
                opacity: vol.muted ? 0.5 : 1,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 32, textAlign: 'right' }}>
              {Math.round(vol.volume * 100)}%
            </span>
            <button
              onClick={() => void sonarSetMute(ch, !vol.muted)}
              title={vol.muted ? 'Unmute' : 'Mute'}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: vol.muted ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                color: vol.muted ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              M
            </button>
            {favorites.length > 0 && (
              <select
                value={activeId ?? ''}
                onChange={(e) => void sonarSelectPreset(e.target.value, device)}
                style={{
                  fontSize: 10,
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  maxWidth: 80,
                }}
              >
                <option value="" disabled>Preset</option>
                {favorites.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Display card internals ────────────────────────────────────────────────────

function DisplayCard({ monitor }: { monitor: DdcMonitor }): JSX.Element {
  const supportsInput = monitor.supports.includes('input_source') && monitor.available_inputs.length > 0
  const supportsBrightness = monitor.supports.includes('brightness')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {monitor.is_primary && (
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Primary</span>
      )}
      {supportsBrightness && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 72 }}>Brightness</span>
          <input
            type="range"
            min={0}
            max={100}
            value={monitor.brightness}
            onChange={(e) => {
              void post('/api/ddc/brightness', { monitorId: monitor.monitor_id, brightness: Number(e.target.value) })
            }}
            style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-primary)', minWidth: 32, textAlign: 'right' }}>
            {monitor.brightness}%
          </span>
        </div>
      )}
      {supportsInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 72 }}>Input</span>
          <select
            value={monitor.input_source}
            onChange={(e) => {
              void post('/api/ddc/input', { monitorId: monitor.monitor_id, input: e.target.value })
            }}
            style={{
              flex: 1,
              fontSize: 12,
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '3px 6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {monitor.available_inputs.map((inp) => (
              <option key={inp} value={inp}>
                {DDC_INPUT_NAMES[inp] ?? inp}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function getFavoritesForChannel(configs: SonarConfig[], device: string): SonarConfig[] {
  return configs
    .filter((c) => c.virtualAudioDevice === device && c.isFavorite)
    .sort((a, b) => (a.favoritePosition ?? 0) - (b.favoritePosition ?? 0))
}

function formatAnc(arctis: ArctisState): string {
  if (arctis.ancMode === 'TRANSPARENCY') return `Transparency ${arctis.transparencyLevel}`
  return arctis.ancMode === 'ANC' ? 'ANC' : 'Off'
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

// ── Reusable primitives ───────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function BatterySegments({ value }: { value: number }): JSX.Element {
  const segments = 4
  const filled = Math.round((value / 100) * segments)
  const color = value > 20 ? 'var(--color-ok)' : 'var(--color-warn)'
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 14,
            borderRadius: 2,
            border: '1px solid var(--color-border)',
            background: i < filled ? color : 'var(--color-surface-raised)',
          }}
        />
      ))}
    </div>
  )
}

function StatusDot({ color, title }: { color: string; title: string }): JSX.Element {
  return (
    <div
      title={title}
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

function Chip({ label, color }: { label: string; color?: string }): JSX.Element {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 7px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-raised)',
        color: color ?? 'var(--color-text-secondary)',
      }}
    >
      {label}
    </span>
  )
}
