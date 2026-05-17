import type { FC, ReactNode } from 'react'

export interface IconProps {
  size?: number
}

const Ico: FC<IconProps & { children: ReactNode }> = ({ size = 20, children }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const IconHeadset: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="3" y="13" width="4" height="7" rx="1.5" />
    <rect x="17" y="13" width="4" height="7" rx="1.5" />
    <path d="M20 17v1a3 3 0 0 1-3 3h-3" />
  </Ico>
)

export const IconMic: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Ico>
)

export const IconMicOff: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M9 9v2a3 3 0 0 0 5.12 2.12" />
    <path d="M15 9V6a3 3 0 0 0-5.91-.75" />
    <path d="M5 11a7 7 0 0 0 10.7 5.96" />
    <path d="M19 11a7 7 0 0 1-.34 2.16" />
    <path d="M12 18v3" />
    <path d="M4 4l16 16" />
  </Ico>
)

export const IconAnc: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M8 6a8 8 0 0 1 0 12" />
    <path d="M11 8.5a4.5 4.5 0 0 1 0 7" />
    <path d="M14 11a2 2 0 0 1 0 2" />
    <path d="M19 5l-14 14" />
  </Ico>
)

export const IconTransparency: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M12 8a4 4 0 0 1 0 8" />
    <path d="M15 5a8 8 0 0 1 0 14" />
    <path d="M5 9v6" />
    <path d="M8 7v10" />
  </Ico>
)

export const IconBattery: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <rect x="2.5" y="8" width="16" height="9" rx="2" />
    <path d="M19 11.5v2" />
    <rect x="4" y="9.5" width="9" height="6" rx="0.5" fill="currentColor" stroke="none" />
  </Ico>
)

export const IconBatteryLow: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <rect x="2.5" y="8" width="16" height="9" rx="2" />
    <path d="M19 11.5v2" />
    <rect x="4" y="9.5" width="3" height="6" rx="0.5" fill="currentColor" stroke="none" />
    <path d="M11.5 11v3M11.5 15.5v.1" />
  </Ico>
)

export const IconBatteryCharging: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <rect x="2.5" y="8" width="16" height="9" rx="2" />
    <path d="M19 11.5v2" />
    <path d="M11 10l-2 2.5h3l-2 2.5" strokeWidth={1.75} />
  </Ico>
)

export const IconVolume: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M4 10v4h3l4 3V7l-4 3H4z" />
    <path d="M15 9a4 4 0 0 1 0 6" />
    <path d="M18 6.5a8 8 0 0 1 0 11" />
  </Ico>
)

export const IconVolumeMute: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M4 10v4h3l4 3V7l-4 3H4z" />
    <path d="M16 10l5 5M21 10l-5 5" />
  </Ico>
)

export const IconMusic: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="7" cy="18" r="2.2" />
    <circle cx="17" cy="16" r="2.2" />
  </Ico>
)

export const IconBell: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Ico>
)

export const IconCheck: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Ico>
)

export const IconLink: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5" />
  </Ico>
)

export const IconUnlink: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M10 14a4 4 0 0 0 5.66 0l1-1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-1 1" />
    <path d="M16.5 5.5l3 3M19 5l-3 3" />
    <path d="M5 16l3 3M8 16l-3 3" />
  </Ico>
)

export const IconChip: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </Ico>
)

export const IconPower: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M12 4v7" />
    <path d="M7.5 7a7 7 0 1 0 9 0" />
  </Ico>
)

export const IconCog: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </Ico>
)

export const IconWarn: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4" />
    <path d="M12 17v.1" />
  </Ico>
)

export const IconPlay: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />
  </Ico>
)

export const IconPause: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </Ico>
)

export const IconRefresh: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M4 12a8 8 0 0 1 14-5l2-2" />
    <path d="M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-14 5l-2 2" />
    <path d="M4 20v-4h4" />
  </Ico>
)

export const IconBluetooth: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M8 7l8 5-4 3V4l8 5-4 3" />
  </Ico>
)

export const IconMoon: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M19 14a8 8 0 1 1-9-9 6 6 0 0 0 9 9z" />
  </Ico>
)

export const IconWireless: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M5 12.5a10 10 0 0 1 14 0" />
    <path d="M8 16a5 5 0 0 1 8 0" />
    <circle cx="12" cy="19.5" r="0.5" fill="currentColor" />
  </Ico>
)

export const IconSidetone: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <path d="M9 3h6v11H9z" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
    <path d="M15 9a3 3 0 0 1 3 3v1" />
  </Ico>
)

export const IconChatMix: FC<IconProps> = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 4v4M12 16v4" />
    <path d="M4 12h4M16 12h4" />
    <path d="M7 7l2 2M15 15l2 2" />
  </Ico>
)
