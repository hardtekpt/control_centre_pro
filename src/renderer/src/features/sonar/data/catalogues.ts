export type SonarApiPresetId = 'music' | 'game' | 'studio' | 'cinema' | 'speech' | 'flat'

// Backward-compat alias — older code may import this name
export type StaticPresetId = SonarApiPresetId

// Human-readable labels for the 6 built-in GG Sonar API presets
export const SONAR_API_PRESET_LABELS: Record<SonarApiPresetId, string> = {
  music:  'Music',
  game:   'Game',
  studio: 'Studio',
  cinema: 'Cinema',
  speech: 'Speech',
  flat:   'Flat',
}

/** Map an API config name (e.g. "Music", "GAME") to the canonical SonarApiPresetId. */
export function configNameToPresetId(name: string): SonarApiPresetId | undefined {
  const lower = name.toLowerCase()
  if (lower === 'music' || lower === 'game' || lower === 'studio' ||
      lower === 'cinema' || lower === 'speech' || lower === 'flat') {
    return lower as SonarApiPresetId
  }
  return undefined
}

export const SONAR_API_PRESET_DEFAULTS: Record<SonarApiPresetId, { label: string; sub: string }> = {
  music:  { label: 'Music',  sub: 'studio master'     },
  game:   { label: 'Game',   sub: 'wide · positional'  },
  studio: { label: 'Studio', sub: 'flat reference'    },
  cinema: { label: 'Cinema', sub: 'film · spatial'    },
  speech: { label: 'Speech', sub: 'voice clarity'     },
  flat:   { label: 'Flat',   sub: 'bypass'            },
}

/** A chip in the preset chips row — fully user-configured */
export interface UserPresetChip {
  /** Stable unique key */
  uid: string
  /** Which GG Sonar API preset this chip selects */
  sonarPresetId: SonarApiPresetId
  /** Display label shown on the chip */
  label: string
  /** Sub-label shown below the label */
  sub: string
  /** Which icon to display (can differ from sonarPresetId) */
  iconKey: SonarApiPresetId
}

export const DEFAULT_PRESET_CHIPS: UserPresetChip[] = [
  { uid: 'default-music',  sonarPresetId: 'music',  label: 'Music',  sub: 'studio master',     iconKey: 'music'  },
  { uid: 'default-game',   sonarPresetId: 'game',   label: 'Game',   sub: 'wide · positional',  iconKey: 'game'   },
  { uid: 'default-studio', sonarPresetId: 'studio', label: 'Studio', sub: 'flat reference',    iconKey: 'studio' },
  { uid: 'default-cinema', sonarPresetId: 'cinema', label: 'Cinema', sub: 'film · spatial',    iconKey: 'cinema' },
  { uid: 'default-speech', sonarPresetId: 'speech', label: 'Speech', sub: 'voice clarity',     iconKey: 'speech' },
  { uid: 'default-flat',   sonarPresetId: 'flat',   label: 'Flat',   sub: 'bypass',            iconKey: 'flat'   },
]

export const CHANNEL_LABELS: Record<string, string> = {
  master:      'Master',
  game:        'Game',
  chatRender:  'Chat',
  chatCapture: 'Mic',
  media:       'Media',
  aux:         'Aux',
}

/** Convert linear volume 0-100 → dB readout string */
export function dbFor(level: number): string {
  if (level <= 0) return '-∞'
  const v = (level - 100) * 0.4
  if (v <= -60) return '-∞'
  return v.toFixed(1)
}

/** Deterministic muted accent color for an app from its process name */
const ACCENTS = [
  '#c8a86e', '#b8635c', '#b07852', '#7e85b8', '#6671a8',
  '#7ca37e', '#ba8851', '#ad6660', '#5c7790', '#7a7a7a',
  '#9b7db0', '#6e9e8a', '#a87a5c', '#8a7eb0', '#6e8e9b',
]

export function accentFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return ACCENTS[hash % ACCENTS.length]
}

/** 2-character monogram from a display name */
export function monogramFor(name: string): string {
  const clean = name.replace(/\.(exe|app)$/i, '').trim()
  const words = clean.split(/[\s_\-\.]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}
