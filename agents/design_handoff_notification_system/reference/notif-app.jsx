// Mission Control — Notification System demo page.
//
// Layout:
//   1. App-window mockup with the notification stack at bottom-center +
//      trigger panel on the right
//   2. Variant catalog showing every notification archetype on both
//      light and dark surfaces, side by side
//   3. Anatomy callout for the rect spec

const { useState, useCallback, useMemo } = React;

// Demo content — every notification type the system supports.
// `kind`: 'rect' | 'circle' | 'volume'
// All copy below is the *only* place this file invents user-facing text.
const TRIGGERS = [
  // — Headset state changes —
  {
    id: 'mic-mute', label: 'Mic muted', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'circle', icon: <IconMicOff size={24} />,
    }),
  },
  {
    id: 'mic-unmute', label: 'Mic unmuted', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'circle', icon: <IconMic size={24} />,
    }),
  },
  {
    id: 'anc-circle', label: 'ANC toggled', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'circle', icon: <IconAnc size={24} />,
    }),
  },
  {
    id: 'transparency-circle', label: 'Transparency', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'circle', icon: <IconTransparency size={24} />,
    }),
  },
  {
    id: 'connected-circle', label: 'Connected', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'circle', icon: <IconLink size={24} />,
    }),
  },
  {
    id: 'battery-ring', label: 'Battery 76% (ring)', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'ring', icon: <IconBattery size={22} />, value: 76,
    }),
  },
  {
    id: 'battery-ring-low', label: 'Battery 12% (ring)', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'ring', icon: <IconBatteryLow size={22} />, value: 12,
    }),
  },
  {
    id: 'volume-ring', label: 'Volume 50% (ring)', group: 'Headset · Circle',
    spawn: () => ({
      kind: 'ring', icon: <IconVolume size={22} />, value: 50,
    }),
  },

  // — Headset state, rectangular —
  {
    id: 'anc', label: 'ANC on', group: 'Headset · Rect',
    spawn: () => ({
      kind: 'rect', icon: <IconAnc size={20} />,
      title: 'Noise cancellation',
      subtitle: 'Active · ambient suppressed',
    }),
  },
  {
    id: 'transparency', label: 'Transparency mode', group: 'Headset · Rect',
    spawn: () => ({
      kind: 'rect', icon: <IconTransparency size={20} />,
      title: 'Transparency mode',
      subtitle: 'Hear what’s around you',
    }),
  },
  {
    id: 'battery', label: 'Battery sync', group: 'Headset · Rect',
    spawn: () => ({
      kind: 'rect', icon: <IconBattery size={20} />,
      title: 'Arctis Nova Pro',
      subtitle: 'Headset 76% · Dock charging',
      tail: '76%',
    }),
  },
  {
    id: 'battery-low', label: 'Battery low', group: 'Headset · Rect',
    spawn: () => ({
      kind: 'rect', icon: <IconBatteryLow size={20} />,
      title: 'Battery low',
      subtitle: 'Headset at 12% — dock it soon',
      tail: '12%',
    }),
  },
  {
    id: 'connected', label: 'Connected', group: 'Headset · Rect',
    spawn: () => ({
      kind: 'rect', icon: <IconLink size={20} />,
      title: 'Arctis Nova Pro',
      subtitle: 'Connected · ready',
    }),
  },
  {
    id: 'disconnected', label: 'Disconnected', group: 'Headset · Rect',
    spawn: () => ({
      kind: 'rect', icon: <IconUnlink size={20} />,
      title: 'Arctis Nova Pro',
      subtitle: 'Disconnected',
    }),
  },

  // — Sonar —
  {
    id: 'preset-music-glyph', label: 'Preset · M (glyph)', group: 'Sonar',
    spawn: () => ({
      kind: 'glyph', glyph: 'M', sub: 'music',
    }),
  },
  {
    id: 'preset-game-glyph', label: 'Preset · G (glyph)', group: 'Sonar',
    spawn: () => ({
      kind: 'glyph', glyph: 'G', sub: 'game',
    }),
  },
  {
    id: 'preset-music', label: 'Preset \u00b7 Music', group: 'Sonar',
    spawn: () => ({
      kind: 'rect', icon: <IconMusic size={20} />,
      title: 'Sonar preset',
      subtitle: 'Music — mastered for studio',
      tail: 'MUS',
    }),
  },
  {
    id: 'preset-game', label: 'Preset \u00b7 Game', group: 'Sonar',
    spawn: () => ({
      kind: 'rect', icon: <IconMusic size={20} />,
      title: 'Sonar preset',
      subtitle: 'Game — positional focus',
      tail: 'GAM',
    }),
  },
  {
    id: 'volume', label: 'Volume slider', group: 'Sonar',
    spawn: () => ({
      kind: 'volume', icon: <IconVolume size={20} />,
      label: 'Sonar volume', value: Math.round(40 + Math.random() * 50),
      ttl: 1800,
    }),
  },
  {
    id: 'volume-mute', label: 'Volume muted', group: 'Sonar',
    spawn: () => ({
      kind: 'circle', icon: <IconVolumeMute size={24} />,
    }),
  },

  // — App —
  {
    id: 'app-bell', label: 'New notification', group: 'App',
    spawn: () => ({
      kind: 'circle', icon: <IconBell size={22} />, dot: true,
    }),
  },
  {
    id: 'app-sync', label: 'Sync 100%', group: 'App',
    spawn: () => ({
      kind: 'ring', icon: <IconCheck size={22} />, value: 100,
    }),
  },
  {
    id: 'app-dnd', label: 'Do not disturb', group: 'App',
    spawn: () => ({
      kind: 'circle', icon: <IconMoon size={24} />,
    }),
  },
  {
    id: 'app', label: 'Service started', group: 'App',
    spawn: () => ({
      kind: 'rect', icon: <IconChip size={20} />,
      title: 'arctis-hid',
      subtitle: 'Service started successfully',
    }),
  },
  {
    id: 'update', label: 'Update ready', group: 'App',
    spawn: () => ({
      kind: 'rect', icon: <IconBell size={20} />,
      title: 'Update available',
      subtitle: 'Control Centre Pro 1.4.0',
    }),
  },
];

// ── App window mock — Mission Control "Home" view (minimal). ───────────
function AppWindowMock({ theme, children }) {
  return (
    <div className="app-window" data-theme={theme}>
      <div className="app-titlebar">
        <div className="traffic"><span /><span /><span /></div>
        <span className="title">Control Centre Pro</span>
        <span className="spacer" />
        <span className="mute mono" style={{ fontSize: 11 }}>v1.3.0</span>
        <div className="winctl">
          <span>–</span>
          <span>□</span>
          <span>×</span>
        </div>
      </div>
      <div className="app-body">
        <aside className="app-sidebar">
          <div className="nav-item active"><span className="dot" /> Home</div>
          <div className="nav-item"><span className="dot" /> Audio</div>
          <div className="nav-item"><span className="dot" /> Services</div>
          <div className="nav-item"><span className="dot" /> Devices</div>
          <div className="settings-chip">
            <span className="badge">⚙</span>
            <span>Settings</span>
            <span className="spacer" />
            <span className="mute">⌄</span>
          </div>
        </aside>
        <main className="app-content">
          <div className="crumb">Home / Audio</div>
          <h3>Audio</h3>
          <div style={{ height: 18 }} />
          <HeadsetCardMock />
          {children}
        </main>
      </div>
    </div>
  );
}

function HeadsetCardMock() {
  return (
    <div className="headset-card">
      <div className="hc-name">Arctis Nova Pro</div>
      <div className="hc-status">Connected</div>
      <div className="hc-stats">
        <div className="hc-stat">
          <div className="k">Battery</div>
          <div className="v">76<small>%</small></div>
        </div>
        <div className="hc-stat">
          <div className="k">Dock</div>
          <div className="v">→<small>chg</small></div>
        </div>
        <div className="hc-stat">
          <div className="k">ANC</div>
          <div className="v" style={{ fontSize: 13 }}>ON</div>
        </div>
        <div className="hc-stat">
          <div className="k">Volume</div>
          <div className="v">68<small>%</small></div>
        </div>
      </div>
    </div>
  );
}

// ── Trigger panel ──────────────────────────────────────────────────────
// Small icon/glyph indicator shown in each trigger button. Caches the
// spawn so we don't double-call randomised spawners.
function TrigDot({ trigger }) {
  const sample = useMemo(() => trigger.spawn(), [trigger]);
  let content;
  if (sample.icon) content = React.cloneElement(sample.icon, { size: 12 });
  else if (sample.glyph) {
    content = (
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 500 }}>
        {sample.glyph}
      </span>
    );
  } else content = '';
  return <span className="dot">{content}</span>;
}

function TriggerPanel({ theme, setTheme, onFire, onClear }) {
  const groups = useMemo(() => {
    const g = {};
    for (const t of TRIGGERS) (g[t.group] ||= []).push(t);
    return g;
  }, []);
  return (
    <div className="triggers">
      <div>
        <h4 style={{ marginBottom: 8 }}>Theme</h4>
        <div className="theme-toggle" role="tablist">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
        </div>
      </div>
      <button
        className="trig-btn"
        style={{ justifyContent: 'center', color: '#9a9a9a' }}
        onClick={onClear}
      >
        Clear all
      </button>
      {Object.entries(groups).map(([name, items]) => (
        <div className="group" key={name}>
          <h4>{name}</h4>
          {items.map((t) => (
            <button key={t.id} className="trig-btn" onClick={() => onFire(t)}>
              <TrigDot trigger={t} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Variant catalog ────────────────────────────────────────────────────
// Static layout — every notification archetype, frozen in its shown
// state. Two columns (light + dark) to prove both themes work.
function VariantCatalog() {
  // Circular — icon-only set: the full vocabulary of state-change glyphs.
  const circleIcons = [
    { key: 'mic-off',     node: <IconMicOff size={24} /> },
    { key: 'mic-on',      node: <IconMic size={24} /> },
    { key: 'vol-mute',    node: <IconVolumeMute size={24} /> },
    { key: 'anc',         node: <IconAnc size={24} /> },
    { key: 'transparency',node: <IconTransparency size={24} /> },
    { key: 'connected',   node: <IconLink size={24} /> },
    { key: 'disconnected',node: <IconUnlink size={24} /> },
    { key: 'headset',     node: <IconHeadset size={24} /> },
    { key: 'bluetooth',   node: <IconBluetooth size={24} /> },
    { key: 'moon',        node: <IconMoon size={24} /> },
  ];
  // Circular — with status-dot badge (new / active / unread).
  const circleDots = [
    { key: 'bell-dot',   icon: <IconBell size={22} /> },
    { key: 'chip-dot',   icon: <IconChip size={22} /> },
    { key: 'mic-dot',    icon: <IconMic size={22} /> },
    { key: 'cog-dot',    icon: <IconCog size={22} /> },
  ];
  // Circular — ring progress at four values.
  const rings = [
    { key: 'r-25',  icon: <IconBatteryLow size={22} />, value: 12 },
    { key: 'r-50',  icon: <IconVolume size={22} />,    value: 50 },
    { key: 'r-75',  icon: <IconBattery size={22} />,   value: 76 },
    { key: 'r-100', icon: <IconCheck size={22} />,     value: 100 },
  ];
  // Circular — letter glyph (Sonar preset codes etc.)
  const glyphs = [
    { key: 'g-M', glyph: 'M', sub: 'music' },
    { key: 'g-G', glyph: 'G', sub: 'game' },
    { key: 'g-S', glyph: 'S', sub: 'studio' },
    { key: 'g-C', glyph: 'C', sub: 'cinema' },
  ];

  const rects = [
    { key: 'anc', node: (
      <NotificationRect className="shown"
        icon={<IconAnc size={20} />}
        title="Noise cancellation"
        subtitle="Active · ambient suppressed" />
    )},
    { key: 'battery', node: (
      <NotificationRect className="shown"
        icon={<IconBattery size={20} />}
        title="Arctis Nova Pro"
        subtitle="Headset 76% · Dock charging"
        tail="76%" />
    )},
    { key: 'preset', node: (
      <NotificationRect className="shown"
        icon={<IconMusic size={20} />}
        title="Sonar preset"
        subtitle="Music — mastered for studio"
        tail="MUS" />
    )},
    { key: 'volume', node: (
      <NotificationVolume className="shown"
        icon={<IconVolume size={20} />}
        label="Sonar volume" value={68} />
    )},
    { key: 'app', node: (
      <NotificationRect className="shown"
        icon={<IconBell size={20} />}
        title="Update available"
        subtitle="Control Centre Pro 1.4.0" />
    )},
  ];

  return (
    <div className="catalog">
      {['light','dark'].map((theme) => (
        <div className="cat-card" data-theme={theme} key={theme}>
          <div className="cat-label">{theme.toUpperCase()} — {theme === 'light' ? '#F5F5F5 canvas' : '#1C1C1C canvas'}</div>
          <div className="cat-grid">
            <div className="cat-sub">Circular · icon-only</div>
            <div className="cat-row">
              {circleIcons.map((c) => (
                <NotificationCircle key={c.key} className="shown" icon={c.node} />
              ))}
            </div>

            <div className="cat-sub">Circular · status dot</div>
            <div className="cat-row">
              {circleDots.map((c) => (
                <NotificationCircle key={c.key} className="shown" icon={c.icon} dot />
              ))}
            </div>

            <div className="cat-sub">Circular · ring progress</div>
            <div className="cat-row">
              {rings.map((r) => (
                <NotificationCircleRing key={r.key} className="shown" icon={r.icon} value={r.value} />
              ))}
            </div>

            <div className="cat-sub">Circular · glyph</div>
            <div className="cat-row">
              {glyphs.map((g) => (
                <NotificationCircleGlyph key={g.key} className="shown" glyph={g.glyph} sub={g.sub} />
              ))}
            </div>

            <div className="cat-sub" style={{ marginTop: 14 }}>Rectangular</div>
            {rects.map((r) => <React.Fragment key={r.key}>{r.node}</React.Fragment>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Anatomy callout ────────────────────────────────────────────────────
function Anatomy() {
  return (
    <div className="anatomy">
      <div className="stage" data-theme="dark">
        <NotificationRect className="shown"
          icon={<IconBattery size={20} />}
          title="Arctis Nova Pro"
          subtitle="Headset 76% · Dock charging"
          tail="76%" />
      </div>
      <ul>
        <li><span className="k">surface</span><span className="v">--notif-bg (rgba 86%) · backdrop-blur(20px)</span></li>
        <li><span className="k">border</span><span className="v">1px hairline · rgba(ink, 0.10)</span></li>
        <li><span className="k">radius</span><span className="v">14px (rect) · 50% (circle)</span></li>
        <li><span className="k">shadow</span><span className="v">0 8 28 rgba(0,0,0,.10) — soft, single</span></li>
        <li><span className="k">icon</span><span className="v">20px line · in 40×40 badge, --surface-raised</span></li>
        <li><span className="k">title</span><span className="v">Inter 13 · 600 · primary</span></li>
        <li><span className="k">sub</span><span className="v">Inter 12 · 400 · secondary</span></li>
        <li><span className="k">tail</span><span className="v">JetBrains Mono 11 · secondary</span></li>
        <li><span className="k">size</span><span className="v">rect 320–440w · circle 56×56</span></li>
        <li><span className="k">stack</span><span className="v">10px gap · newest at bottom</span></li>
        <li><span className="k">enter</span><span className="v">280ms · translateY(14) + scale(.96)</span></li>
        <li><span className="k">ttl</span><span className="v">2400ms default · 1800ms for sliders</span></li>
      </ul>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState('dark');
  const [items, setItems] = useState([]);
  let _id = useMemo(() => ({ n: 1 }), []);

  const fire = useCallback((trigger) => {
    const id = _id.n++;
    setItems((prev) => {
      // Cap at 3 visible — drop oldest if exceeded.
      const next = [...prev, { id, ...trigger.spawn() }];
      return next.slice(-3);
    });
  }, []);
  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Seed a sticky notification so visitors landing on the page always see
  // one in the app window. ttl: Infinity = stays until clicked or pushed
  // out by the 3-item cap.
  React.useEffect(() => {
    const sp = TRIGGERS.find((t) => t.id === 'battery').spawn();
    setItems([{ id: _id.n++, ttl: Infinity, ...sp }]);
  }, []);

  return (
    <div className="page" data-screen-label="01 Notification System">
      <div className="page-h">
        <h1>Mission Control · Notification System</h1>
        <div className="meta mono">v1 · bottom-center stack</div>
      </div>
      <p className="page-sub">
        Two notification surfaces — rectangular (icon + title + subtitle, with
        an optional volume-slider variant) and circular (icon only) — sharing
        the app’s neutral palette. Acrylic surface, 1px hairline, soft single
        shadow. They appear bottom-center of the active window and stack
        newest-at-bottom. Click a notification to dismiss it.
      </p>

      <div className="section-h">
        <h2>Live · in the app</h2>
        <span className="rule" />
        <span className="mono" style={{ fontSize: 11, color: '#6e6e6e' }}>theme: {theme}</span>
      </div>

      <div className="demo-row">
        <AppWindowMock theme={theme}>
          <NotifStack items={items} onDismiss={dismiss} />
        </AppWindowMock>
        <TriggerPanel theme={theme} setTheme={setTheme} onFire={fire} onClear={() => setItems([])} />
      </div>

      <div className="section-h">
        <h2>Variants · catalog</h2>
        <span className="rule" />
      </div>
      <VariantCatalog />

      <div className="section-h">
        <h2>Anatomy</h2>
        <span className="rule" />
      </div>
      <Anatomy />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
