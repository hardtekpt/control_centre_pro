// GG Sonar — Auto Preset Switcher panel.
//
// Right column of the page. Sections:
//   1. "Now active" — current foreground app + the rule (if any) that matched.
//   2. "Rules" — editable list of {app → preset} bindings.
//   3. "+ Add rule" — inline picker that drops a new rule into the list.

const { useState: useStateS, useRef: useRefS, useEffect: useEffectS } = React;

// ── NowActiveCard ──────────────────────────────────────────────────────
function NowActiveCard({ activeApp, matchedRule, autoPilot, manualPreset, onPickActiveApp, allApps }) {
  const [pickerOpen, setPickerOpen] = useStateS(false);
  const wrapRef = useRefS(null);

  useEffectS(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const matchedPreset = matchedRule
    ? PRESETS.find((p) => p.id === matchedRule.preset)
    : null;

  return (
    <div className="aps-now">
      <div className="aps-now-h">
        <span className="aps-label">Now active</span>
      </div>

      <div className="now-card" ref={wrapRef}>
        <button
          className="now-app"
          onClick={() => setPickerOpen((v) => !v)}
          title="Simulate a different foreground app"
        >
          <AppChip app={activeApp} size="md" draggable={false} />
          <div className="now-meta">
            <div className="now-app-name">{activeApp.name}</div>
            <div className="now-app-sub mono">foreground · pid 1042</div>
          </div>
          <SnChevron size={14} />
        </button>

        {pickerOpen && (
          <div className="now-picker">
            <div className="dd-menu-h mono">Simulate foreground</div>
            {allApps.map((a) => (
              <button
                key={a.id}
                className={`dd-opt ${a.id === activeApp.id ? 'sel' : ''}`}
                onClick={() => { onPickActiveApp(a.id); setPickerOpen(false); }}
              >
                <AppChip app={a} size="xs" draggable={false} />
                <span className="dd-opt-text">
                  <span className="dd-opt-name">{a.name}</span>
                </span>
                {a.id === activeApp.id && <SnCheck size={14} />}
              </button>
            ))}
          </div>
        )}

        <div className="now-result">
          {autoPilot && matchedPreset ? (
            <>
              <span className="now-result-tag mono">→ APPLIED</span>
              <span className="now-result-name">{matchedPreset.label}</span>
              <span className="now-result-sub mono">via rule</span>
            </>
          ) : !autoPilot ? (
            <>
              <span className="now-result-tag mono">→ MANUAL</span>
              <span className="now-result-name">
                {PRESETS.find((p) => p.id === manualPreset)?.label}
              </span>
              <span className="now-result-sub mono">auto off</span>
            </>
          ) : (
            <>
              <span className="now-result-tag mono">→ FALLBACK</span>
              <span className="now-result-name">
                {PRESETS.find((p) => p.id === manualPreset)?.label}
              </span>
              <span className="now-result-sub mono">no rule</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RuleRow ────────────────────────────────────────────────────────────
function RuleRow({ rule, isActive, onChangePreset, onRemove }) {
  const [editing, setEditing] = useStateS(false);
  const wrapRef = useRefS(null);
  const app = APPS.find((a) => a.id === rule.appId);
  const preset = PRESETS.find((p) => p.id === rule.preset);

  useEffectS(() => {
    if (!editing) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setEditing(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [editing]);

  return (
    <li className={`rule-row ${isActive ? 'matched' : ''}`} ref={wrapRef}>
      <AppChip app={app} size="sm" draggable={false} />
      <div className="rule-app-name" title={app.name}>{app.name}</div>
      <span className="rule-arrow mono">→</span>
      <button
        className={`rule-preset ${editing ? 'open' : ''}`}
        onClick={() => setEditing((v) => !v)}
      >
        <preset.Icon size={12} />
        <span>{preset.label}</span>
        <SnChevron size={10} />
      </button>
      <button className="rule-del" onClick={onRemove} title="Remove rule">
        <SnTrash size={12} />
      </button>
      {editing && (
        <div className="rule-preset-menu">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`dd-opt ${p.id === rule.preset ? 'sel' : ''}`}
              onClick={() => { onChangePreset(p.id); setEditing(false); }}
            >
              <span className="dd-opt-ic"><p.Icon size={14} /></span>
              <span className="dd-opt-text">
                <span className="dd-opt-name">{p.label}</span>
                <span className="dd-opt-sub mono">{p.sub}</span>
              </span>
              {p.id === rule.preset && <SnCheck size={14} />}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

// ── AddRuleForm ────────────────────────────────────────────────────────
function AddRuleForm({ availableApps, onAdd }) {
  const [open, setOpen] = useStateS(false);
  const [pickedApp, setPickedApp] = useStateS(availableApps[0]?.id);
  const [pickedPreset, setPickedPreset] = useStateS(PRESETS[1].id);

  // Keep app selection valid if the available pool shrinks.
  useEffectS(() => {
    if (!availableApps.find((a) => a.id === pickedApp)) {
      setPickedApp(availableApps[0]?.id);
    }
  }, [availableApps, pickedApp]);

  if (!open) {
    return (
      <button
        className="add-rule-btn"
        onClick={() => setOpen(true)}
        disabled={availableApps.length === 0}
      >
        <SnPlus size={12} />
        <span>{availableApps.length === 0 ? 'All apps have rules' : 'Add rule'}</span>
      </button>
    );
  }

  return (
    <div className="add-rule-form">
      <div className="arf-row">
        <span className="arf-label mono">When</span>
        <select
          className="arf-select"
          value={pickedApp || ''}
          onChange={(e) => setPickedApp(e.target.value)}
        >
          {availableApps.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="arf-row">
        <span className="arf-label mono">apply</span>
        <select
          className="arf-select"
          value={pickedPreset}
          onChange={(e) => setPickedPreset(e.target.value)}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label} — {p.sub}</option>
          ))}
        </select>
      </div>
      <div className="arf-actions">
        <button className="arf-cancel" onClick={() => setOpen(false)}>Cancel</button>
        <button
          className="arf-save"
          onClick={() => {
            if (!pickedApp) return;
            onAdd(pickedApp, pickedPreset);
            setOpen(false);
          }}
        >
          <SnCheck size={12} /> Save rule
        </button>
      </div>
    </div>
  );
}

// ── AutoPresetSwitcher (panel root, horizontal section) ───────────────
function AutoPresetSwitcher({
  activeAppId, onPickActiveApp,
  rules, onChangePreset, onRemoveRule, onAddRule,
  autoPilot, onToggleAuto,
  manualPreset,
}) {
  const activeApp = APPS.find((a) => a.id === activeAppId) || APPS[0];
  const matchedRule = rules.find((r) => r.appId === activeAppId);
  const ruledAppIds = new Set(rules.map((r) => r.appId));
  const availableApps = APPS.filter((a) => !ruledAppIds.has(a.id));

  return (
    <section className="aps">
      <header className="aps-titlebar">
        <span className="aps-titlebar-ic"><SnBolt size={14} /></span>
        <div className="aps-titlebar-text">
          <div className="aps-title">Auto preset</div>
          <div className="aps-titlesub mono">switch presets based on the foreground app · {rules.length} rule{rules.length === 1 ? '' : 's'}</div>
        </div>
        <div className="aps-titlebar-status">
          <span className={`aps-status ${autoPilot ? 'on' : 'off'}`}>
            <span className="aps-dot" />
            {autoPilot ? 'AUTO ON' : 'AUTO OFF'}
          </span>
          <button
            className={`aps-switch ${autoPilot ? 'on' : ''}`}
            onClick={onToggleAuto}
            role="switch"
            aria-checked={autoPilot}
            title={autoPilot ? 'Disable auto-switching' : 'Enable auto-switching'}
          >
            <span className="aps-switch-knob" />
          </button>
        </div>
      </header>

      <div className="aps-body">
        <NowActiveCard
          activeApp={activeApp}
          matchedRule={matchedRule}
          autoPilot={autoPilot}
          manualPreset={manualPreset}
          onPickActiveApp={onPickActiveApp}
          allApps={APPS}
        />

        <div className="aps-rules">
          <div className="aps-rules-h">
            <span className="aps-label">Rules <span className="aps-count mono">{rules.length}</span></span>
            {!autoPilot && <span className="aps-hint mono">paused</span>}
          </div>
          <ul className="rules-grid">
            {rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                isActive={autoPilot && r.appId === activeAppId}
                onChangePreset={(p) => onChangePreset(r.id, p)}
                onRemove={() => onRemoveRule(r.id)}
              />
            ))}
            <li className="rule-add-cell">
              <AddRuleForm
                availableApps={availableApps}
                onAdd={onAddRule}
              />
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { AutoPresetSwitcher });
