import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import type { PresetSwitcherRule, OpenApp } from '../../shared/types'

/**
 * Shared persistence + query helpers for the Preset Switcher feature.
 *
 * Both the IPC handlers (desktop renderer) and the HttpApiServer (remote web
 * client) read/write the same `preset-switcher.json` and query the same list of
 * open apps, so the logic lives here to avoid divergence.
 *
 * The on-disk format is an object `{ rules: PresetSwitcherRule[]; enabled: boolean }`,
 * but a legacy bare-array format is still tolerated on read.
 */

function rulesPath(): string {
  return join(app.getPath('userData'), 'preset-switcher.json')
}

export function readRules(): PresetSwitcherRule[] {
  try {
    const path = rulesPath()
    if (!existsSync(path)) return []
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return (Array.isArray(parsed) ? parsed : parsed.rules || []) as PresetSwitcherRule[]
  } catch (err) {
    console.error('[presetSwitcherStore] readRules error:', err)
    return []
  }
}

export function writeRules(rules: PresetSwitcherRule[]): void {
  const path = rulesPath()
  let data: Record<string, unknown> = {}
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    // Old array format → preserve default enabled state; new object format → keep as-is
    data = Array.isArray(parsed) ? { enabled: true } : (parsed as Record<string, unknown>)
  }
  data.rules = rules
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

export function readEnabled(): boolean {
  try {
    const path = rulesPath()
    if (!existsSync(path)) return true
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    if (Array.isArray(parsed)) return true // old format defaults to enabled
    return (parsed as Record<string, unknown>).enabled !== false
  } catch (err) {
    console.error('[presetSwitcherStore] readEnabled error:', err)
    return true
  }
}

export function writeEnabled(enabled: boolean): void {
  const path = rulesPath()
  const parsed = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {}
  let data: Record<string, unknown>
  if (Array.isArray(parsed)) {
    data = { rules: parsed, enabled }
  } else {
    data = parsed as Record<string, unknown>
    data.enabled = enabled
  }
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

/** Enumerate user-facing open apps (processes with a visible main window). */
export function getOpenApps(): OpenApp[] {
  try {
    const script = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -Unique Name, MainWindowTitle | ConvertTo-Json`
    const result = execSync(`powershell -NoProfile -Command "${script}"`, { encoding: 'utf-8' })
    const procs = JSON.parse(result) as Array<{ Name: string; MainWindowTitle: string }>
    return (Array.isArray(procs) ? procs : [procs])
      .map((p) => ({ processName: p.Name, displayName: p.Name }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  } catch (err) {
    console.error('[presetSwitcherStore] getOpenApps error:', err)
    return []
  }
}
