// Plugins page — UI building blocks.
//
// Dropdown:      custom dropdown reused from the shortcuts page.
// PluginCard:    grid card with glyph, name, blurb, status, toggle, footer.
// SectionCard:   wrapper around a list of FormField rows.
// FormField:     schema-driven row dispatcher (text/password/toggle/etc).
// Subcomponents: TextField, PasswordField, ToggleField, SelectField,
//                MultiField, OAuthField, ReadonlyField, ActionField.
//
// All controls follow the Mission Control palette: neutral surfaces,
// hairline borders, no coloured accents (except --color-warn for error
// states and --color-ok for connected statuses, used very sparingly).

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Dropdown (compact custom dropdown) ────────────────────────────────
function Dropdown({ value, options, onChange, placeholder = 'Select…', disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className={`dropdown-trigger ${open ? 'open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={`dd-label ${!selected ? 'placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <IconChevron size={12} />
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox">
          {options.map((o) => {
            const isSelected = o.id === value;
            return (
              <button
                key={o.id || '__none__'}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                onClick={() => { onChange(o.id); setOpen(false); }}
              >
                <span className="dd-label">{o.label}</span>
                {isSelected && <span className="dd-check"><IconCheck size={13} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Status pill (dot + label) ─────────────────────────────────────────
function StatusPill({ status, label }) {
  const preset = STATUS_PRESENT[status] || { label: status, dot: 'disabled' };
  return (
    <span className="status">
      <span className={`status-dot ${preset.dot}`} />
      <span>{label ?? preset.label}</span>
    </span>
  );
}

// ─── Plugin card (grid) ────────────────────────────────────────────────
function PluginCard({ plugin, onConfigure, onToggle }) {
  const installed = plugin.status !== 'not-installed';
  return (
    <button
      type="button"
      className={`pl-card ${!plugin.enabled && installed ? 'disabled' : ''}`}
      onClick={() => installed && onConfigure(plugin.id)}
    >
      <div className={`glyph ${plugin.brand || ''}`}>{plugin.glyph}</div>
      <div className="pl-toggle-wrap">
        {installed ? (
          <span
            className={`toggle ${plugin.enabled ? 'on' : ''}`}
            role="switch"
            aria-checked={plugin.enabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(plugin.id);
            }}
          />
        ) : (
          <span
            className="btn-ghost"
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={(e) => e.stopPropagation()}
          >
            Install
          </span>
        )}
      </div>
      <div className="name">{plugin.name}</div>
      <div className="author">{plugin.author}</div>
      <div className="blurb">{plugin.blurb}</div>
      <div className="footer">
        <StatusPill status={plugin.status} />
        {installed && <span className="status-arrow"><IconChevronRight size={12} /></span>}
      </div>
    </button>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────
function SectionCard({ title, desc, children }) {
  return (
    <div className="cfg-section">
      <div className="cfg-section-h">
        <h3>{title}</h3>
        {desc && <span className="desc">{desc}</span>}
      </div>
      <div className="cfg-section-body">{children}</div>
    </div>
  );
}

// ─── Field row chassis ────────────────────────────────────────────────
function FieldRow({ label, sub, stacked, children }) {
  return (
    <div className={`ff ${stacked ? 'ff-stacked' : ''}`}>
      <div className="ff-label">
        <div className="l">{label}</div>
        {sub && <div className="d">{sub}</div>}
      </div>
      <div className="ff-control">{children}</div>
    </div>
  );
}

// ─── Individual field controls ────────────────────────────────────────
function TextField({ field, value, onChange }) {
  return (
    <input
      type="text"
      className={`input ${field.mono ? 'mono' : ''}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || ''}
    />
  );
}

function PasswordField({ field, value, onChange }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="password-wrap">
        <input
          type={shown ? 'text' : 'password'}
          className="input mono"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="reveal"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide' : 'Show'}
          title={shown ? 'Hide' : 'Show'}
        >
          {shown ? <IconEyeOff size={14} /> : <IconEye size={14} />}
        </button>
      </div>
      {field.hint && (
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
          {field.hint}
        </div>
      )}
    </div>
  );
}

function ToggleField({ value, onChange }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <span
        className={`toggle ${value ? 'on' : ''}`}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      />
    </span>
  );
}

function SelectField({ field, value, onChange }) {
  return (
    <Dropdown
      value={value || ''}
      options={field.options}
      onChange={onChange}
    />
  );
}

function MultiField({ field, value, onChange }) {
  const set = value instanceof Set ? value : new Set(Array.isArray(value) ? value : []);
  const toggle = (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  return (
    <div className="chip-multi" style={{ gridColumn: '1 / -1' }}>
      {field.options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`ms-chip ${set.has(opt.id) ? 'on' : ''}`}
          onClick={() => toggle(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function OAuthField({ field, onReconnect, onDisconnect }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <div className="input mono" style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'default',
        background: 'var(--color-surface-raised)',
      }}>
        <span className="status-dot connected" />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {field.account}
        </span>
        {field.expiresAt && (
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>
            renews in {field.expiresAt}
          </span>
        )}
      </div>
      <button type="button" className="btn-ghost" onClick={onReconnect}>
        <IconRefresh size={13} /> Re-auth
      </button>
      <button type="button" className="btn-ghost danger" onClick={onDisconnect}>
        Disconnect
      </button>
    </div>
  );
}

function ReadonlyField({ field, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span className={`input ${field.mono ? 'mono' : ''}`} style={{
        flex: 1,
        cursor: 'default',
        display: 'flex', alignItems: 'center',
        color: 'var(--color-text-secondary)',
        background: 'transparent',
        borderStyle: 'dashed',
      }}>{value}</span>
      {field.copy && (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            navigator.clipboard?.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}

function ActionField({ field, onAction }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button
        type="button"
        className={`btn-ghost ${field.danger ? 'danger' : ''}`}
        onClick={onAction}
      >
        {field.button}
      </button>
    </span>
  );
}

// Renders the correct control for a field schema.
function FormField({ field, value, onChange, onAction }) {
  const stacked = field.kind === 'multi' || field.kind === 'oauth' || field.kind === 'readonly';
  let control;
  switch (field.kind) {
    case 'text':     control = <TextField field={field} value={value} onChange={onChange} />; break;
    case 'password': control = <PasswordField field={field} value={value} onChange={onChange} />; break;
    case 'toggle':   control = <ToggleField value={value} onChange={onChange} />; break;
    case 'select':   control = <SelectField field={field} value={value} onChange={onChange} />; break;
    case 'multi':    control = <MultiField field={field} value={value} onChange={onChange} />; break;
    case 'oauth':    control = <OAuthField field={field} onReconnect={() => onAction?.('reauth')} onDisconnect={() => onAction?.('disconnect')} />; break;
    case 'readonly': control = <ReadonlyField field={field} value={value} />; break;
    case 'action':   control = <ActionField field={field} onAction={() => onAction?.(field.id)} />; break;
    default:         control = <span className="status">{String(value)}</span>;
  }
  return (
    <FieldRow label={field.label} sub={field.sub} stacked={stacked}>
      {control}
    </FieldRow>
  );
}

Object.assign(window, {
  Dropdown, StatusPill, PluginCard, SectionCard, FieldRow, FormField,
  TextField, PasswordField, ToggleField, SelectField, MultiField,
  OAuthField, ReadonlyField, ActionField,
});
