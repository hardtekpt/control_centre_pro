// Plugins page — top-level app shell with Settings sub-navigation.
//
// Routing model (held in this component, no router):
//   { tab: 'general' | 'plugins' | 'about', pluginId: string | null }
//
// When tab === 'plugins' and pluginId is null → grid view.
// When tab === 'plugins' and pluginId is set  → configure view for that plugin.

const { useState, useEffect, useMemo, useCallback } = React;

// ── PluginGrid ─────────────────────────────────────────────────────────
function PluginGrid({ plugins, onConfigure, onToggle }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  // Per-filter visibility + counts.
  const matches = useCallback((p, filterId) => {
    if (filterId === 'all') return true;
    const def = PLUGIN_CATEGORIES.find((c) => c.id === filterId);
    if (def?.match) return def.match(p);
    return p.category === filterId;
  }, []);

  const counts = useMemo(() => {
    const c = {};
    for (const cat of PLUGIN_CATEGORIES) {
      c[cat.id] = plugins.filter((p) => matches(p, cat.id)).length;
    }
    return c;
  }, [plugins, matches]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins.filter((p) => {
      if (!matches(p, filter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.blurb.toLowerCase().includes(q)
      );
    });
  }, [plugins, filter, query, matches]);

  return (
    <>
      <div className="pl-header">
        <div className="titles">
          <h2>Plugins</h2>
          <div className="sub">
            {plugins.filter((p) => p.status === 'connected').length} connected ·{' '}
            {plugins.filter((p) => p.status !== 'not-installed').length} installed
          </div>
        </div>
        <div className="actions">
          <label className="pl-search">
            <IconSearch size={14} />
            <input
              placeholder="Search plugins…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="btn-ghost" type="button">
            <IconStore size={14} /> Browse store
          </button>
        </div>
      </div>

      <div className="pl-filters">
        {PLUGIN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`chip ${filter === cat.id ? 'active' : ''}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
            <span className="count">{counts[cat.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="pl-empty">
          <h4>No plugins match</h4>
          <p>Try a different filter or search term.</p>
        </div>
      ) : (
        <div className="pl-grid">
          {visible.map((p) => (
            <PluginCard
              key={p.id}
              plugin={p}
              onConfigure={onConfigure}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── ConfigurePage ──────────────────────────────────────────────────────
function ConfigurePage({ plugin, onBack, onToggle, onChange, onAction }) {
  const preset = STATUS_PRESENT[plugin.status] || {};
  return (
    <div className="cfg-page">
      <div className="cfg-header">
        <button className="cfg-back" onClick={onBack} type="button">
          <IconArrowLeft size={12} /> Plugins
        </button>
        <div className="cfg-header-row">
          <div className={`glyph ${plugin.brand || ''}`}>{plugin.glyph}</div>
          <div className="meta">
            <h2>{plugin.name}</h2>
            <div className="blurb">{plugin.blurb}</div>
            <div className="stat-row">
              <StatusPill status={plugin.status} label={plugin.statusLine} />
              <span className="pipe">·</span>
              <span>version <span className="v">{plugin.version}</span></span>
              <span className="pipe">·</span>
              <span>{plugin.author}</span>
            </div>
          </div>
          <div className="actions">
            <div className="enable-label">
              Plugin
              <span className="v">{plugin.enabled ? 'On' : 'Off'}</span>
            </div>
            <span
              className={`toggle lg ${plugin.enabled ? 'on' : ''}`}
              role="switch"
              aria-checked={plugin.enabled}
              onClick={() => onToggle(plugin.id)}
            />
          </div>
        </div>
      </div>

      <div className="cfg-body">
        {plugin.status === 'error' && plugin.error && (
          <div className="banner warn">
            <span className="b-ic"><IconWarn size={16} /></span>
            <div className="b-body">
              <div className="b-title">Connection failed</div>
              <div className="b-sub">{plugin.error}</div>
            </div>
            <button type="button" className="btn-ghost">
              <IconRefresh size={13} /> Retry
            </button>
          </div>
        )}
        {plugin.status === 'disabled' && (
          <div className="banner info">
            <span className="b-ic"><IconInfo size={16} /></span>
            <div className="b-body">
              <div className="b-title">Plugin is disabled</div>
              <div className="b-sub">Turn it on in the top-right to activate sync and listeners.</div>
            </div>
          </div>
        )}

        {plugin.sections.map((sect) => (
          <SectionCard key={sect.id} title={sect.title} desc={sect.desc}>
            {sect.fields.map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={field.value}
                onChange={(v) => onChange(plugin.id, sect.id, field.id, v)}
                onAction={(kind) => onAction(plugin.id, sect.id, field.id, kind)}
              />
            ))}
          </SectionCard>
        ))}

        {/* Footer with destructive action — uninstall */}
        <SectionCard title="Plugin lifecycle" desc="Manage installation and data.">
          <FieldRow label="Reset configuration" sub="Clear all stored credentials and preferences for this plugin. The plugin remains installed.">
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost danger">Reset</button>
            </span>
          </FieldRow>
          <FieldRow label="Uninstall plugin" sub="Remove the plugin and all its data. You can reinstall it any time from the store.">
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost danger">Uninstall</button>
            </span>
          </FieldRow>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Mock General settings (so the Settings sidebar feels real) ─────────
function GeneralStub() {
  return (
    <div style={{ padding: '32px', color: 'var(--color-text-secondary)' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 600 }}>General</h2>
      <div style={{ fontSize: 13, marginTop: 8 }}>Theme, sidebar persistence, Python path, services. (Not the focus of this design.)</div>
    </div>
  );
}
function AboutStub() {
  return (
    <div style={{ padding: '32px', color: 'var(--color-text-secondary)' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 600 }}>About</h2>
      <div style={{ fontSize: 13, marginTop: 8 }}>Version info + scrollable service log.</div>
    </div>
  );
}

// ── SettingsShell ──────────────────────────────────────────────────────
const SETTINGS_TABS = [
  { id: 'general', label: 'General',    icon: IconCog },
  { id: 'plugins', label: 'Plugins',    icon: IconPlug },
  { id: 'about',   label: 'About',      icon: IconInfoBlock },
];

function SettingsShell({ tab, setTab, plugins, pluginId, setPluginId, onTogglePlugin, onChangeField, onFieldAction }) {
  const plugin = pluginId ? plugins.find((p) => p.id === pluginId) : null;
  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="ss-h">Settings</div>
        {SETTINGS_TABS.map((t) => {
          const I = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`ss-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setPluginId(null); }}
            >
              <span className="nav-ic"><I size={14} /></span>
              {t.label}
              {t.id === 'plugins' && (
                <span className="nav-count" style={{ marginLeft: 'auto' }}>
                  {plugins.filter((p) => p.status === 'connected').length}
                </span>
              )}
            </button>
          );
        })}
      </aside>
      <div className="settings-body">
        {tab === 'general' && <GeneralStub />}
        {tab === 'about'   && <AboutStub />}
        {tab === 'plugins' && (
          plugin ? (
            <ConfigurePage
              plugin={plugin}
              onBack={() => setPluginId(null)}
              onToggle={onTogglePlugin}
              onChange={onChangeField}
              onAction={onFieldAction}
            />
          ) : (
            <PluginGrid
              plugins={plugins}
              onConfigure={setPluginId}
              onToggle={onTogglePlugin}
            />
          )
        )}
      </div>
    </div>
  );
}

// ── App + window chrome ────────────────────────────────────────────────
function AppWindow({ theme, ...settingsProps }) {
  return (
    <div className="app-window" data-theme={theme}>
      <div className="app-titlebar">
        <div className="traffic"><span /><span /><span /></div>
        <span className="title">Mission Control</span>
        <span className="spacer" />
        <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>v1.3.0</span>
      </div>
      <div className="app-body">
        <aside className="app-sidebar">
          <div className="nav-section-h">Main</div>
          <div className="nav-item"><span className="nav-ic"><IconHome size={14} /></span>Home</div>
          <div className="nav-item"><span className="nav-ic"><IconHeadset size={14} /></span>Audio</div>
          <div className="nav-item"><span className="nav-ic"><IconMonitor size={14} /></span>Displays</div>
          <div className="nav-item"><span className="nav-ic"><IconLayers size={14} /></span>Services</div>
          <div className="nav-item"><span className="nav-ic"><IconKeyboard size={14} /></span>Shortcuts</div>
          <div className="settings-chip active">
            <span className="badge"><IconCog size={12} /></span>
            <span>Settings</span>
            <span className="sp" />
            <span style={{ color: 'var(--color-text-secondary)' }}>⌃</span>
          </div>
        </aside>
        <div className="app-content">
          <SettingsShell {...settingsProps} />
        </div>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState('dark');
  const [tab, setTab] = useState('plugins');
  const [pluginId, setPluginId] = useState(null);
  const [plugins, setPlugins] = useState(PLUGINS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Toggle plugin enabled flag. Status also flips so the indicator
  // updates in lockstep — connected ↔ disabled. Plugins in 'error'
  // stay 'error' until the user retries.
  const togglePlugin = useCallback((id) => {
    setPlugins((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const nextEnabled = !p.enabled;
      let nextStatus = p.status;
      if (p.status === 'connected' && !nextEnabled) nextStatus = 'disabled';
      else if (p.status === 'disabled' && nextEnabled) nextStatus = 'connected';
      return { ...p, enabled: nextEnabled, status: nextStatus };
    }));
  }, []);

  // Patch a single field value. Sections + fields are mutable copies of
  // the original schema so each FormField holds the source of truth in
  // its parent's state.
  const changeField = useCallback((pluginId, sectionId, fieldId, value) => {
    setPlugins((prev) => prev.map((p) => {
      if (p.id !== pluginId) return p;
      return {
        ...p,
        sections: p.sections.map((s) => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            fields: s.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
          };
        }),
      };
    }));
  }, []);
  // Field actions (test-connection, reauth, disconnect) — wired to a
  // no-op in the prototype. The real renderer would dispatch IPC here.
  const fieldAction = useCallback((/* pluginId, sectionId, fieldId, kind */) => {}, []);

  return (
    <div className="page" data-screen-label="01 Plugins Settings">
      <div className="page-h">
        <h1>Mission Control · Plugins Settings</h1>
        <div className="meta mono">v1 · Settings → Plugins</div>
      </div>
      <p className="page-sub">
        A new Settings tab that lists installable plugins as a card grid and lets
        the user enable, disable, or configure each. The configure page renders a
        schema-driven form covering OAuth, API keys, toggles, selects, and
        multi-select chips — with status and lifecycle controls at the top.
      </p>

      <div className="demo-toggle">
        <button className={theme === 'dark'  ? 'active' : ''} onClick={() => setTheme('dark')}>dark</button>
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>light</button>
      </div>

      <AppWindow
        theme={theme}
        tab={tab} setTab={setTab}
        plugins={plugins}
        pluginId={pluginId} setPluginId={setPluginId}
        onTogglePlugin={togglePlugin}
        onChangeField={changeField}
        onFieldAction={fieldAction}
      />

      <div className="annot">
        <div className="card">
          <h5>Discoverable grid</h5>
          <p>Cards surface name, blurb, status, and toggle. Hover gives a clear affordance to enter the configure page; clicking the toggle stops propagation so you can enable without leaving the grid.</p>
        </div>
        <div className="card">
          <h5>Schema-driven form</h5>
          <p>Each plugin defines sections of fields. The same form chassis renders text, password, toggle, select, multi-select chips, OAuth, read-only, and action rows.</p>
        </div>
        <div className="card">
          <h5>Status-aware</h5>
          <p>Banners surface plugin-level errors with a Retry button. Disabled plugins keep their config visible but show an info banner. Connected pings the dot with --color-ok.</p>
        </div>
        <div className="card">
          <h5>Settings sub-nav</h5>
          <p>"Plugins" sits between "General" and "About" — same pattern as the existing settings shell. Adds a count badge for connected plugins.</p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
