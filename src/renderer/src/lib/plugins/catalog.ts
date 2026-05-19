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
