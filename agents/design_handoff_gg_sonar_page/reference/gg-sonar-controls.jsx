// GG Sonar — primitive controls.
//   VerticalFader, LevelMeter, AppChip, OutputDropdown, EQCurve, PresetChips

const { useState: useStateC, useRef: useRefC, useEffect: useEffectC, useCallback: useCallbackC } = React;

// ── VerticalFader ──────────────────────────────────────────────────────
function VerticalFader({ value, onChange, muted, height = 220 }) {
  const trackRef = useRefC(null);
  const [dragging, setDragging] = useStateC(false);

  const setFromPointer = useCallbackC((clientY) => {
    const rect = trackRef.current.getBoundingClientRect();
    const pct = 1 - (clientY - rect.top) / rect.height;
    const v = Math.min(100, Math.max(0, Math.round(pct * 100)));
    onChange(v);
  }, [onChange]);

  const onPointerDown = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(true);
    setFromPointer(e.clientY);
    const move = (ev) => setFromPointer(ev.clientY);
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(Math.min(100, value + 1)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0,   value - 1)); }
    if (e.key === 'PageUp')    { e.preventDefault(); onChange(Math.min(100, value + 10)); }
    if (e.key === 'PageDown')  { e.preventDefault(); onChange(Math.max(0,   value - 10)); }
  };

  const ticks = [
    { pct: 0,   label: '0',   bold: true },
    { pct: 15,  label: '-6'  },
    { pct: 30,  label: '-12' },
    { pct: 50,  label: '-20' },
    { pct: 75,  label: '-40' },
    { pct: 100, label: '-∞', bold: true },
  ];

  return (
    <div className="fader-wrap" style={{ height }}>
      <div className="fader-ticks">
        {ticks.map((t) => (
          <div key={t.pct} className={`tick ${t.bold ? 'bold' : ''}`} style={{ top: `${t.pct}%` }}>
            <span className="tick-line" />
            <span className="tick-num">{t.label}</span>
          </div>
        ))}
      </div>
      <div
        ref={trackRef}
        className={`fader-track ${dragging ? 'dragging' : ''} ${muted ? 'muted' : ''}`}
        onPointerDown={onPointerDown}
        tabIndex={0}
        onKeyDown={onKey}
        role="slider"
        aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
      >
        <div className="fader-fill" style={{ height: `${value}%` }} />
        <div className="fader-thumb" style={{ bottom: `calc(${value}% - 7px)` }}>
          <span className="fader-thumb-line" />
        </div>
      </div>
    </div>
  );
}

// ── LevelMeter ─────────────────────────────────────────────────────────
function LevelMeter({ peak, muted, segments = 18, height = 220 }) {
  const active = muted ? 0 : Math.round(Math.sqrt(peak / 100) * segments);
  const cells = [];
  for (let i = 0; i < segments; i++) {
    const fromTop = i;
    const isActive = fromTop >= (segments - active);
    let cls = 'm-cell';
    if (fromTop < 2)       cls += ' m-clip';
    else if (fromTop < 6)  cls += ' m-hot';
    else                   cls += ' m-norm';
    if (isActive) cls += ' on';
    cells.push(<div key={i} className={cls} />);
  }
  return <div className="meter" style={{ height }}>{cells}</div>;
}

// ── AppChip ────────────────────────────────────────────────────────────
// Draggable app tile. `size` is "xs" | "sm" | "md".
function AppChip({ app, size = 'sm', draggable = true, dragging, onDragStart, onDragEnd, onClick, showLabel = false, isActive = false }) {
  if (!app) return null;
  return (
    <div
      className={`app-chip size-${size} ${dragging ? 'dragging' : ''} ${isActive ? 'active' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', app.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(app);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={(e) => { e.stopPropagation(); onClick?.(app); }}
      title={app.name}
      style={{ '--app-accent': app.accent }}
    >
      <span className="app-tile mono">{app.monogram}</span>
      {showLabel && (
        <div className="app-text">
          <span className="app-name">{app.name}</span>
        </div>
      )}
      {draggable && size !== 'md' && (
        <span className="app-grip" aria-hidden="true">
          <SnGrip size={10} />
        </span>
      )}
    </div>
  );
}

// ── OutputDropdown ─────────────────────────────────────────────────────
// Small popover-style selector. Closes on outside click + Escape.
function OutputDropdown({ value, options, onChange, compact = false }) {
  const [open, setOpen] = useStateC(false);
  const wrapRef = useRefC(null);
  const selected = options.find((o) => o.id === value) || options[0];

  useEffectC(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const Icon = selected.Icon || SnHeadset;

  return (
    <div className={`out-dd ${compact ? 'compact' : ''}`} ref={wrapRef}>
      <button
        className={`out-dd-btn ${open ? 'open' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={`Output: ${selected.name}`}
      >
        <SnArrow size={10} />
        <span className="out-dd-ic"><Icon size={12} /></span>
        <span className="out-dd-name">{selected.name}</span>
        <SnChevron size={10} />
      </button>
      {open && (
        <div className="out-dd-menu">
          <div className="dd-menu-h mono">Route to</div>
          {options.map((opt) => {
            const OIcon = opt.Icon || SnHeadset;
            const sel = opt.id === value;
            return (
              <button
                key={opt.id}
                className={`dd-opt ${sel ? 'sel' : ''}`}
                onClick={(e) => { e.stopPropagation(); onChange(opt.id); setOpen(false); }}
              >
                <span className="dd-opt-ic"><OIcon size={14} /></span>
                <span className="dd-opt-text">
                  <span className="dd-opt-name">{opt.name}</span>
                  <span className="dd-opt-sub mono">{opt.sub}</span>
                </span>
                {sel && <SnCheck size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── EQCurve ────────────────────────────────────────────────────────────
function EQCurve({ preset, W = 260, H = 120 }) {
  const data = PRESET_EQ[preset] || PRESET_EQ.flat;
  const step = W / (data.length - 1);
  const points = data.map((v, i) => [i * step, (1 - v) * H]);
  const path = points.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(' ');
  const area = path + ` L${W} ${H} L0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="eq-curve" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1="0" x2={W} y1={p * H} y2={p * H} className="eq-grid" />
      ))}
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="eq-zero" />
      <path d={area} fill="url(#eqfill)" />
      <path d={path} className="eq-line" fill="none" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" className="eq-node" />
      ))}
    </svg>
  );
}

// ── PresetChips ────────────────────────────────────────────────────────
function PresetChips({ active, onPick, autoPilot, autoPreset }) {
  return (
    <div className="preset-row">
      {PRESETS.map((p) => {
        const Icon = p.Icon;
        const isActive = p.id === active;
        const isAuto   = autoPilot && p.id === autoPreset;
        return (
          <button
            key={p.id}
            className={`preset-chip ${isActive ? 'active' : ''} ${isAuto ? 'auto' : ''}`}
            onClick={() => onPick(p.id)}
            title={isAuto ? 'Auto-selected by rule' : p.sub}
          >
            <span className="pc-icon"><Icon size={14} /></span>
            <span className="pc-label">{p.label}</span>
            <span className="pc-sub mono">{p.sub}</span>
            {isAuto && <span className="pc-auto-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  VerticalFader, LevelMeter, AppChip, OutputDropdown, EQCurve, PresetChips,
});
