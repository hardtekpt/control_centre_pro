const TOKEN_MAP: Record<string, string> = {
  Ctrl:  'CommandOrControl',
  Alt:   'Alt',
  Shift: 'Shift',
  Meta:  'Super',
  Space: 'Space',
  '↑':   'Up',
  '↓':   'Down',
  '←':   'Left',
  '→':   'Right',
  Esc:   'Escape',
}

export function toAccelerator(keys: string[]): string {
  return keys.map((k) => TOKEN_MAP[k] ?? k).join('+')
}
