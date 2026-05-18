// Shortcuts page — custom Dropdown + ValueField components.
//
// Dropdown: trigger button matching the .control field style, opens a
// floating menu of options. Each option may carry an `icon` (lucide-
// style component) and a `sub` monospace caption shown on the right.
// Closes on outside click, Esc, or selection. Arrow keys + Enter
// navigate.
//
// ValueField: renders the right control for an action's `param` schema
// — Dropdown for `enum`, stepper for `number`, friendly empty state
// when the action takes no parameter.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Dropdown ───────────────────────────────────────────────────────────
function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  prefixIcon,
  size = 'normal',     // 'normal' | 'compact'
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value),
    [options, value]
  );

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = options[highlight];
        if (opt) { onChange(opt.id); setOpen(false); }
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, options, highlight, onChange]);

  // When opening, seed highlight to currently-selected option.
  useEffect(() => {
    if (open) {
      const ix = options.findIndex((o) => o.id === value);
      setHighlight(ix >= 0 ? ix : 0);
    }
  }, [open, options, value]);

  const SelIcon = selected?.icon;
  const PreIcon = prefixIcon;

  return (
    <div className={`dropdown ${size === 'compact' ? 'compact' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`dropdown-trigger ${open ? 'open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        {PreIcon && <span className="dd-pre"><PreIcon size={14} /></span>}
        {SelIcon && <span className="dd-icon"><SelIcon size={14} /></span>}
        <span className={`dd-label ${!selected ? 'placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.sub && <span className="dd-sub-inline">{selected.sub}</span>}
        <IconChevron size={12} />
      </button>
      {open && (
        <div className="dropdown-menu" ref={menuRef} role="listbox">
          {options.map((o, ix) => {
            const OptIcon = o.icon;
            const isSelected = o.id === value;
            const isHighlight = ix === highlight;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`dropdown-item ${isSelected ? 'selected' : ''} ${isHighlight ? 'highlight' : ''}`}
                onMouseEnter={() => setHighlight(ix)}
                onClick={() => { onChange(o.id); setOpen(false); }}
              >
                {OptIcon && <span className="dd-icon"><OptIcon size={14} /></span>}
                <span className="dd-label">{o.label}</span>
                {o.sub && <span className="dd-sub">{o.sub}</span>}
                {isSelected && (
                  <span className="dd-check"><IconCheck size={13} /></span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── NumberField ────────────────────────────────────────────────────────
// Stepper with −/+ buttons; the value sits centred in monospace. Clamps
// to param.min / max and snaps to param.step. Click the value to type a
// custom number.
function NumberField({ param, value, onChange }) {
  const v = (value === undefined || value === null) ? param.default : value;
  const dec = () => onChange(Math.max(param.min, v - param.step));
  const inc = () => onChange(Math.min(param.max, v + param.step));
  const sign = param.signed === '+' ? '+' : param.signed === '−' ? '−' : '';

  return (
    <div className="number-field control">
      <button
        type="button"
        className="step"
        onClick={dec}
        disabled={v <= param.min}
        aria-label={`Decrease ${param.label}`}
      >
        <IconMinus size={12} />
      </button>
      <span className="value mono">{sign}{v}{param.unit || ''}</span>
      <button
        type="button"
        className="step"
        onClick={inc}
        disabled={v >= param.max}
        aria-label={`Increase ${param.label}`}
      >
        <IconPlus size={12} />
      </button>
    </div>
  );
}

// ── ValueField ─────────────────────────────────────────────────────────
function ValueField({ action, value, onChange }) {
  if (!action) {
    return (
      <div className="no-value">
        <IconChevron size={12} style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
        Choose an action first
      </div>
    );
  }
  if (!action.param) {
    return (
      <div className="no-value">— not required —</div>
    );
  }
  if (action.param.kind === 'enum') {
    return (
      <Dropdown
        value={value}
        options={action.param.options}
        onChange={onChange}
        placeholder={`Select ${action.param.label.toLowerCase()}…`}
      />
    );
  }
  if (action.param.kind === 'number') {
    return <NumberField param={action.param} value={value} onChange={onChange} />;
  }
  return null;
}

Object.assign(window, { Dropdown, NumberField, ValueField });
