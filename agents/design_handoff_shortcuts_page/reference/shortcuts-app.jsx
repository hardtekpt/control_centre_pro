// Shortcuts page — main app.
//
// Page composition:
//   [Window]
//   ├ [Sidebar]            — Mission Control nav
//   └ [Content]
//      ├ Header            — title + search + "New shortcut"
//      ├ Filter chips      — All · Arctis · Sonar · Displays · App
//      └ List (scrollable)
//         ├ NewShortcutPanel (inline; toggles open)
//         └ Category groups
//            └ ShortcutRow … (click keybind pill → inline re-record)
//
// Actions can carry a `param` schema. When an action has one, the
// shortcut stores a `value` alongside `keys` / `scope`. The new-
// shortcut panel exposes Category → Action → Value as three custom
// dropdowns; the row shows the value as a small mono pill next to the
// action label.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── KbdPills ────────────────────────────────────────────────────────────
function KbdPills({ keys }) {
  if (!keys || keys.length === 0) {
    return <span className="kbd unset">unset</span>;
  }
  return (
    <>
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="kbd-plus">+</span>}
          <span className="kbd">{k}</span>
        </React.Fragment>
      ))}
    </>
  );
}

// ── useKeyCapture ──────────────────────────────────────────────────────
function useKeyCapture({ active, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    ref.current?.focus();
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { onCancel(); return; }
      const combo = combinationFromEvent(e);
      if (!combo) return;
      const hasMod = combo.length > 1;
      const isFKey = /^F\d{1,2}$/.test(combo[0]);
      if (!hasMod && !isFKey) return;
      onCommit(combo);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, onCommit, onCancel]);
  return ref;
}

// ── ShortcutRow ─────────────────────────────────────────────────────────
function ShortcutRow({ shortcut, action, conflict, capturing, onCapture, onCommit, onCancel, onToggle, onDelete }) {
  const ref = useKeyCapture({
    active: capturing,
    onCommit: (combo) => onCommit(shortcut.id, combo),
    onCancel: () => onCancel(),
  });
  const Icon = action.icon;
  const cat = CATEGORIES.find((c) => c.id === action.cat);
  const valueDisplay = formatActionValue(action, shortcut.value);

  return (
    <div className={`sc-row ${capturing ? 'editing' : ''} ${!shortcut.enabled ? 'disabled' : ''}`}>
      <div className="row-ic"><Icon size={16} /></div>
      <div className="row-body">
        <div className="row-title">
          <span>{action.label}</span>
          {valueDisplay && <span className="row-value-pill">{valueDisplay}</span>}
        </div>
        <div className="row-meta">
          <span>{cat.label}</span>
          <span className="pipe">·</span>
          <span>{shortcut.scope === 'global' ? 'Global' : 'When focused'}</span>
          {conflict && (
            <>
              <span className="pipe">·</span>
              <span style={{ color: 'var(--color-warn)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IconWarn size={11} /> Conflicts with {conflict.label}
              </span>
            </>
          )}
        </div>
      </div>
      <div
        ref={ref}
        tabIndex={-1}
        className={`row-keys ${capturing ? 'capturing' : ''}`}
        onClick={() => !capturing && onCapture(shortcut.id)}
        title="Click to re-bind"
      >
        {capturing ? (
          <>
            <span style={{ width: 6, height: 6, background: 'var(--color-text-primary)', borderRadius: 999, animation: 'pulse 1.2s ease-in-out infinite' }} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Press keys…
            </span>
          </>
        ) : (
          <KbdPills keys={shortcut.keys} />
        )}
      </div>
      <button
        className={`toggle ${shortcut.enabled ? 'on' : ''}`}
        aria-label={shortcut.enabled ? 'Disable' : 'Enable'}
        onClick={() => onToggle(shortcut.id)}
      />
      <button className="more" onClick={() => onDelete(shortcut.id)} title="Delete">
        <IconX size={14} />
      </button>
    </div>
  );
}

// ── NewShortcutPanel ──────────────────────────────────────────────────
// Two-step action selection (Category → Action) + parametric Value
// field + keybind capture + scope. Conflict-aware. Auto-defaults the
// value when the action is picked.
function NewShortcutPanel({ existing, onCreate, onCancel }) {
  const [categoryId, setCategoryId] = useState('');
  const [actionId, setActionId]     = useState('');
  const [value, setValue]           = useState(undefined);
  const [keys, setKeys]             = useState([]);
  const [scope, setScope]           = useState('global');
  const [capturing, setCapturing]   = useState(false);

  const action = actionId ? actionById(actionId) : null;

  // Actions filtered by chosen category — input to the Action dropdown.
  const actionOptions = useMemo(() => {
    if (!categoryId) return [];
    return ACTIONS.filter((a) => a.cat === categoryId).map((a) => ({
      id: a.id,
      label: a.label,
      icon: a.icon,
      sub: a.param ? 'param' : null,    // hint: parametric vs not
    }));
  }, [categoryId]);

  // When category changes, reset action + value.
  const pickCategory = (id) => {
    setCategoryId(id);
    setActionId('');
    setValue(undefined);
  };
  // When action changes, seed the default param value.
  const pickAction = (id) => {
    setActionId(id);
    setValue(defaultValueFor(actionById(id)));
  };

  // Capture flow — open the capture field by clicking it.
  const captureRef = useKeyCapture({
    active: capturing,
    onCommit: (combo) => { setKeys(combo); setCapturing(false); },
    onCancel: () => setCapturing(false),
  });

  // Conflict detection across existing shortcuts (any combo, ignoring value).
  const conflict = useMemo(() => {
    if (keys.length === 0) return null;
    return existing.find((s) => combosEqual(s.keys, keys));
  }, [keys, existing]);
  const conflictAction = conflict && actionById(conflict.actionId);

  // Value must be set for parametric actions.
  const valueOK = !action || !action.param || (value !== undefined && value !== null && value !== '');
  const canSave = actionId && keys.length > 0 && !conflict && valueOK;

  // Convenience: list of category options for the dropdown.
  const categoryOptions = useMemo(() =>
    CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, sub: c.blurb })),
  []);
  const scopeOptions = useMemo(() =>
    SCOPES.map((s) => ({ id: s.id, label: s.label, sub: s.blurb })),
  []);

  return (
    <div className="new-panel" role="dialog" aria-label="New shortcut">
      <div className="field f-category">
        <label className="label">Category</label>
        <Dropdown
          value={categoryId}
          options={categoryOptions}
          onChange={pickCategory}
          placeholder="Pick a category…"
        />
      </div>

      <div className="field f-action">
        <label className="label">Action</label>
        <Dropdown
          value={actionId}
          options={actionOptions}
          onChange={pickAction}
          placeholder={categoryId ? 'Pick an action…' : 'Pick a category first'}
          disabled={!categoryId}
        />
      </div>

      <div className="field f-value">
        <label className="label">
          {action?.param ? action.param.label : 'Value'}
        </label>
        <ValueField action={action} value={value} onChange={setValue} />
      </div>

      <div className="field f-shortcut">
        <label className="label">Shortcut</label>
        <div
          ref={captureRef}
          tabIndex={-1}
          className={`capture ${capturing ? 'recording' : ''} ${conflict ? 'conflict' : ''}`}
          onClick={() => setCapturing(true)}
        >
          {capturing ? (
            <>
              <span className="rec-dot" />
              <span className="placeholder">Press keys… Esc to cancel</span>
            </>
          ) : keys.length === 0 ? (
            <span className="placeholder">Click to record</span>
          ) : (
            <KbdPills keys={keys} />
          )}
        </div>
      </div>

      <div className="field f-scope">
        <label className="label">Scope</label>
        <Dropdown
          value={scope}
          options={scopeOptions}
          onChange={setScope}
        />
      </div>

      <div className="f-actions">
        <button className="sc-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="sc-btn-primary"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onClick={() => onCreate({ actionId, value, keys, scope })}
        >
          <IconCheck size={14} /> Save shortcut
        </button>
      </div>

      {conflict && conflictAction && (
        <div className="conflict-msg">
          <IconWarn size={12} />
          <span><strong style={{ color: 'var(--color-text-primary)' }}>{formatCombo(keys)}</strong> is already bound to <strong style={{ color: 'var(--color-text-primary)' }}>{conflictAction.label}</strong>{conflict.value !== undefined ? ` · ${formatActionValue(conflictAction, conflict.value)}` : ''}. Pick a different combo.</span>
        </div>
      )}
    </div>
  );
}

// ── ShortcutsPage ──────────────────────────────────────────────────────
function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState(INITIAL_SHORTCUTS);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [capturingId, setCapturingId] = useState(null);

  const actionLookup = useMemo(() => {
    const m = {};
    for (const a of ACTIONS) m[a.id] = a;
    return m;
  }, []);

  // Visible shortcuts after filter + search.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shortcuts.filter((s) => {
      const a = actionLookup[s.actionId];
      if (!a) return false;
      if (filter !== 'all' && a.cat !== filter) return false;
      if (!q) return true;
      const valStr = formatActionValue(a, s.value) || '';
      return (
        a.label.toLowerCase().includes(q) ||
        formatCombo(s.keys).toLowerCase().includes(q) ||
        a.cat.includes(q) ||
        valStr.toLowerCase().includes(q)
      );
    });
  }, [shortcuts, filter, query, actionLookup]);

  // Group visible into categories preserving CATEGORIES order.
  const grouped = useMemo(() => {
    const g = {};
    for (const cat of CATEGORIES) g[cat.id] = [];
    for (const s of visible) g[actionLookup[s.actionId].cat].push(s);
    return g;
  }, [visible, actionLookup]);

  // Per-category total count (independent of filter) for chip counts.
  const categoryCounts = useMemo(() => {
    const c = { all: shortcuts.length };
    for (const cat of CATEGORIES) c[cat.id] = 0;
    for (const s of shortcuts) {
      const a = actionLookup[s.actionId];
      if (a) c[a.cat] = (c[a.cat] || 0) + 1;
    }
    return c;
  }, [shortcuts, actionLookup]);

  // Conflict map keyed by shortcut id.
  const conflictByShortcut = useMemo(() => {
    const byCombo = {};
    for (const s of shortcuts) {
      const key = s.keys.join('+');
      (byCombo[key] ||= []).push(s);
    }
    const out = {};
    for (const s of shortcuts) {
      const peers = byCombo[s.keys.join('+')] || [];
      const other = peers.find((p) => p.id !== s.id && p.enabled !== false);
      if (other) {
        const a = actionLookup[other.actionId];
        const v = formatActionValue(a, other.value);
        out[s.id] = { id: other.id, label: a?.label + (v ? ` · ${v}` : '') };
      }
    }
    return out;
  }, [shortcuts, actionLookup]);

  // Mutations.
  const updateShortcut = useCallback((id, patch) => {
    setShortcuts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);
  const deleteShortcut = useCallback((id) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);
  const createShortcut = useCallback(({ actionId, value, keys, scope }) => {
    const id = 'n' + Math.random().toString(36).slice(2, 8);
    setShortcuts((prev) => [...prev, { id, actionId, value, keys, scope, enabled: true }]);
    setShowNew(false);
  }, []);

  // ⌘K to focus search; "n" to open the new panel.
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (!showNew && !capturingId && e.key === 'n'
                 && document.activeElement?.tagName !== 'INPUT'
                 && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        setShowNew(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNew, capturingId]);

  const totalVisible = visible.length;

  return (
    <div className="app-content">
      <div className="sc-header">
        <div className="titles">
          <h2>Shortcuts</h2>
          <div className="sub">
            {shortcuts.length} configured · {shortcuts.filter((s) => s.enabled).length} enabled
          </div>
        </div>
        <div className="actions">
          <label className="sc-search">
            <IconSearch size={14} />
            <input
              ref={searchRef}
              placeholder="Search action, value or keys…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="kbd-hint">⌘K</span>
          </label>
          <button className="sc-btn-primary" onClick={() => setShowNew(true)}>
            <IconPlus size={14} /> New shortcut
          </button>
        </div>
      </div>

      <div className="sc-filters">
        <button
          className={`chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All <span className="count">{categoryCounts.all}</span>
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              className={`chip ${filter === cat.id ? 'active' : ''}`}
              onClick={() => setFilter(cat.id)}
            >
              <Icon size={13} />
              {cat.label}
              <span className="count">{categoryCounts[cat.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="sc-list">
        {showNew && (
          <NewShortcutPanel
            existing={shortcuts}
            onCreate={createShortcut}
            onCancel={() => setShowNew(false)}
          />
        )}

        {totalVisible === 0 && !showNew && (
          <div className="empty">
            <h4>No shortcuts match</h4>
            <p>Try a different filter or search term, or create a new shortcut.</p>
          </div>
        )}

        {CATEGORIES.map((cat) => {
          const rows = grouped[cat.id];
          if (rows.length === 0) return null;
          const CIcon = cat.icon;
          return (
            <section key={cat.id}>
              <div className="sc-group-h">
                <div className="gicon"><CIcon size={14} /></div>
                <h3>{cat.label}</h3>
                <span className="count">{rows.length}</span>
                <span className="rule" />
              </div>
              {rows.map((s) => (
                <ShortcutRow
                  key={s.id}
                  shortcut={s}
                  action={actionLookup[s.actionId]}
                  conflict={conflictByShortcut[s.id]}
                  capturing={capturingId === s.id}
                  onCapture={(id) => setCapturingId(id)}
                  onCommit={(id, combo) => { updateShortcut(id, { keys: combo }); setCapturingId(null); }}
                  onCancel={() => setCapturingId(null)}
                  onToggle={(id) => updateShortcut(id, { enabled: !s.enabled })}
                  onDelete={deleteShortcut}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ── AppWindow ──────────────────────────────────────────────────────────
function AppWindow({ theme }) {
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
          <div className="nav-item">
            <span className="nav-ic"><IconHome size={14} /></span>
            Home
          </div>
          <div className="nav-item">
            <span className="nav-ic"><IconHeadset size={14} /></span>
            Audio
          </div>
          <div className="nav-item">
            <span className="nav-ic"><IconMonitor size={14} /></span>
            Displays
          </div>
          <div className="nav-item">
            <span className="nav-ic"><IconLayers size={14} /></span>
            Services
          </div>
          <div className="nav-item active">
            <span className="nav-ic"><IconKeyboard size={14} /></span>
            Shortcuts
            <span className="nav-count">{INITIAL_SHORTCUTS.length}</span>
          </div>
          <div className="settings-chip">
            <span className="badge"><IconCog size={12} /></span>
            <span>Settings</span>
            <span className="sp" />
            <span style={{ color: 'var(--color-text-secondary)' }}>⌄</span>
          </div>
        </aside>
        <ShortcutsPage />
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="page" data-screen-label="01 Shortcuts">
      <div className="page-h">
        <h1>Mission Control · Shortcuts page</h1>
        <div className="meta mono">v2 · parametric actions</div>
      </div>
      <p className="page-sub">
        Each action carries an optional parameter — preset name, brightness step,
        display index, etc. The add panel uses two custom dropdowns (Category →
        Action) plus a value field that adapts to the action's parameter type.
        Click any keybind pill in a row to re-record in place; hit
        <span className="kbd mono" style={{ margin: '0 4px' }}>N</span> to add,
        <span className="kbd mono" style={{ margin: '0 4px' }}>⌘K</span> to search.
      </p>

      <div className="demo-toggle">
        <button className={theme === 'dark'  ? 'active' : ''} onClick={() => setTheme('dark')}>dark</button>
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>light</button>
      </div>

      <AppWindow theme={theme} />

      <div className="annot">
        <div className="card">
          <h5>Parametric actions</h5>
          <p>One <span className="mono">sonar.preset-set</span> action takes a preset enum — beats six near-duplicate actions. The IPC layer routes by (actionId, value).</p>
        </div>
        <div className="card">
          <h5>Two-step picker</h5>
          <p>Category first, then Action. Cuts the menu from ~25 items to ~5–8 and surfaces the structure. Action shows a small "Param" hint when one is required.</p>
        </div>
        <div className="card">
          <h5>Value field adapts</h5>
          <p>Enum params → custom dropdown; number params → stepper with min/max/unit. Empty state for parameterless actions.</p>
        </div>
        <div className="card">
          <h5>Custom dropdown</h5>
          <p>Replaces native <span className="mono">&lt;select&gt;</span>: icons + sub captions + arrow-key nav + animated open. Same chassis used for category, action, value, and scope.</p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
