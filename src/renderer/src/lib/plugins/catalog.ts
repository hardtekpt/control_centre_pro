import type { Plugin } from '@shared/types'

export const DEFAULT_PLUGINS: Plugin[] = [
  {
    id: 'kvm-detector',
    name: 'KVM Detector',
    glyph: 'K',
    author: 'mission-control.kvm',
    version: '1.0.0',
    blurb: 'Track KVM connection state and auto-switch display inputs.',
    status: 'disabled',
    enabled: false,
    statusLine: 'Not configured',
    category: 'peripheral',
    sections: [],
  },
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    glyph: 'H',
    author: 'mission-control.ha',
    version: '1.0.0',
    blurb: 'Monitor entities and control devices in your Home Assistant instance.',
    status: 'disabled',
    enabled: false,
    statusLine: 'Not configured',
    category: 'smart-home',
    sections: [],
  },
  {
    id: 'resource-monitor',
    name: 'Resource Monitor',
    glyph: 'R',
    author: 'mission-control.resource',
    version: '1.0.0',
    blurb: 'Live CPU, RAM, GPU, storage, and network usage statistics.',
    status: 'installed',
    enabled: true,
    statusLine: 'Starting…',
    category: 'peripheral',
    sections: [
      {
        id: 'cpu',
        title: 'CPU',
        fields: [
          { kind: 'readonly', id: 'cpuUsage', label: 'Usage', value: '—' },
          { kind: 'readonly', id: 'cpuTemp', label: 'Temperature', value: '—' },
        ],
      },
      {
        id: 'ram',
        title: 'Memory',
        fields: [
          { kind: 'readonly', id: 'ramUsage', label: 'Used', value: '—' },
          { kind: 'readonly', id: 'ramSwap', label: 'Swap', value: '—' },
        ],
      },
      {
        id: 'gpu',
        title: 'GPU',
        fields: [
          { kind: 'readonly', id: 'gpuName', label: 'Adapter', value: '—' },
          { kind: 'readonly', id: 'gpuUsage', label: 'Usage', value: '—' },
          { kind: 'readonly', id: 'gpuVram', label: 'VRAM', value: '—' },
          { kind: 'readonly', id: 'gpuTemp', label: 'Temperature', value: '—' },
        ],
      },
      {
        id: 'storage',
        title: 'Storage',
        fields: [
          { kind: 'readonly', id: 'diskSummary', label: 'Drives', value: '—' },
        ],
      },
      {
        id: 'network',
        title: 'Network',
        fields: [
          { kind: 'readonly', id: 'netSummary', label: 'Throughput', value: '—' },
        ],
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    glyph: 'D',
    author: 'mission-control.discord',
    version: '1.2.0',
    blurb: 'Rich Presence, voice controls, and live participant volume mixing.',
    status: 'connected',
    enabled: true,
    statusLine: 'Connected · authenticated',
    category: 'communication',
    sections: [
      {
        id: 'account',
        title: 'Account',
        desc: 'Discord application credentials.',
        fields: [
          {
            kind: 'text',
            id: 'clientId',
            label: 'Client ID',
            value: '',
            placeholder: 'e.g. 1234567890123456789',
            mono: true,
          },
          {
            kind: 'password',
            id: 'clientSecret',
            label: 'Client Secret',
            value: '',
            placeholder: 'OAuth2 client secret',
            mono: true,
          },
        ],
      },
      {
        id: 'voice',
        title: 'Voice Controls',
        desc: 'Microphone, deafen, and participant volume settings.',
        fields: [
          {
            kind: 'toggle',
            id: 'selfMuted',
            label: 'Microphone',
            sub: 'Current self-mute status',
            value: false,
          },
          {
            kind: 'toggle',
            id: 'selfDeafened',
            label: 'Deafen',
            sub: 'Current self-deafen status',
            value: false,
          },
        ],
      },
    ],
  },
]
