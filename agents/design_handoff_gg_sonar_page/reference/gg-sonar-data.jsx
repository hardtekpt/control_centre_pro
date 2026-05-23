// GG Sonar — data: channels, presets, apps, output devices, EQ curves.
//
// Apps use a 2-letter monogram + muted accent (no brand logos).

const CHANNELS = [
  { id: 'game',  label: 'Game',  Icon: SnGame,  takesApps: true  },
  { id: 'chat',  label: 'Chat',  Icon: SnChat,  takesApps: true  },
  { id: 'media', label: 'Media', Icon: SnMedia, takesApps: true  },
  { id: 'aux',   label: 'Aux',   Icon: SnAux,   takesApps: true  },
  { id: 'mic',   label: 'Mic',   Icon: SnMic,   takesApps: false },
];

const PRESETS = [
  { id: 'music',  label: 'Music',  Icon: SnPresetMusic,  sub: 'studio master' },
  { id: 'game',   label: 'Game',   Icon: SnPresetGame,   sub: 'wide · positional' },
  { id: 'studio', label: 'Studio', Icon: SnPresetStudio, sub: 'flat reference' },
  { id: 'cinema', label: 'Cinema', Icon: SnPresetCinema, sub: 'film · spatial' },
  { id: 'speech', label: 'Speech', Icon: SnPresetSpeech, sub: 'voice clarity' },
  { id: 'flat',   label: 'Flat',   Icon: SnPresetFlat,   sub: 'bypass' },
];

const PRESET_EQ = {
  music:  [0.55, 0.62, 0.55, 0.5, 0.55, 0.62, 0.68, 0.7,  0.65, 0.6],
  game:   [0.72, 0.66, 0.55, 0.45, 0.4, 0.42, 0.55, 0.68, 0.72, 0.7],
  studio: [0.5,  0.5,  0.5,  0.5,  0.5, 0.5,  0.5,  0.5,  0.5,  0.5],
  cinema: [0.78, 0.7,  0.6,  0.5,  0.42, 0.42, 0.5, 0.58, 0.7,  0.78],
  speech: [0.35, 0.4,  0.5,  0.65, 0.7,  0.7,  0.62, 0.5, 0.4,  0.35],
  flat:   [0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, 0.5,  0.5],
};

const PRESET_DESC = {
  music:  'Mastered for hi-fi listening. Wide stereo, full bass, slight high-end air.',
  game:   'Footsteps in the upper-mids. Boosted lows for explosions, scooped 1–2 kHz to keep dialogue clear.',
  studio: 'Flat reference. No correction applied — what your mix sounds like.',
  cinema: 'Smile curve for film. Strong lows and highs, slight midrange dip for cinematic body.',
  speech: 'Voice clarity. Boosts presence band (1–4 kHz), rolls off rumble and sibilance.',
  flat:   'Bypass. Sonar processing is disabled — audio passes through untouched.',
};

// Frequency band labels paired with PRESET_EQ index.
const PRESET_BANDS = ['60', '120', '250', '500', '1k', '2k', '4k', '8k', '12k', '16k'];

// Convert linear EQ value (0..1) → human-readable dB string in ±12 dB range.
function bandDbFor(v) {
  const db = (v - 0.5) * 24;
  const sign = db > 0.05 ? '+' : db < -0.05 ? '' : '±';
  return `${sign}${db.toFixed(1)}`;
}

// Per-preset properties — surfaced in the floating Preset details panel.
const PRESET_PROPS = {
  music: {
    spatial:    'Stereo',
    surround:   'Off',
    bassBoost:  '+0 dB',
    dynamics:   'Wide',
    headroom:   '-12 dB peak',
    use:        ['critical listening', 'mastered sources', 'hi-fi'],
  },
  game: {
    spatial:    'Surround',
    surround:   'DTS Headphone:X 2.0',
    bassBoost:  '+3 dB',
    dynamics:   'Compressed',
    headroom:   '-6 dB peak',
    use:        ['fps', 'positional cues', 'footsteps'],
  },
  studio: {
    spatial:    'Stereo',
    surround:   'Off',
    bassBoost:  '+0 dB',
    dynamics:   'Linear',
    headroom:   '-18 dB peak',
    use:        ['mixing', 'reference', 'A/B testing'],
  },
  cinema: {
    spatial:    'Surround',
    surround:   'DTS Headphone:X 2.0',
    bassBoost:  '+4 dB',
    dynamics:   'Wide',
    headroom:   '-9 dB peak',
    use:        ['film', 'streaming', 'spatial mixes'],
  },
  speech: {
    spatial:    'Mono-fold',
    surround:   'Off',
    bassBoost:  '-3 dB',
    dynamics:   'Compressed',
    headroom:   '-10 dB peak',
    use:        ['podcasts', 'calls', 'voice chat'],
  },
  flat: {
    spatial:    'Stereo',
    surround:   'Off',
    bassBoost:  '+0 dB',
    dynamics:   'Linear',
    headroom:   '-0 dB peak',
    use:        ['bypass', 'troubleshooting', 'A/B'],
  },
};

// Apps that can be routed to channels. Monograms, muted accents — original
// glyphs, no brand artwork.
const APPS = [
  { id: 'cs2',      name: 'Counter-Strike 2', monogram: 'CS', accent: '#c8a86e' },
  { id: 'valorant', name: 'Valorant',         monogram: 'VL', accent: '#b8635c' },
  { id: 'apex',     name: 'Apex Legends',     monogram: 'AX', accent: '#b07852' },
  { id: 'discord',  name: 'Discord',          monogram: 'DC', accent: '#7e85b8' },
  { id: 'teams',    name: 'Teams',            monogram: 'MT', accent: '#6671a8' },
  { id: 'spotify',  name: 'Spotify',          monogram: 'SP', accent: '#7ca37e' },
  { id: 'firefox',  name: 'Firefox',          monogram: 'FF', accent: '#ba8851' },
  { id: 'youtube',  name: 'YouTube',          monogram: 'YT', accent: '#ad6660' },
  { id: 'steam',    name: 'Steam',            monogram: 'ST', accent: '#5c7790' },
  { id: 'system',   name: 'System sounds',    monogram: 'SY', accent: '#7a7a7a' },
];

// Output devices any channel may route to.
const OUTPUTS = [
  { id: 'arctis',   name: 'Arctis Nova Pro', sub: 'usb · 48k · headphones',  Icon: SnHeadset },
  { id: 'monitors', name: 'Studio Monitors', sub: 'jack · 48k · speakers',   Icon: SnSpeaker },
  { id: 'stream',   name: 'Stream Mix',      sub: 'virtual · obs / twitch',  Icon: SnPulse },
  { id: 'system',   name: 'System default',  sub: 'whatever windows uses',   Icon: SnMonitor },
];

// Initial state
const INITIAL_LEVELS = {
  game:   { level: 78, muted: false, peak: 64 },
  chat:   { level: 62, muted: false, peak: 48 },
  media:  { level: 54, muted: false, peak: 38 },
  aux:    { level: 35, muted: true,  peak:  0 },
  mic:    { level: 70, muted: false, peak: 56 },
  master: { level: 82, muted: false, peak: 74 },
};

// Where each app is routed.
const INITIAL_ASSIGNMENTS = {
  cs2:      'game',
  valorant: 'game',
  apex:     'game',
  discord:  'chat',
  teams:    'chat',
  spotify:  'media',
  firefox:  'media',
  youtube:  'media',
  steam:    'aux',
  system:   'aux',
};

// Default output device per channel.
const INITIAL_OUTPUTS = {
  game:  'arctis',
  chat:  'arctis',
  media: 'arctis',
  aux:   'arctis',
  mic:   'stream',
};

// Auto-switch rules: when this app is in foreground, apply this preset.
const INITIAL_RULES = [
  { id: 'r1', appId: 'cs2',     preset: 'game'   },
  { id: 'r2', appId: 'apex',    preset: 'game'   },
  { id: 'r3', appId: 'spotify', preset: 'music'  },
  { id: 'r4', appId: 'youtube', preset: 'cinema' },
  { id: 'r5', appId: 'discord', preset: 'speech' },
];

// dB conversion: linear 0–100 fader → dB readout.
function dbFor(level) {
  if (level <= 0) return '-∞';
  const v = (level - 100) * 0.4;
  if (v <= -60) return '-∞';
  return v.toFixed(1);
}

Object.assign(window, {
  CHANNELS, PRESETS, PRESET_EQ, PRESET_DESC, PRESET_BANDS, PRESET_PROPS,
  APPS, OUTPUTS,
  INITIAL_LEVELS, INITIAL_ASSIGNMENTS, INITIAL_OUTPUTS, INITIAL_RULES,
  dbFor, bandDbFor,
});
