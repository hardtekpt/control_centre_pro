// GG Sonar — main app.
//
// Page composition:
//   ┌ Header (Sonar · status · search · EQ details · save) ─────────────────┐
//   ├ Preset chips ─────────────────────────────────────────────────────────┤
//   ├ Output strip (master device + LR meters + headroom) ─────────────────┤
//   ├ ┌ Mixer rail (5 channels + master) ──────────┐ ┌ Auto preset ──────┐ │
//   │ │  apps · fader · meter · dB · M/S · output   │ │  Now active        │ │
//   │ │  (apps draggable between strips)            │ │  Rules → preset    │ │
//   │ └─────────────────────────────────────────────┘ │  + Add rule        │ │
//   │                                                 └────────────────────┘ │
//   └────────────────────────────────────────────────────────────────────────┘
//
// Floating PresetDetailsPopover overlays on demand (EQ curve, description).

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ══════════════════════════════════════════════════════════════════════
//  Channel strip
// ══════════════════════════════════════════════════════════════════════
function ChannelStrip({
  channel, state,
  apps, isDropTarget, dragging,
  output, outputOptions, onChangeOutput,
  level, onLevel, onMute,
  onAppDragStart, onAppDragEnd, onAppDrop,
  faderH, showMeter,
}) {
  const Icon = channel.Icon;
  const takesApps = channel.takesApps;

  const onDragOver = (e) => {
    if (!takesApps) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (e) => {
    if (!takesApps) return;
    e.preventDefault();
    const appId = e.dataTransfer.getData('text/plain');
    if (appId) onAppDrop(appId);
  };

  return (
    <div
      className={`strip ${state.muted ? 'muted' : ''} ${isDropTarget ? 'drop-active' : ''} ${dragging && !takesApps ? 'drop-blocked' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="strip-head">
        <div className="strip-ic"><Icon size={16} /></div>
        <div className="strip-meta">
          <div className="strip-name">{channel.label}</div>
          <div className="strip-sub mono">
            {takesApps ? `${apps.length} app${apps.length === 1 ? '' : 's'}` : 'input'}
          </div>
        </div>
      </div>

      {takesApps ? (
        <div className={`app-zone ${apps.length === 0 ? 'empty' : ''}`}>
          {apps.map((a) => (
            <AppChip
              key={a.id}
              app={a}
              size="sm"
              dragging={dragging === a.id}
              onDragStart={onAppDragStart}
              onDragEnd={onAppDragEnd}
            />
          ))}
          {apps.length === 0 && (
            <div className="app-zone-empty mono">
              <SnPlus size={12} />
              <span>drop app</span>
            </div>
          )}
        </div>
      ) : (
        <div className="app-zone mic-input">
          <span className="mic-tag mono">ARCTIS · MIC IN</span>
        </div>
      )}

      <div className="strip-body">
        <VerticalFader
          value={level}
          onChange={onLevel}
          muted={state.muted}
          height={faderH}
        />
        {showMeter && <LevelMeter peak={state.peak} muted={state.muted} height={faderH} />}
      </div>

      <div className="strip-readout">
        <span className="db mono">
          {dbFor(level)}<span className="db-unit">dB</span>
        </span>
      </div>

      <div className="strip-actions">
        <button
          className={`mute-btn ${state.muted ? 'on' : ''}`}
          onClick={onMute}
          title={state.muted ? 'Unmute' : 'Mute'}
        >M</button>
        <button className="solo-btn" title="Solo">S</button>
      </div>

      <OutputDropdown
        value={output}
        options={outputOptions}
        onChange={onChangeOutput}
        compact
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Master strip
// ══════════════════════════════════════════════════════════════════════
function MasterStrip({ state, output, outputOptions, onChangeOutput, level, onLevel, onMute, faderH, showMeter }) {
  return (
    <div className={`strip master-strip ${state.muted ? 'muted' : ''}`}>
      <div className="strip-head">
        <div className="strip-ic master"><SnSpeaker size={16} /></div>
        <div className="strip-meta">
          <div className="strip-name">Master</div>
          <div className="strip-sub mono">sum bus · 48 k</div>
        </div>
      </div>

      <div className="app-zone master-zone">
        <span className="master-zone-tag mono">SUM OF ALL CHANNELS</span>
      </div>

      <div className="strip-body">
        <VerticalFader
          value={level}
          onChange={onLevel}
          muted={state.muted}
          height={faderH}
        />
        {showMeter && <LevelMeter peak={state.peak} muted={state.muted} height={faderH} />}
      </div>

      <div className="strip-readout">
        <span className="db mono">
          {dbFor(level)}<span className="db-unit">dB</span>
        </span>
      </div>

      <div className="strip-actions">
        <button className={`mute-btn ${state.muted ? 'on' : ''}`} onClick={onMute}>M</button>
      </div>

      <OutputDropdown
        value={output}
        options={outputOptions}
        onChange={onChangeOutput}
        compact
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Preset details popover (floating)
// ══════════════════════════════════════════════════════════════════════
function PresetDetailsPopover({ preset, onClose, anchorRef }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [onClose, anchorRef]);

  const meta = PRESETS.find((p) => p.id === preset);
  const Icon = meta.Icon;
  const props = PRESET_PROPS[preset];
  const eqVals = PRESET_EQ[preset];

  return (
    <div className="preset-popover" ref={wrapRef} role="dialog" aria-label="Preset details">
      <div className="pop-head">
        <span className="pop-ic"><Icon size={14} /></span>
        <div className="pop-title">
          <span className="pop-title-name">{meta.label} preset</span>
          <span className="pop-title-sub mono">{meta.sub}</span>
        </div>
        <button className="pop-close" onClick={onClose} aria-label="Close">
          <SnX size={14} />
        </button>
      </div>

      <div className="pop-body">
        <div className="pop-section">
          <div className="pop-section-h">
            <span className="ds-label">EQ curve</span>
            <span className="ds-sub mono">10 bands · ±12 dB</span>
          </div>
          <div className="eq-frame">
            <EQCurve preset={preset} W={300} H={130} />
            <div className="eq-bands mono">
              {PRESET_BANDS.map((b) => <span key={b}>{b}</span>)}
            </div>
          </div>
          <div className="band-grid">
            {PRESET_BANDS.map((b, i) => {
              const val = eqVals[i];
              const db = (val - 0.5) * 24;
              const cls = db > 0.05 ? 'pos' : db < -0.05 ? 'neg' : 'zero';
              return (
                <div key={b} className={`band-cell ${cls}`}>
                  <span className="band-freq mono">{b}</span>
                  <span className="band-db mono">{bandDbFor(val)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="pop-desc">{PRESET_DESC[preset]}</p>

        <div className="pop-section">
          <div className="pop-section-h">
            <span className="ds-label">Profile</span>
            <span className="ds-sub mono">processing</span>
          </div>
          <div className="prop-grid mono">
            <div className="prop-row"><span className="prop-k">Spatial</span><span className="prop-v">{props.spatial}</span></div>
            <div className="prop-row"><span className="prop-k">Surround</span><span className="prop-v">{props.surround}</span></div>
            <div className="prop-row"><span className="prop-k">Bass boost</span><span className="prop-v">{props.bassBoost}</span></div>
            <div className="prop-row"><span className="prop-k">Dynamics</span><span className="prop-v">{props.dynamics}</span></div>
            <div className="prop-row"><span className="prop-k">Headroom</span><span className="prop-v">{props.headroom}</span></div>
          </div>
        </div>

        <div className="pop-section">
          <div className="pop-section-h">
            <span className="ds-label">Use for</span>
          </div>
          <div className="use-tags">
            {props.use.map((tag) => (
              <span key={tag} className="use-tag mono">{tag}</span>
            ))}
          </div>
        </div>

        <div className="pop-readonly mono">
          <SnInfo size={11} />
          <span>Read-only preview. Editing bands lands in a future build.</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  SonarPage
// ══════════════════════════════════════════════════════════════════════
function SonarPage({ tweaks }) {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [manualPreset, setManualPreset] = useState('game');
  const [query, setQuery] = useState('');

  // App routing — { appId: channelId }
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [draggingApp, setDraggingApp] = useState(null);

  // Per-channel output device — { channelId: outputId }
  const [outputs, setOutputs] = useState(INITIAL_OUTPUTS);
  const [masterOutput, setMasterOutput] = useState('arctis');

  // Auto preset switcher
  const [autoPilot, setAutoPilot] = useState(true);
  const [rules, setRules] = useState(INITIAL_RULES);
  const [activeAppId, setActiveAppId] = useState('cs2');

  // Floating preset details popover
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsBtnRef = useRef(null);

  // Effective preset = auto-rule match (if any & enabled) else manualPreset.
  const matchedRule = rules.find((r) => r.appId === activeAppId);
  const effectivePreset = autoPilot && matchedRule ? matchedRule.preset : manualPreset;

  // Animate peaks.
  useEffect(() => {
    const id = setInterval(() => {
      setLevels((prev) => {
        const out = { ...prev };
        for (const k of Object.keys(out)) {
          const s = out[k];
          if (s.muted) { out[k] = { ...s, peak: Math.max(0, s.peak * 0.6) }; continue; }
          const base = s.level * 0.85;
          const jitter = (Math.random() - 0.45) * 18;
          const target = Math.max(4, Math.min(100, base + jitter));
          out[k] = { ...s, peak: s.peak + (target - s.peak) * 0.35 };
        }
        return out;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Derived: apps per channel.
  const appsByChannel = useMemo(() => {
    const map = { game: [], chat: [], media: [], aux: [] };
    for (const app of APPS) {
      const ch = assignments[app.id];
      if (map[ch]) map[ch].push(app);
    }
    return map;
  }, [assignments]);

  // Handlers
  const setLevel  = (id, v) => setLevels((p) => ({ ...p, [id]: { ...p[id], level: v } }));
  const toggleMute = (id)   => setLevels((p) => ({ ...p, [id]: { ...p[id], muted: !p[id].muted } }));

  const handleAppDrop = (channelId, appId) => {
    setAssignments((prev) => ({ ...prev, [appId]: channelId }));
    setDraggingApp(null);
  };

  const handlePickPreset = (id) => {
    setManualPreset(id);
    // If user clicks a preset, treat it as a manual override → temporarily
    // suspend auto. (Common DAW behaviour.) We just flip autoPilot off for
    // simplicity in this mock; flipping it back on re-applies the rule.
    if (autoPilot) setAutoPilot(false);
  };

  // Auto rules
  const addRule       = (appId, preset) => setRules((r) => [...r, { id: `r${Date.now()}`, appId, preset }]);
  const removeRule    = (id)            => setRules((r) => r.filter((x) => x.id !== id));
  const changeRulePreset = (id, preset) => setRules((r) => r.map((x) => x.id === id ? { ...x, preset } : x));

  const faderH = tweaks.density === 'compact' ? 170 : 210;
  const liveChannels = CHANNELS.filter((c) => !levels[c.id].muted).length;

  return (
    <div className="app-content">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="sn-header">
        <div className="titles">
          <h2>Sonar</h2>
          <div className="sub">
            <span>{liveChannels}/{CHANNELS.length} live</span>
            <span className="pipe">·</span>
            <span>
              preset <span className="mono">{effectivePreset}</span>
              {autoPilot && matchedRule && (
                <span className="auto-tag mono"> · AUTO</span>
              )}
            </span>
          </div>
        </div>
        <div className="actions">
          <label className="sn-search">
            <SnSearch size={14} />
            <input
              placeholder="Search apps, channels, devices…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="kbd-hint">⌘K</span>
          </label>
          <button
            ref={detailsBtnRef}
            className={`sn-btn-ghost ${detailsOpen ? 'on' : ''}`}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            <SnSliders size={14} /> Preset details
          </button>
          <button className="sn-btn-primary">
            <SnSave size={14} /> Save preset
          </button>
        </div>
      </div>

      {/* ── Preset chips ───────────────────────────────────────────── */}
      <div className="sn-presets">
        <PresetChips
          active={effectivePreset}
          onPick={handlePickPreset}
          autoPilot={autoPilot}
          autoPreset={matchedRule?.preset}
        />
      </div>

      {/* ── Output strip (master device + meters) ──────────────────── */}
      <div className="sn-output">
        <div className="out-ic"><SnHeadset size={14} /></div>
        <div className="out-meta">
          <div className="out-name">{OUTPUTS.find((o) => o.id === masterOutput)?.name}</div>
          <div className="out-sub mono">{OUTPUTS.find((o) => o.id === masterOutput)?.sub}</div>
        </div>
        <div className="out-meters">
          <div className="out-lr">
            <span className="out-lr-tag mono">L</span>
            <div className="out-bar"><div className="out-bar-fill" style={{ width: `${levels.master.peak}%` }} /></div>
          </div>
          <div className="out-lr">
            <span className="out-lr-tag mono">R</span>
            <div className="out-bar"><div className="out-bar-fill" style={{ width: `${Math.max(0, levels.master.peak - 4)}%` }} /></div>
          </div>
        </div>
        <div className="out-headroom mono">
          <span className="hr-num">{dbFor(levels.master.level)}</span>
          <span className="hr-unit">dB · master</span>
        </div>
      </div>

      {/* ── Main mixer (full width) ─────────────────────────────────── */}
      <div className={`sn-mixer density-${tweaks.density}`}>
        <div className="mixer-rail">
          {CHANNELS.map((c) => (
            <ChannelStrip
              key={c.id}
              channel={c}
              state={levels[c.id]}
              apps={appsByChannel[c.id] || []}
              isDropTarget={!!draggingApp && c.takesApps}
              dragging={draggingApp}
              output={outputs[c.id]}
              outputOptions={OUTPUTS}
              onChangeOutput={(o) => setOutputs((p) => ({ ...p, [c.id]: o }))}
              level={levels[c.id].level}
              onLevel={(v) => setLevel(c.id, v)}
              onMute={() => toggleMute(c.id)}
              onAppDragStart={(a) => setDraggingApp(a.id)}
              onAppDragEnd={() => setDraggingApp(null)}
              onAppDrop={(appId) => handleAppDrop(c.id, appId)}
              faderH={faderH}
              showMeter={tweaks.meter !== 'off'}
            />
          ))}
          <div className="mixer-divider" />
          <MasterStrip
            state={levels.master}
            output={masterOutput}
            outputOptions={OUTPUTS}
            onChangeOutput={setMasterOutput}
            level={levels.master.level}
            onLevel={(v) => setLevel('master', v)}
            onMute={() => toggleMute('master')}
            faderH={faderH}
            showMeter={tweaks.meter !== 'off'}
          />
        </div>
      </div>

      {/* ── Auto preset switcher (horizontal section below the mixer) ── */}
      <div className="sn-auto-section">
        <AutoPresetSwitcher
          activeAppId={activeAppId}
          onPickActiveApp={setActiveAppId}
          rules={rules}
          onChangePreset={changeRulePreset}
          onRemoveRule={removeRule}
          onAddRule={addRule}
          autoPilot={autoPilot}
          onToggleAuto={() => setAutoPilot((v) => !v)}
          manualPreset={manualPreset}
        />
      </div>

      {/* ── Floating preset details popover ────────────────────────── */}
      {detailsOpen && (
        <PresetDetailsPopover
          preset={effectivePreset}
          anchorRef={detailsBtnRef}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  AppWindow shell (titlebar + sidebar + page)
// ══════════════════════════════════════════════════════════════════════
function AppWindow({ theme, tweaks }) {
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
            <span className="nav-ic"><SnHome size={14} /></span>Home
          </div>
          <div className="nav-item">
            <span className="nav-ic"><SnHeadset size={14} /></span>Arctis
          </div>
          <div className="nav-item active">
            <span className="nav-ic"><SnWave size={14} /></span>Sonar
            <span className="nav-count mono">6</span>
          </div>
          <div className="nav-item">
            <span className="nav-ic"><SnMonitor size={14} /></span>Displays
          </div>
          <div className="nav-item">
            <span className="nav-ic"><SnLayers size={14} /></span>Services
          </div>
          <div className="nav-item">
            <span className="nav-ic"><SnKeyboard size={14} /></span>Shortcuts
            <span className="nav-count mono">20</span>
          </div>
          <div className="settings-chip">
            <span className="badge"><SnCog size={12} /></span>
            <span>Settings</span>
            <span className="sp" />
            <span style={{ color: 'var(--color-text-secondary)' }}>⌄</span>
          </div>
        </aside>
        <SonarPage tweaks={tweaks} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Root
// ══════════════════════════════════════════════════════════════════════
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme":   "dark",
  "density": "comfortable",
  "meter":   "segments"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
  }, [tweaks.theme]);

  return (
    <div className="page" data-screen-label="01 Sonar">
      <div className="page-h">
        <h1>Mission Control · Sonar</h1>
        <div className="meta mono">v2 · mixer + auto presets</div>
      </div>
      <p className="page-sub">
        Per-app channel mixing with draggable app routing, per-channel output
        device picker, and an auto-preset rule engine that switches the EQ
        profile based on the foreground app.
      </p>

      <div className="demo-toggle">
        <button className={tweaks.theme === 'dark'  ? 'active' : ''} onClick={() => setTweak('theme', 'dark')}>dark</button>
        <button className={tweaks.theme === 'light' ? 'active' : ''} onClick={() => setTweak('theme', 'light')}>light</button>
      </div>

      <AppWindow theme={tweaks.theme} tweaks={tweaks} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio
          label="Mode"
          value={tweaks.theme}
          options={['dark', 'light']}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakSection label="Mixer" />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={['compact', 'comfortable']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakRadio
          label="Meter"
          value={tweaks.meter}
          options={['segments', 'off']}
          onChange={(v) => setTweak('meter', v)}
        />
      </TweaksPanel>

      <div className="annot">
        <div className="card">
          <h5>Drag apps to reroute</h5>
          <p>Each app lives as a chip on its assigned channel. Drag a chip to another strip to reassign it — the drop target highlights as you go.</p>
        </div>
        <div className="card">
          <h5>Per-channel output</h5>
          <p>The chevron button at the bottom of every strip opens a small picker for the destination device (headphones, monitors, stream mix, system default).</p>
        </div>
        <div className="card">
          <h5>Auto preset switcher</h5>
          <p>Bind apps to presets in the right panel. When that app comes into the foreground, Sonar swaps presets automatically. Toggle the switch to pause auto.</p>
        </div>
        <div className="card">
          <h5>Preset details on demand</h5>
          <p>The "Preset details" button in the header opens a floating panel with the EQ curve, per-band dB values, processing profile (spatial, surround, bass, dynamics, headroom) and recommended use cases.</p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

window.TWEAK_DEFAULTS = TWEAK_DEFAULTS;
