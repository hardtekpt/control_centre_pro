import type { PluginStatus } from '@shared/types'

const STATUS_PRESENT: Record<PluginStatus, { label: string; dot: string }> = {
  'connected': { label: 'Connected', dot: 'connected' },
  'error': { label: 'Error', dot: 'error' },
  'disabled': { label: 'Disabled', dot: 'disabled' },
  'installed': { label: 'Not connected', dot: 'installed' },
  'not-installed': { label: 'Not installed', dot: 'not-installed' },
}

export function StatusPill({ status, label }: { status: PluginStatus; label?: string }): JSX.Element {
  const preset = STATUS_PRESENT[status]
  return (
    <span className="status">
      <span className={`status-dot ${preset.dot}`} />
      <span>{label ?? preset.label}</span>
    </span>
  )
}
