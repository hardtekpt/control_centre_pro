import type {
  SonarState,
  SonarChannel,
  SonarDeviceChannel,
  SonarMode,
  SonarConfig,
  SonarPollingConfig,
  SonarAudioSample,
} from '../../shared/types'
import type { ServiceManager } from './serviceManager'

// ─── SonarService ─────────────────────────────────────────────────────────────

const EMPTY_STATE: SonarState = {
  available: false,
  mode: 'classic',
  classic: null,
  streamer: null,
  configs: [],
  routing: [],
  chatMix: null,
  audioDevices: [],
  redirections: {},
  deviceOut: null,
  linkAllEnabled: false,
}

/**
 * Thin facade over the `gg-sonar` Python subprocess (resources/services/sonar_service.py,
 * which wraps the `steelseries_gg` package). Preserves the exact public API that
 * the rest of the main process depends on — IPC handlers, shortcut dispatcher,
 * preset auto-switcher, and the remote HTTP server all hold a SonarService and
 * call these synchronously/awaitably — so swapping the Node HTTP client for a
 * Python service required no changes to those consumers.
 *
 * State arrives via ServiceManager (which caches `lastSonarState` from the
 * subprocess's `{type:'state'}` messages and pushes it to the renderer + web
 * clients). Writes/queries go out over the subprocess stdin with a correlated
 * response (ServiceManager.sendCommand).
 */
export class SonarService {
  // Polling interval is non-persisted (parity with the old service); cached here
  // for the synchronous getter and forwarded to the subprocess.
  private pollingConfig: SonarPollingConfig = { pollingIntervalMs: 1000 }

  constructor(private readonly services: ServiceManager) {}

  getState(): SonarState {
    return this.services.getSonarState() ?? EMPTY_STATE
  }

  isAvailable(): boolean {
    return this.getState().available
  }

  getPollingConfig(): SonarPollingConfig {
    return { ...this.pollingConfig }
  }

  setPollingConfig(config: SonarPollingConfig): void {
    this.pollingConfig = { ...config }
    void this.services.sendCommand('gg-sonar', 'setPollingConfig', config).catch(() => {})
  }

  // ── Write / query commands ────────────────────────────────────────────────────

  async setVolume(channel: SonarChannel, value: number): Promise<void> {
    await this.send('setVolume', { channel, value })
  }

  async setMute(channel: SonarChannel, muted: boolean): Promise<void> {
    await this.send('setMute', { channel, muted })
  }

  async selectPreset(id: string): Promise<void> {
    await this.send('selectPreset', { id })
  }

  async setMode(mode: SonarMode): Promise<void> {
    await this.send('setMode', { mode })
  }

  async setRedirection(channel: SonarDeviceChannel, deviceId: string): Promise<void> {
    await this.send('setRedirection', { channel, deviceId })
  }

  async routeProcess(processId: number, targetChannel: string): Promise<void> {
    await this.send('routeProcess', { processId, targetChannel })
  }

  async refreshDevices(): Promise<void> {
    await this.send('refreshDevices', {})
  }

  async upsertConfig(config: SonarConfig): Promise<SonarConfig> {
    return (await this.send('upsertConfig', config)) as SonarConfig
  }

  async deleteConfig(id: string): Promise<void> {
    await this.send('deleteConfig', { id })
  }

  async duplicateConfig(sourceId: string): Promise<SonarConfig> {
    return (await this.send('duplicateConfig', { sourceId })) as SonarConfig
  }

  async resetConfig(id: string): Promise<SonarConfig> {
    return (await this.send('resetConfig', { id })) as SonarConfig
  }

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    await this.send('toggleFavorite', { id, isFavorite })
  }

  async getAudioSamples(role: string): Promise<SonarAudioSample[]> {
    return (await this.send('getAudioSamples', { role })) as SonarAudioSample[]
  }

  async playAudioSample(role: string, id: string): Promise<SonarAudioSample[]> {
    return (await this.send('playAudioSample', { role, id })) as SonarAudioSample[]
  }

  private send(cmd: string, value: unknown): Promise<unknown> {
    return this.services.sendCommand('gg-sonar', cmd, value)
  }
}
