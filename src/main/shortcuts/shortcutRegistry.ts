import { globalShortcut } from 'electron'
import type { Shortcut } from '../../shared/types'
import { toAccelerator } from './accelerator'
import { dispatch } from './dispatcher'

export function registerGlobalShortcuts(shortcuts: Shortcut[]): void {
  globalShortcut.unregisterAll()

  for (const s of shortcuts) {
    if (!s.enabled || s.scope !== 'global' || s.keys.length === 0) continue

    const accelerator = toAccelerator(s.keys)
    try {
      const ok = globalShortcut.register(accelerator, () => {
        void dispatch(s.actionId, s.value)
      })
      if (!ok) {
        console.warn(`[shortcuts] failed to register global shortcut: ${accelerator} (OS conflict)`)
      }
    } catch (err) {
      console.warn(`[shortcuts] error registering ${accelerator}:`, err)
    }
  }
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
}
