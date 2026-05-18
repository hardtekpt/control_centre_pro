// Shortcuts page — action catalog + initial shortcuts (v2 with params).
//
// Actions now consolidate per behaviour, with an optional `param` schema
// that drives a value field in the create/edit form. This means
// "Set preset · Music" and "Set preset · Game" are the same action with
// different parameter values — the main process routes by (actionId,
// value) rather than needing N separate actions.
//
// Param kinds:
//   - 'enum'   → fixed list of options (e.g. preset name, display, channel)
//   - 'number' → numeric input with min/max/step/unit; `signed: '+'|'-'`
//                prefixes the displayed value (for delta actions like
//                "Volume up +5%")

const CATEGORIES = [
  { id: 'arctis',   label: 'Arctis',   icon: IconHeadset, blurb: 'Headset state & I/O'  },
  { id: 'sonar',    label: 'Sonar',    icon: IconWave,    blurb: 'Audio presets & mix'   },
  { id: 'displays', label: 'Displays', icon: IconMonitor, blurb: 'Monitors & brightness' },
  { id: 'app',      label: 'App',      icon: IconChip,    blurb: 'Window & system'       },
];

const ACTIONS = [
  // ── Arctis ──────────────────────────────────────────────────────────
  { id: 'arctis.mute',          cat: 'arctis', label: 'Toggle mic mute',     icon: IconMicOff },
  { id: 'arctis.anc-cycle',     cat: 'arctis', label: 'Cycle ANC mode',      icon: IconAnc },
  { id: 'arctis.anc-set',       cat: 'arctis', label: 'Set ANC mode',        icon: IconAnc,
    param: { kind: 'enum', label: 'Mode',
      options: [
        { id: 'off',   label: 'Off' },
        { id: 'trans', label: 'Transparency' },
        { id: 'anc',   label: 'Active' },
      ]}},
  { id: 'arctis.vol-up',        cat: 'arctis', label: 'Volume up',           icon: IconVolUp,
    param: { kind: 'number', label: 'Step', min: 1, max: 25, step: 1, default: 5, unit: '%', signed: '+' }},
  { id: 'arctis.vol-down',      cat: 'arctis', label: 'Volume down',         icon: IconVolDown,
    param: { kind: 'number', label: 'Step', min: 1, max: 25, step: 1, default: 5, unit: '%', signed: '−' }},
  { id: 'arctis.vol-set',       cat: 'arctis', label: 'Set volume',          icon: IconVolUp,
    param: { kind: 'number', label: 'Volume', min: 0, max: 100, step: 5, default: 60, unit: '%' }},
  { id: 'arctis.output-mute',   cat: 'arctis', label: 'Toggle output mute',  icon: IconVolMute },
  { id: 'arctis.sidetone',      cat: 'arctis', label: 'Set sidetone',        icon: IconAnc,
    param: { kind: 'number', label: 'Level', min: 0, max: 100, step: 10, default: 30, unit: '%' }},
  { id: 'arctis.power',         cat: 'arctis', label: 'Power off headset',   icon: IconPower },

  // ── Sonar ───────────────────────────────────────────────────────────
  { id: 'sonar.preset-set',     cat: 'sonar', label: 'Set audio preset',    icon: IconMusic,
    param: { kind: 'enum', label: 'Preset',
      options: [
        { id: 'music',   label: 'Music' },
        { id: 'game',    label: 'Game' },
        { id: 'studio',  label: 'Studio' },
        { id: 'cinema',  label: 'Cinema' },
        { id: 'speech',  label: 'Speech' },
        { id: 'flat',    label: 'Flat' },
      ]}},
  { id: 'sonar.preset-cycle',   cat: 'sonar', label: 'Cycle next preset',   icon: IconSwap },
  { id: 'sonar.channel-up',     cat: 'sonar', label: 'Channel volume up',   icon: IconVolUp,
    param: { kind: 'enum', label: 'Channel',
      options: [
        { id: 'game',  label: 'Game' },
        { id: 'chat',  label: 'Chat' },
        { id: 'media', label: 'Media' },
        { id: 'aux',   label: 'Aux' },
        { id: 'mic',   label: 'Mic' },
      ]}},
  { id: 'sonar.channel-down',   cat: 'sonar', label: 'Channel volume down', icon: IconVolDown,
    param: { kind: 'enum', label: 'Channel',
      options: [
        { id: 'game',  label: 'Game' },
        { id: 'chat',  label: 'Chat' },
        { id: 'media', label: 'Media' },
        { id: 'aux',   label: 'Aux' },
        { id: 'mic',   label: 'Mic' },
      ]}},
  { id: 'sonar.master-up',      cat: 'sonar', label: 'Master volume up',    icon: IconVolUp,
    param: { kind: 'number', label: 'Step', min: 1, max: 25, step: 1, default: 5, unit: '%', signed: '+' }},
  { id: 'sonar.master-down',    cat: 'sonar', label: 'Master volume down',  icon: IconVolDown,
    param: { kind: 'number', label: 'Step', min: 1, max: 25, step: 1, default: 5, unit: '%', signed: '−' }},

  // ── Displays ────────────────────────────────────────────────────────
  { id: 'disp.brightness-up',   cat: 'displays', label: 'Brightness up',    icon: IconBrightUp,
    param: { kind: 'number', label: 'Step', min: 5, max: 25, step: 5, default: 10, unit: '%', signed: '+' }},
  { id: 'disp.brightness-down', cat: 'displays', label: 'Brightness down',  icon: IconBrightDown,
    param: { kind: 'number', label: 'Step', min: 5, max: 25, step: 5, default: 10, unit: '%', signed: '−' }},
  { id: 'disp.brightness-set',  cat: 'displays', label: 'Set brightness',   icon: IconBrightUp,
    param: { kind: 'number', label: 'Brightness', min: 0, max: 100, step: 10, default: 80, unit: '%' }},
  { id: 'disp.activate',        cat: 'displays', label: 'Activate display', icon: IconMonitor,
    param: { kind: 'enum', label: 'Display',
      options: [
        { id: '1', label: 'Display 1 (Primary)' },
        { id: '2', label: 'Display 2' },
        { id: '3', label: 'Display 3' },
      ]}},
  { id: 'disp.cycle',           cat: 'displays', label: 'Cycle active display', icon: IconSwap },
  { id: 'disp.night-shift',     cat: 'displays', label: 'Toggle night shift',   icon: IconMoon },
  { id: 'disp.refresh',         cat: 'displays', label: 'Refresh detection',    icon: IconReload },

  // ── App ─────────────────────────────────────────────────────────────
  { id: 'app.toggle',           cat: 'app', label: 'Show / hide window',    icon: IconWindow },
  { id: 'app.lock',             cat: 'app', label: 'Lock workstation',      icon: IconLock },
  { id: 'app.quit',             cat: 'app', label: 'Quit Mission Control',  icon: IconPower },
  { id: 'app.reload-service',   cat: 'app', label: 'Reload service',        icon: IconReload,
    param: { kind: 'enum', label: 'Service',
      options: [
        { id: 'all',        label: 'All services' },
        { id: 'arctis-hid', label: 'Arctis HID' },
        { id: 'sonar',      label: 'Sonar' },
      ]}},
  { id: 'app.go-to-page',       cat: 'app', label: 'Open page',             icon: IconLayers,
    param: { kind: 'enum', label: 'Page',
      options: [
        { id: 'home',      label: 'Home' },
        { id: 'audio',     label: 'Audio' },
        { id: 'displays',  label: 'Displays' },
        { id: 'services',  label: 'Services' },
        { id: 'shortcuts', label: 'Shortcuts' },
        { id: 'settings',  label: 'Settings' },
      ]}},
];

const SCOPES = [
  { id: 'global',  label: 'Global',       blurb: 'Works anywhere in Windows.' },
  { id: 'focused', label: 'When focused', blurb: 'Only when Mission Control is active.' },
];

// Helpers ──────────────────────────────────────────────────────────────
const actionById = (id) => ACTIONS.find((a) => a.id === id);

// Formatted value string used in the shortcut row (next to action label)
// and the new-shortcut panel review summary.
function formatActionValue(action, value) {
  if (!action || !action.param) return null;
  if (value === undefined || value === null) return null;
  const p = action.param;
  if (p.kind === 'enum') {
    const opt = p.options.find((o) => o.id === value);
    return opt ? opt.label : String(value);
  }
  if (p.kind === 'number') {
    const sign = p.signed || '';
    return `${sign}${value}${p.unit || ''}`;
  }
  return String(value);
}

// Initial defaults. New shortcuts default to a sensible param value
// (enum: first option; number: param.default).
function defaultValueFor(action) {
  if (!action || !action.param) return undefined;
  if (action.param.kind === 'enum') return action.param.options[0]?.id;
  if (action.param.kind === 'number') return action.param.default;
  return undefined;
}

// Initial shortcuts. Use the new consolidated actions + values.
const INITIAL_SHORTCUTS = [
  { id: 's1',  actionId: 'arctis.mute',          keys: ['Ctrl','Shift','M'], scope: 'global',  enabled: true  },
  { id: 's2',  actionId: 'arctis.anc-cycle',     keys: ['Ctrl','Alt','A'],   scope: 'global',  enabled: true  },
  { id: 's3',  actionId: 'arctis.anc-set',       value: 'trans',
                                                  keys: ['Ctrl','Alt','T'],   scope: 'global',  enabled: true  },
  { id: 's4',  actionId: 'arctis.vol-up',        value: 5,
                                                  keys: ['Ctrl',']'],         scope: 'global',  enabled: true  },
  { id: 's5',  actionId: 'arctis.vol-down',      value: 5,
                                                  keys: ['Ctrl','['],         scope: 'global',  enabled: true  },
  { id: 's6',  actionId: 'arctis.sidetone',      value: 30,
                                                  keys: ['Ctrl','Alt','S'],   scope: 'focused', enabled: false },

  { id: 's7',  actionId: 'sonar.preset-set',     value: 'music',
                                                  keys: ['Ctrl','Alt','1'],   scope: 'focused', enabled: true  },
  { id: 's8',  actionId: 'sonar.preset-set',     value: 'game',
                                                  keys: ['Ctrl','Alt','2'],   scope: 'focused', enabled: true  },
  { id: 's9',  actionId: 'sonar.preset-set',     value: 'studio',
                                                  keys: ['Ctrl','Alt','3'],   scope: 'focused', enabled: true  },
  { id: 's10', actionId: 'sonar.preset-cycle',   keys: ['Ctrl','Alt','`'],   scope: 'global',  enabled: true  },
  { id: 's11', actionId: 'sonar.channel-up',     value: 'game',
                                                  keys: ['Ctrl','Shift','='], scope: 'focused', enabled: true  },
  { id: 's12', actionId: 'sonar.channel-down',   value: 'game',
                                                  keys: ['Ctrl','Shift','-'], scope: 'focused', enabled: true  },

  { id: 's13', actionId: 'disp.brightness-up',   value: 10,
                                                  keys: ['Ctrl','Alt','F2'],  scope: 'global',  enabled: true  },
  { id: 's14', actionId: 'disp.brightness-down', value: 10,
                                                  keys: ['Ctrl','Alt','F1'],  scope: 'global',  enabled: true  },
  { id: 's15', actionId: 'disp.activate',        value: '1',
                                                  keys: ['Ctrl','Shift','1'], scope: 'global',  enabled: true  },
  { id: 's16', actionId: 'disp.activate',        value: '2',
                                                  keys: ['Ctrl','Shift','2'], scope: 'global',  enabled: true  },
  { id: 's17', actionId: 'disp.night-shift',     keys: ['Ctrl','Alt','N'],   scope: 'global',  enabled: false },

  { id: 's18', actionId: 'app.toggle',           keys: ['Ctrl','Shift','Space'], scope: 'global', enabled: true  },
  { id: 's19', actionId: 'app.go-to-page',       value: 'shortcuts',
                                                  keys: ['Ctrl','Shift','K'], scope: 'focused', enabled: true  },
  { id: 's20', actionId: 'app.reload-service',   value: 'all',
                                                  keys: ['Ctrl','Shift','R'], scope: 'focused', enabled: true  },
];

// ── Key combo helpers ──────────────────────────────────────────────────
const MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];

function keyTokenFromEvent(e) {
  const k = e.key;
  if (k === 'Control' || k === 'Alt' || k === 'Shift' || k === 'Meta') return null;
  if (k === ' ')          return 'Space';
  if (k === 'ArrowUp')    return '↑';
  if (k === 'ArrowDown')  return '↓';
  if (k === 'ArrowLeft')  return '←';
  if (k === 'ArrowRight') return '→';
  if (k === 'Escape')     return 'Esc';
  if (k === 'Enter')      return 'Enter';
  if (k === 'Tab')        return 'Tab';
  if (k === 'Backspace')  return 'Backspace';
  if (k === 'Delete')     return 'Del';
  if (/^F\d{1,2}$/.test(k)) return k;
  if (k.length === 1) return k.toUpperCase();
  return k;
}

function combinationFromEvent(e) {
  const mods = [];
  if (e.ctrlKey)  mods.push('Ctrl');
  if (e.altKey)   mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey)  mods.push('Meta');
  const base = keyTokenFromEvent(e);
  if (!base) return null;
  return [...mods, base];
}

function formatCombo(keys) { return keys.join(' + '); }
function combosEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((k, i) => k === b[i]);
}

Object.assign(window, {
  CATEGORIES, ACTIONS, SCOPES, INITIAL_SHORTCUTS,
  MOD_ORDER, actionById, formatActionValue, defaultValueFor,
  keyTokenFromEvent, combinationFromEvent, formatCombo, combosEqual,
});
