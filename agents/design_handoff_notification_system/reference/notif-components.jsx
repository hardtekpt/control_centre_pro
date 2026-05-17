// Mission Control — notification components.
//
// Two surface shapes:
//   • NotificationRect — icon + title + (subtitle | slider) + optional tail
//   • NotificationCircle — icon only, 56px round badge
//
// Both follow the design system's neutral palette: acrylic-blurred
// surface, 1px hairline border, no coloured accents, no heavy shadow.
//
// `tail` (rect only) is a small monospace value on the right edge — used
// for things like battery percent or preset code. Keep it ≤ 5 chars.

const { useState, useEffect } = React;

// ── Rectangular ────────────────────────────────────────────────────────
const NotificationRect = React.forwardRef(function NotificationRect(
  { icon, title, subtitle, tail, wide, className = "", ...rest },
  ref
) {
  return (
    <div ref={ref} className={`notif notif-rect ${wide ? 'wide' : ''} ${className}`} {...rest}>
      <div className="ic">{icon}</div>
      <div className="body">
        <div className="title">{title}</div>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {tail && <div className="tail">{tail}</div>}
    </div>
  );
});

// ── Rectangular w/ volume slider ───────────────────────────────────────
// `value` is 0..100. The slider is presentational here — wire to the
// real `VolumeEvent` stream when integrated.
const NotificationVolume = React.forwardRef(function NotificationVolume(
  { icon, label = "Volume", value = 50, className = "", ...rest },
  ref
) {
  return (
    <div ref={ref} className={`notif notif-rect slider wide ${className}`} {...rest}>
      <div className="ic">{icon}</div>
      <div className="body">
        <div className="row1">
          <div className="title">{label}</div>
          <div className="pct">{Math.round(value)}%</div>
        </div>
        <div className="track">
          <div className="fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </div>
      </div>
    </div>
  );
});

// ── Circular ───────────────────────────────────────────────────────────
// Plain icon-only circular notification, 56×56. `dot` adds a small
// status indicator at the top-right (used for "new / active / unread").
const NotificationCircle = React.forwardRef(function NotificationCircle(
  { icon, dot = false, className = "", ...rest },
  ref
) {
  return (
    <div ref={ref} className={`notif notif-circ ${className}`} {...rest}>
      {icon}
      {dot && <span className="circ-dot" />}
    </div>
  );
});

// ── Circular with progress ring ────────────────────────────────────────
// Same footprint as NotificationCircle but wraps a thin ring just inside
// the surface edge that visualises `value` (0..100). Use for percent
// state changes — battery level, volume level, sync progress.
const NotificationCircleRing = React.forwardRef(function NotificationCircleRing(
  { icon, value = 50, className = "", ...rest },
  ref
) {
  const R = 25;                       // inset just inside the 56px circle
  const C = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(100, value));
  const offset = C * (1 - v / 100);
  return (
    <div ref={ref} className={`notif notif-circ ring ${className}`} {...rest}>
      <svg className="ring-svg" width="56" height="56" aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none"
          stroke="var(--color-border)" strokeWidth="2.5" />
        <circle cx="28" cy="28" r={R} fill="none"
          stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 28 28)" />
      </svg>
      <span className="ring-content">{icon}</span>
    </div>
  );
});

// ── Circular with glyph ────────────────────────────────────────────────
// 1–3 character monospace glyph in place of an icon. Use for short
// codes — Sonar preset letters (M/G/S/C), channel (L/R), speed (1x).
const NotificationCircleGlyph = React.forwardRef(function NotificationCircleGlyph(
  { glyph, sub, className = "", ...rest },
  ref
) {
  return (
    <div ref={ref} className={`notif notif-circ glyph ${className}`} {...rest}>
      <span className="glyph-main">{glyph}</span>
      {sub && <span className="glyph-sub">{sub}</span>}
    </div>
  );
});

// ── Stack host ─────────────────────────────────────────────────────────
// A small controller that manages enter/exit animation classes for each
// notification in a queue. Items auto-dismiss after `ttl` ms (default
// 2400). Newest sits at the bottom; older items shift up.
function NotifStack({ items, onDismiss }) {
  return (
    <div className="notif-stack">
      {items.map((it) => (
        <NotifItem key={it.id} item={it} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function NotifItem({ item, onDismiss }) {
  const [phase, setPhase] = useState('enter'); // enter | shown | exit
  useEffect(() => {
    // Mount: enter → shown on next frame.
    const f1 = requestAnimationFrame(() => setPhase('shown'));
    const ttl = item.ttl ?? 2400;
    let t;
    if (Number.isFinite(ttl)) t = setTimeout(() => setPhase('exit'), ttl);
    return () => { cancelAnimationFrame(f1); if (t) clearTimeout(t); };
  }, [item.id]);
  useEffect(() => {
    if (phase !== 'exit') return;
    const t = setTimeout(() => onDismiss(item.id), 320);
    return () => clearTimeout(t);
  }, [phase]);

  const cls = phase; // class hooks to css: .enter / .shown / .exit
  const common = { className: cls, onClick: () => setPhase('exit') };

  if (item.kind === 'circle') {
    return <NotificationCircle icon={item.icon} dot={item.dot} {...common} />;
  }
  if (item.kind === 'ring') {
    return <NotificationCircleRing icon={item.icon} value={item.value} {...common} />;
  }
  if (item.kind === 'glyph') {
    return <NotificationCircleGlyph glyph={item.glyph} sub={item.sub} {...common} />;
  }
  if (item.kind === 'volume') {
    return (
      <NotificationVolume
        icon={item.icon}
        label={item.label}
        value={item.value}
        {...common}
      />
    );
  }
  return (
    <NotificationRect
      icon={item.icon}
      title={item.title}
      subtitle={item.subtitle}
      tail={item.tail}
      wide={item.wide}
      {...common}
    />
  );
}

Object.assign(window, {
  NotificationRect, NotificationVolume,
  NotificationCircle, NotificationCircleRing, NotificationCircleGlyph,
  NotifStack, NotifItem,
});
