import type { ComponentType } from 'react'
import {
  IconMicOff, IconAnc, IconVolUp, IconVolDown, IconVolMute, IconMusic,
  IconPower, IconSwap, IconLock, IconWindow, IconBrightUp, IconBrightDown,
  IconReload, IconMoon, IconHeadset, IconWave, IconMonitor, IconChip, IconLayers,
  IconInput,
} from '../../components/shortcuts/icons'

// ─── Param schemas ────────────────────────────────────────────────────────────

export type ParamSchema =
  | {
      kind: 'enum'
      label: string
      options: Array<{ id: string; label: string }>
    }
  | {
      kind: 'number'
      label: string
      min: number
      max: number
      step: number
      default: number
      unit?: string
      signed?: '+' | '−'
    }
  | {
      kind: 'compound'
      separator: string
      parts: Array<{
        id: string
        label: string
        options: Array<{ id: string; label: string }>
      }>
    }

// ─── Action ───────────────────────────────────────────────────────────────────

export interface Action {
  id: string
  cat: 'arctis' | 'sonar' | 'displays' | 'app'
  label: string
  icon: ComponentType<{ size?: number }>
  param?: ParamSchema
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: 'arctis' | 'sonar' | 'displays' | 'app'
  label: string
  icon: ComponentType<{ size?: number }>
  blurb: string
}

export const CATEGORIES: Category[] = [
  { id: 'arctis',   label: 'Arctis',   icon: IconHeadset, blurb: 'Headset state & I/O'  },
  { id: 'sonar',    label: 'Sonar',    icon: IconWave,    blurb: 'Audio presets & mix'   },
  { id: 'displays', label: 'Displays', icon: IconMonitor, blurb: 'Monitors & brightness' },
  { id: 'app',      label: 'App',      icon: IconChip,    blurb: 'Window & system'       },
]

// ─── Scope ────────────────────────────────────────────────────────────────────

export const SCOPES = [
  { id: 'global',  label: 'Global',       blurb: 'Works anywhere in Windows.' },
  { id: 'focused', label: 'When focused', blurb: 'Only when Mission Control is active.' },
] as const

// ─── Actions catalog ──────────────────────────────────────────────────────────

export const ACTIONS: Action[] = [
  // ── Arctis ──────────────────────────────────────────────────────────────────
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

  // ── Sonar ───────────────────────────────────────────────────────────────────
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

  // ── Displays ────────────────────────────────────────────────────────────────
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
  { id: 'disp.input-source',     cat: 'displays', label: 'Set input source',    icon: IconInput,
    param: {
      kind: 'compound',
      separator: ':',
      parts: [
        {
          id: 'monitor',
          label: 'Display',
          options: [
            { id: '1', label: 'Display 1' },
            { id: '2', label: 'Display 2' },
            { id: '3', label: 'Display 3' },
          ],
        },
        {
          id: 'input',
          label: 'Input',
          options: [
            { id: '0x0f', label: 'DisplayPort 1' },
            { id: '0x10', label: 'DisplayPort 2' },
            { id: '0x11', label: 'HDMI 1' },
            { id: '0x12', label: 'HDMI 2' },
            { id: '0x1b', label: 'USB-C' },
            { id: '0x01', label: 'VGA 1' },
            { id: '0x02', label: 'VGA 2' },
            { id: '0x03', label: 'DVI 1' },
            { id: '0x04', label: 'DVI 2' },
          ],
        },
      ],
    }},
  { id: 'disp.cycle',           cat: 'displays', label: 'Cycle active display', icon: IconSwap },
  { id: 'disp.night-shift',     cat: 'displays', label: 'Toggle night shift',   icon: IconMoon },
  { id: 'disp.refresh',         cat: 'displays', label: 'Refresh detection',    icon: IconReload },

  // ── App ─────────────────────────────────────────────────────────────────────
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
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function actionById(id: string): Action | undefined {
  return ACTIONS.find((a) => a.id === id)
}

export function formatActionValue(action: Action, value: unknown): string | null {
  if (!action.param || value == null) return null
  const p = action.param
  if (p.kind === 'enum') {
    return p.options.find((o) => o.id === value)?.label ?? String(value)
  }
  if (p.kind === 'number') {
    return `${p.signed ?? ''}${value}${p.unit ?? ''}`
  }
  if (p.kind === 'compound') {
    const parts = String(value).split(p.separator)
    const labels = p.parts.map((part, i) =>
      part.options.find((o) => o.id === parts[i])?.label ?? parts[i] ?? ''
    )
    return labels.join(' → ')
  }
  return String(value)
}

export function defaultValueFor(action: Action): string | number | undefined {
  if (!action.param) return undefined
  if (action.param.kind === 'enum') return action.param.options[0]?.id
  if (action.param.kind === 'compound')
    return action.param.parts.map((part) => part.options[0]?.id ?? '').join(action.param.separator)
  return action.param.default
}
