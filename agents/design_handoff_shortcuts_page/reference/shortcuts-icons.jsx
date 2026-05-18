// Shortcuts page — icon set. Same Ico chassis as the notification system:
// 20px default, stroke 1.75, currentColor.

const Ico = ({ size = 20, children, viewBox = "0 0 24 24" }) => (
  <svg
    width={size} height={size} viewBox={viewBox}
    fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// Generic
const IconSearch = ({ size }) => (
  <Ico size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Ico>
);
const IconPlus = ({ size }) => (
  <Ico size={size}>
    <path d="M12 5v14M5 12h14" />
  </Ico>
);
const IconMore = ({ size }) => (
  <Ico size={size}>
    <circle cx="5"  cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </Ico>
);
const IconCheck = ({ size }) => (
  <Ico size={size}><path d="M5 12.5l4.5 4.5L19 7" /></Ico>
);
const IconX = ({ size }) => (
  <Ico size={size}><path d="M6 6l12 12M18 6L6 18" /></Ico>
);
const IconWarn = ({ size }) => (
  <Ico size={size}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17v.1" />
  </Ico>
);

// Sidebar nav
const IconHome = ({ size }) => (
  <Ico size={size}>
    <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </Ico>
);
const IconKeyboard = ({ size }) => (
  // Shortcuts nav glyph
  <Ico size={size}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M18 13h.01M11 13h6" />
  </Ico>
);
const IconLayers = ({ size }) => (
  <Ico size={size}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17l9 5 9-5" />
  </Ico>
);
const IconCog = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </Ico>
);

// Category glyphs
const IconHeadset = ({ size }) => (
  <Ico size={size}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="3" y="13" width="4" height="7" rx="1.5" />
    <rect x="17" y="13" width="4" height="7" rx="1.5" />
    <path d="M20 17v1a3 3 0 0 1-3 3h-3" />
  </Ico>
);
const IconWave = ({ size }) => (
  // Sonar — concentric arcs
  <Ico size={size}>
    <path d="M5 12a7 7 0 0 1 14 0" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </Ico>
);
const IconMonitor = ({ size }) => (
  // Displays
  <Ico size={size}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </Ico>
);
const IconChip = ({ size }) => (
  // App / system
  <Ico size={size}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </Ico>
);

// Action-specific icons
const IconMicOff = ({ size }) => (
  <Ico size={size}>
    <path d="M9 9v2a3 3 0 0 0 5.12 2.12" />
    <path d="M15 9V6a3 3 0 0 0-5.91-.75" />
    <path d="M5 11a7 7 0 0 0 10.7 5.96" />
    <path d="M19 11a7 7 0 0 1-.34 2.16" />
    <path d="M12 18v3M4 4l16 16" />
  </Ico>
);
const IconAnc = ({ size }) => (
  <Ico size={size}>
    <path d="M8 6a8 8 0 0 1 0 12" />
    <path d="M11 8.5a4.5 4.5 0 0 1 0 7" />
    <path d="M14 11a2 2 0 0 1 0 2" />
    <path d="M19 5l-14 14" />
  </Ico>
);
const IconVolUp = ({ size }) => (
  <Ico size={size}>
    <path d="M4 10v4h3l4 3V7l-4 3H4z" />
    <path d="M17 9v6M14 11v2" />
    <path d="M20 9v6" />
  </Ico>
);
const IconVolDown = ({ size }) => (
  <Ico size={size}>
    <path d="M4 10v4h3l4 3V7l-4 3H4z" />
    <path d="M15 11v2" />
  </Ico>
);
const IconVolMute = ({ size }) => (
  <Ico size={size}>
    <path d="M4 10v4h3l4 3V7l-4 3H4z" />
    <path d="M16 10l5 5M21 10l-5 5" />
  </Ico>
);
const IconMusic = ({ size }) => (
  <Ico size={size}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="7" cy="18" r="2.2" />
    <circle cx="17" cy="16" r="2.2" />
  </Ico>
);
const IconPower = ({ size }) => (
  <Ico size={size}>
    <path d="M12 4v7" />
    <path d="M7.5 7a7 7 0 1 0 9 0" />
  </Ico>
);
const IconSwap = ({ size }) => (
  // Swap displays / cycle preset
  <Ico size={size}>
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </Ico>
);
const IconLock = ({ size }) => (
  <Ico size={size}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Ico>
);
const IconWindow = ({ size }) => (
  <Ico size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
  </Ico>
);
const IconBrightUp = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
    <path d="M16 4v4M14 6h4" strokeWidth="2" />
  </Ico>
);
const IconBrightDown = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
    <path d="M14 6h4" strokeWidth="2" />
  </Ico>
);
const IconReload = ({ size }) => (
  <Ico size={size}>
    <path d="M4 12a8 8 0 0 1 14-5l2-2" />
    <path d="M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-14 5l-2 2" />
    <path d="M4 20v-4h4" />
  </Ico>
);
const IconMoon = ({ size }) => (
  <Ico size={size}>
    <path d="M19 14a8 8 0 1 1-9-9 6 6 0 0 0 9 9z" />
  </Ico>
);

const IconChevron = ({ size }) => (
  <Ico size={size}><path d="M6 9l6 6 6-6" /></Ico>
);
const IconMinus = ({ size }) => (
  <Ico size={size}><path d="M5 12h14" /></Ico>
);

Object.assign(window, {
  Ico,
  IconSearch, IconPlus, IconMore, IconCheck, IconX, IconWarn, IconChevron, IconMinus,
  IconHome, IconKeyboard, IconLayers, IconCog,
  IconHeadset, IconWave, IconMonitor, IconChip,
  IconMicOff, IconAnc, IconVolUp, IconVolDown, IconVolMute, IconMusic,
  IconPower, IconSwap, IconLock, IconWindow,
  IconBrightUp, IconBrightDown, IconReload, IconMoon,
});
