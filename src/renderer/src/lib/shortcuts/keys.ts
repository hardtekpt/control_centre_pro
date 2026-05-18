// ─── Key normalisation ────────────────────────────────────────────────────────

function keyTokenFromEvent(e: KeyboardEvent): string | null {
  const k = e.key
  if (k === 'Control' || k === 'Alt' || k === 'Shift' || k === 'Meta') return null
  if (k === ' ')          return 'Space'
  if (k === 'ArrowUp')    return '↑'
  if (k === 'ArrowDown')  return '↓'
  if (k === 'ArrowLeft')  return '←'
  if (k === 'ArrowRight') return '→'
  if (k === 'Escape')     return 'Esc'
  if (k === 'Enter')      return 'Enter'
  if (k === 'Tab')        return 'Tab'
  if (k === 'Backspace')  return 'Backspace'
  if (k === 'Delete')     return 'Del'
  if (/^F\d{1,2}$/.test(k)) return k
  if (k.length === 1) return k.toUpperCase()
  return k
}

/**
 * Build a key combo from a KeyboardEvent.
 * Returns null when the event is a pure modifier press (no base key yet).
 * Bare letter/number keys with no modifier are rejected unless the base is a
 * function key — prevents binding 'A' and breaking text input.
 */
export function combinationFromEvent(e: KeyboardEvent): string[] | null {
  const mods: string[] = []
  if (e.ctrlKey)  mods.push('Ctrl')
  if (e.altKey)   mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey)  mods.push('Meta')

  const base = keyTokenFromEvent(e)
  if (!base) return null

  // Bare key (no modifier) allowed only for function keys
  if (mods.length === 0 && !/^F\d{1,2}$/.test(base)) return null

  return [...mods, base]
}

export function formatCombo(keys: string[]): string {
  return keys.join(' + ')
}

export function combosEqual(a: string[], b: string[]): boolean {
  if (!a || !b || a.length !== b.length) return false
  return a.every((k, i) => k === b[i])
}
