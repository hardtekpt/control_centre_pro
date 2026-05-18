// Plugins page — catalog.
//
// Each plugin describes:
//   - identity: id, name, glyph (single-char placeholder), author, version
//   - state:    status enum, enabled boolean, last sync time, blurb
//   - schema:   sections of fields → drives the configure page form
//
// Status enum:
//   'connected'      → live, ok
//   'error'          → enabled but failing (auth/network/etc)
//   'disabled'       → installed, switched off
//   'installed'      → installed, never configured / not connected
//   'not-installed'  → not yet acquired (shows install button in card)
//
// Field kinds in section.fields[]:
//   { kind:'toggle',   id, label, sub, value }
//   { kind:'text',     id, label, sub, value, placeholder, mono }
//   { kind:'password', id, label, sub, value, placeholder, hint }
//   { kind:'select',   id, label, sub, value, options:[{id,label}] }
//   { kind:'multi',    id, label, sub, value:Set<string>, options:[{id,label}] }
//   { kind:'oauth',    id, label, account, lastAuth, expiresAt }
//   { kind:'readonly', id, label, sub, value, mono, copy }
//   { kind:'action',   id, label, sub, button:'Test connection', danger? }

const PLUGINS = [
  // ── Discord ────────────────────────────────────────────────────────
  {
    id: 'discord',
    name: 'Discord',
    glyph: 'D',
    brand: 'brand-discord',
    author: 'mission-control.discord',
    version: '1.2.0',
    blurb: 'Rich Presence, status sync with ANC, and notifications on incoming calls.',
    status: 'connected',
    enabled: true,
    statusLine: 'Connected · last sync 2m ago',
    category: 'communication',
    sections: [
      {
        id: 'account',
        title: 'Account',
        desc: 'Connect a Discord account via OAuth.',
        fields: [
          { kind: 'oauth', id: 'oauth', label: 'Discord account',
            account: 'hardtekpt#0451', lastAuth: '3 days ago' },
        ],
      },
      {
        id: 'presence',
        title: 'Rich Presence',
        desc: 'Show what you\u2019re doing in Mission Control on your profile.',
        fields: [
          { kind: 'toggle', id: 'rp-enable', label: 'Show activity', sub: 'Display Mission Control as your current activity.', value: true },
          { kind: 'toggle', id: 'rp-headset', label: 'Show connected headset', sub: 'Includes \u201cArctis Nova Pro\u201d when the device is online.', value: true },
          { kind: 'toggle', id: 'rp-preset', label: 'Show Sonar preset', sub: 'Appends the active preset (Music / Game / \u2026).', value: false },
        ],
      },
      {
        id: 'sync',
        title: 'State sync',
        desc: 'Mirror app state into Discord automatically.',
        fields: [
          { kind: 'toggle', id: 'sync-dnd-anc', label: 'DND when ANC active', sub: 'Set Discord to Do Not Disturb while noise cancellation is on.', value: true },
          { kind: 'toggle', id: 'sync-dnd-call', label: 'DND while in call', sub: 'Suppress non-call Discord pings during voice / video calls.', value: false },
          { kind: 'toggle', id: 'sync-notify-call', label: 'Notify on incoming call', sub: 'Show a Mission Control notification when a Discord call comes in.', value: true },
        ],
      },
    ],
  },

  // ── Steam ──────────────────────────────────────────────────────────
  {
    id: 'steam',
    name: 'Steam',
    glyph: 'S',
    brand: 'brand-steam',
    author: 'mission-control.steam',
    version: '0.9.3',
    blurb: 'Sync game library, surface \u201cNow playing\u201d state to other plugins, and auto-launch.',
    status: 'connected',
    enabled: true,
    statusLine: 'Connected · library synced 14m ago',
    category: 'gaming',
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        desc: 'Steam Web API credentials.',
        fields: [
          { kind: 'text',     id: 'steam-id',  label: 'SteamID64', sub: 'Find this in your Steam profile URL.', value: '76561198012345678', mono: true, placeholder: '7656...' },
          { kind: 'password', id: 'api-key',   label: 'Web API key', sub: 'Used for library + friends. Read-only.', value: 'ABCDEF0123456789ABCDEF0123456789', hint: 'Generate at steamcommunity.com/dev/apikey' },
          { kind: 'action',   id: 'test',      label: 'Test connection', sub: 'Verify the API key by fetching your profile.', button: 'Test now' },
        ],
      },
      {
        id: 'sync',
        title: 'Library sync',
        fields: [
          { kind: 'select', id: 'sync-interval', label: 'Sync interval', sub: 'How often to refresh the games library and playtime.', value: '6h', options: [
            { id: '1h',  label: 'Every hour' },
            { id: '6h',  label: 'Every 6 hours' },
            { id: '24h', label: 'Daily' },
            { id: 'manual', label: 'Manual only' },
          ]},
          { kind: 'toggle', id: 'now-playing', label: 'Broadcast \u201cNow playing\u201d', sub: 'Allow other plugins (Discord, Hue) to read the current game.', value: true },
          { kind: 'toggle', id: 'auto-launch', label: 'Auto-launch Mission Control with Steam', sub: 'Start the app when Steam starts.', value: false },
        ],
      },
    ],
  },

  // ── Home Assistant ─────────────────────────────────────────────────
  {
    id: 'hass',
    name: 'Home Assistant',
    glyph: 'H',
    brand: 'brand-hass',
    author: 'community.hass',
    version: '2.1.0',
    blurb: 'Two-way sync with HA entities. Trigger scenes from app events, expose Mission Control state.',
    status: 'connected',
    enabled: true,
    statusLine: 'Connected · 142 entities · websocket OK',
    category: 'smart-home',
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { kind: 'text',     id: 'url',   label: 'Server URL', sub: 'Full URL including protocol and port.', value: 'http://homeassistant.local:8123', mono: true, placeholder: 'http://homeassistant.local:8123' },
          { kind: 'password', id: 'token', label: 'Long-lived access token', sub: 'Generate from your HA user profile.', value: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...' },
          { kind: 'readonly', id: 'session', label: 'Connection', sub: 'Last successful handshake.', value: 'WebSocket open · 14h 22m', mono: true },
        ],
      },
      {
        id: 'sync',
        title: 'State sync',
        desc: 'Which entities Mission Control reads and writes.',
        fields: [
          { kind: 'multi', id: 'sync-domains', label: 'Sync domains', sub: 'Only listen to and control entities in these domains.', value: new Set(['light', 'switch', 'scene']),
            options: [
              { id: 'light',  label: 'Lights' },
              { id: 'switch', label: 'Switches' },
              { id: 'scene',  label: 'Scenes' },
              { id: 'sensor', label: 'Sensors' },
              { id: 'media_player', label: 'Media players' },
            ]},
          { kind: 'toggle', id: 'expose-app', label: 'Expose Mission Control as a sensor', sub: 'Adds sensor.mission_control_anc, .preset, .battery, etc.', value: true },
        ],
      },
      {
        id: 'triggers',
        title: 'Automations',
        desc: 'Fire HA scenes / scripts on Mission Control events.',
        fields: [
          { kind: 'select', id: 'trig-anc-on',  label: 'When ANC turns on',   sub: 'Optional scene to call.', value: 'scene.focus_mode', options: [
            { id: '',                  label: '— none —' },
            { id: 'scene.focus_mode',  label: 'scene.focus_mode' },
            { id: 'scene.movie_time',  label: 'scene.movie_time' },
            { id: 'scene.evening',     label: 'scene.evening' },
          ]},
          { kind: 'select', id: 'trig-anc-off', label: 'When ANC turns off',  sub: 'Optional scene to call.', value: '', options: [
            { id: '',                  label: '— none —' },
            { id: 'scene.bright',      label: 'scene.bright' },
            { id: 'scene.default',     label: 'scene.default' },
          ]},
        ],
      },
    ],
  },

  // ── Spotify ────────────────────────────────────────────────────────
  {
    id: 'spotify',
    name: 'Spotify',
    glyph: 'P',
    brand: 'brand-spotify',
    author: 'mission-control.spotify',
    version: '1.0.1',
    blurb: 'OAuth-connected playback controls and \u201cNow playing\u201d display in the Home dashboard.',
    status: 'connected',
    enabled: true,
    statusLine: 'Connected · token refreshes in 27m',
    category: 'media',
    sections: [
      {
        id: 'account',
        title: 'Account',
        fields: [
          { kind: 'oauth', id: 'oauth', label: 'Spotify account', account: 'rui@example.com', lastAuth: '12 days ago', expiresAt: '27 minutes' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { kind: 'toggle', id: 'home-card',  label: 'Show on Home dashboard', sub: 'Adds a \u201cNow playing\u201d card with controls.', value: true },
          { kind: 'toggle', id: 'allow-control', label: 'Allow playback shortcuts', sub: 'Lets keyboard shortcuts play / pause / skip.', value: true },
          { kind: 'toggle', id: 'auto-pause', label: 'Pause on Discord call',  sub: 'Pauses playback when a Discord call begins (requires Discord plugin).', value: false },
        ],
      },
    ],
  },

  // ── OBS Studio ─────────────────────────────────────────────────────
  {
    id: 'obs',
    name: 'OBS Studio',
    glyph: 'O',
    brand: 'brand-obs',
    author: 'community.obs',
    version: '0.7.2',
    blurb: 'Scene switching, record / stream control, and audio source monitoring via the WebSocket plugin.',
    status: 'error',
    enabled: true,
    statusLine: 'Error · ECONNREFUSED · check OBS WebSocket server',
    category: 'streaming',
    error: 'Connection refused at ws://localhost:4455. Make sure the OBS WebSocket Server is enabled (Tools → WebSocket Server Settings) and the password matches below.',
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { kind: 'text',     id: 'ws-url',  label: 'WebSocket URL', sub: 'Default port for OBS WebSocket Server.', value: 'ws://localhost:4455', mono: true, placeholder: 'ws://localhost:4455' },
          { kind: 'password', id: 'ws-pass', label: 'Server password', sub: 'Set in OBS WebSocket Server Settings.', value: '' },
          { kind: 'action',   id: 'test',    label: 'Test connection', sub: 'Attempt a handshake against the running OBS instance.', button: 'Test now' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { kind: 'toggle', id: 'scene-shortcuts', label: 'Allow scene shortcuts', sub: 'Lets keyboard shortcuts switch OBS scenes.', value: true },
          { kind: 'toggle', id: 'stream-notif',    label: 'Notify on stream start / stop', sub: 'Surface a Mission Control notification when state changes.', value: true },
          { kind: 'toggle', id: 'record-on-anc',   label: 'Auto-record while ANC active', sub: 'Begin recording when noise cancellation turns on, stop when it turns off.', value: false },
        ],
      },
    ],
  },

  // ── Philips Hue ────────────────────────────────────────────────────
  {
    id: 'hue',
    name: 'Philips Hue',
    glyph: 'H',
    brand: 'brand-hue',
    author: 'mission-control.hue',
    version: '1.4.0',
    blurb: 'Sync lights with app state — ANC, presets, focus mode — directly via the Hue Bridge.',
    status: 'disabled',
    enabled: false,
    statusLine: 'Disabled · bridge paired',
    category: 'smart-home',
    sections: [
      {
        id: 'bridge',
        title: 'Bridge',
        fields: [
          { kind: 'text',     id: 'bridge-ip', label: 'Bridge IP', sub: 'Discovered on your local network.', value: '192.168.1.42', mono: true },
          { kind: 'password', id: 'app-key',   label: 'Application key', sub: 'Set automatically when you press the bridge button.', value: 'mYxJ4...' },
          { kind: 'action',   id: 'repair',    label: 'Re-pair bridge', sub: 'Run the discovery + press-the-button flow again.', button: 'Re-pair' },
        ],
      },
      {
        id: 'sync',
        title: 'Light sync',
        fields: [
          { kind: 'multi', id: 'groups', label: 'Groups to control', sub: 'Mission Control only touches these rooms / zones.', value: new Set(['office']), options: [
            { id: 'office',     label: 'Office' },
            { id: 'living',     label: 'Living room' },
            { id: 'bedroom',    label: 'Bedroom' },
            { id: 'all-others', label: 'All other rooms' },
          ]},
          { kind: 'toggle', id: 'dim-anc',  label: 'Dim on ANC', sub: 'Drop brightness 30% when noise cancellation turns on.', value: true },
          { kind: 'toggle', id: 'colour-preset', label: 'Tint with Sonar preset', sub: 'Subtle hue shift per preset (Music → warm, Game → cool).', value: false },
        ],
      },
    ],
  },

  // ── Twitch ─────────────────────────────────────────────────────────
  {
    id: 'twitch',
    name: 'Twitch',
    glyph: 'T',
    brand: 'brand-twitch',
    author: 'community.twitch',
    version: '0.4.1',
    blurb: 'Show live status, chat unread count, and trigger automations when you go live.',
    status: 'installed',
    enabled: false,
    statusLine: 'Not configured',
    category: 'streaming',
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { kind: 'text',     id: 'channel', label: 'Channel name', sub: 'Without the @.', value: '', placeholder: 'your_channel', mono: true },
          { kind: 'password', id: 'oauth',   label: 'OAuth token', sub: 'Use the Twitch token generator.', value: '' },
        ],
      },
    ],
  },

  // ── Stream Deck ────────────────────────────────────────────────────
  {
    id: 'streamdeck',
    name: 'Stream Deck',
    glyph: 'K',
    brand: 'brand-streamdeck',
    author: 'mission-control.streamdeck',
    version: '0.0.0',
    blurb: 'Expose Mission Control actions as Stream Deck buttons via the Stream Deck SDK.',
    status: 'not-installed',
    enabled: false,
    statusLine: 'Not installed',
    category: 'peripheral',
    sections: [],
  },
];

// Catalog filters / search categories.
const PLUGIN_CATEGORIES = [
  { id: 'all',           label: 'All' },
  { id: 'connected',     label: 'Connected', match: (p) => p.status === 'connected' },
  { id: 'communication', label: 'Communication' },
  { id: 'gaming',        label: 'Gaming' },
  { id: 'streaming',     label: 'Streaming' },
  { id: 'smart-home',    label: 'Smart home' },
  { id: 'media',         label: 'Media' },
  { id: 'available',     label: 'Available', match: (p) => p.status === 'not-installed' },
];

// Status label/dot mapping consumed by both the card and the configure
// page header.
const STATUS_PRESENT = {
  'connected':    { label: 'Connected',    dot: 'connected'   },
  'error':        { label: 'Error',        dot: 'error'       },
  'disabled':     { label: 'Disabled',     dot: 'disabled'    },
  'installed':    { label: 'Not connected', dot: 'installed'  },
  'not-installed':{ label: 'Not installed', dot: 'not-installed' },
};

Object.assign(window, { PLUGINS, PLUGIN_CATEGORIES, STATUS_PRESENT });
