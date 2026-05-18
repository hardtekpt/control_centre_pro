// Plugins page — icon set. Same Ico chassis: 20px default, stroke 1.75.

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
const IconChevron = ({ size }) => (
  <Ico size={size}><path d="M6 9l6 6 6-6" /></Ico>
);
const IconChevronRight = ({ size }) => (
  <Ico size={size}><path d="M9 6l6 6-6 6" /></Ico>
);
const IconArrowLeft = ({ size }) => (
  <Ico size={size}><path d="M19 12H5M11 5l-7 7 7 7" /></Ico>
);
const IconCheck = ({ size }) => (
  <Ico size={size}><path d="M5 12.5l4.5 4.5L19 7" /></Ico>
);
const IconX = ({ size }) => (
  <Ico size={size}><path d="M6 6l12 12M18 6L6 18" /></Ico>
);
const IconSearch = ({ size }) => (
  <Ico size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Ico>
);
const IconWarn = ({ size }) => (
  <Ico size={size}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17v.1" />
  </Ico>
);
const IconInfo = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v.1M12 11v5" />
  </Ico>
);
const IconEye = ({ size }) => (
  <Ico size={size}>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.5" />
  </Ico>
);
const IconEyeOff = ({ size }) => (
  <Ico size={size}>
    <path d="M9.5 9.5a3 3 0 0 0 4 4" />
    <path d="M6 6c-2 1.6-3.5 4-3.5 6 0 0 3.5 6 9.5 6 1.6 0 3-.3 4.3-.8" />
    <path d="M18 18c2-1.5 3.5-4 3.5-6 0 0-3.5-6-9.5-6-1 0-2 .1-2.8.4" />
    <path d="M4 4l16 16" />
  </Ico>
);
const IconCopy = ({ size }) => (
  <Ico size={size}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Ico>
);
const IconRefresh = ({ size }) => (
  <Ico size={size}>
    <path d="M4 12a8 8 0 0 1 14-5l2-2M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-14 5l-2 2M4 20v-4h4" />
  </Ico>
);
const IconExt = ({ size }) => (
  // External link
  <Ico size={size}>
    <path d="M14 5h5v5M19 5L11 13" />
    <path d="M19 14v5H5V5h5" />
  </Ico>
);
const IconPlug = ({ size }) => (
  <Ico size={size}>
    <path d="M9 4v6M15 4v6" />
    <rect x="6.5" y="10" width="11" height="5" rx="1.5" />
    <path d="M12 15v3a3 3 0 0 0 3 3h1" />
  </Ico>
);
const IconStore = ({ size }) => (
  <Ico size={size}>
    <path d="M3 8h18l-1.5 11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2L3 8z" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" />
  </Ico>
);

// Sidebar nav (same as other pages)
const IconHome = ({ size }) => (
  <Ico size={size}>
    <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </Ico>
);
const IconHeadset = ({ size }) => (
  <Ico size={size}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="3" y="13" width="4" height="7" rx="1.5" />
    <rect x="17" y="13" width="4" height="7" rx="1.5" />
    <path d="M20 17v1a3 3 0 0 1-3 3h-3" />
  </Ico>
);
const IconMonitor = ({ size }) => (
  <Ico size={size}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </Ico>
);
const IconLayers = ({ size }) => (
  <Ico size={size}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17l9 5 9-5" />
  </Ico>
);
const IconKeyboard = ({ size }) => (
  <Ico size={size}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M18 13h.01M11 13h6" />
  </Ico>
);
const IconCog = ({ size }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </Ico>
);
const IconBell = ({ size }) => (
  <Ico size={size}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Ico>
);
const IconInfoBlock = ({ size }) => (
  <Ico size={size}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M12 10v6M12 8v.1" />
  </Ico>
);
const IconPaint = ({ size }) => (
  // Appearance settings tab
  <Ico size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="7" cy="11" r="1.2" fill="currentColor" />
    <circle cx="10" cy="7" r="1.2" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1.2" fill="currentColor" />
    <circle cx="17" cy="11.5" r="1.2" fill="currentColor" />
    <path d="M12 21a3 3 0 0 1-2-5l2-2a3 3 0 0 1 4 4l-1 1a3 3 0 0 1-3 2z" />
  </Ico>
);

Object.assign(window, {
  Ico,
  IconChevron, IconChevronRight, IconArrowLeft, IconCheck, IconX,
  IconSearch, IconWarn, IconInfo, IconEye, IconEyeOff, IconCopy,
  IconRefresh, IconExt, IconPlug, IconStore,
  IconHome, IconHeadset, IconMonitor, IconLayers, IconKeyboard, IconCog,
  IconBell, IconInfoBlock, IconPaint,
});
