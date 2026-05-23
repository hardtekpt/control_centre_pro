// GG Sonar page — icon set. Same Ico chassis as the rest of Mission Control.
// All 20px default, stroke 1.75, currentColor.

const SnIco = ({ size = 20, children, viewBox = "0 0 24 24" }) => (
  <svg
    width={size} height={size} viewBox={viewBox}
    fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// Sidebar nav (reuses same shapes as Shortcuts/Plugins)
const SnHome = ({ size }) => (
  <SnIco size={size}>
    <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </SnIco>
);
const SnHeadset = ({ size }) => (
  <SnIco size={size}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="3" y="13" width="4" height="7" rx="1.5" />
    <rect x="17" y="13" width="4" height="7" rx="1.5" />
    <path d="M20 17v1a3 3 0 0 1-3 3h-3" />
  </SnIco>
);
const SnWave = ({ size }) => (
  <SnIco size={size}>
    <path d="M5 12a7 7 0 0 1 14 0" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </SnIco>
);
const SnMonitor = ({ size }) => (
  <SnIco size={size}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </SnIco>
);
const SnLayers = ({ size }) => (
  <SnIco size={size}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17l9 5 9-5" />
  </SnIco>
);
const SnKeyboard = ({ size }) => (
  <SnIco size={size}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M18 13h.01M11 13h6" />
  </SnIco>
);
const SnCog = ({ size }) => (
  <SnIco size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </SnIco>
);

// Channel icons — simple, unbranded, original glyphs
const SnGame = ({ size }) => (
  // Game pad — abstract D-pad + button
  <SnIco size={size}>
    <rect x="2.5" y="7" width="19" height="10" rx="4" />
    <path d="M7 12h3M8.5 10.5v3" />
    <circle cx="15" cy="11" r="1" fill="currentColor" />
    <circle cx="17" cy="13" r="1" fill="currentColor" />
  </SnIco>
);
const SnChat = ({ size }) => (
  // Speech bubble with tail
  <SnIco size={size}>
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    <path d="M8 10h8M8 13h5" />
  </SnIco>
);
const SnMedia = ({ size }) => (
  // Disc / play
  <SnIco size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M10 10l5 2-5 2z" fill="currentColor" stroke="none" />
  </SnIco>
);
const SnAux = ({ size }) => (
  // Aux / TRS plug
  <SnIco size={size}>
    <path d="M12 3v9" />
    <path d="M10 5h4M10 7h4M10 9h4" />
    <path d="M8 12h8v5a4 4 0 0 1-8 0z" />
    <path d="M12 21v-2" />
  </SnIco>
);
const SnMic = ({ size }) => (
  // Microphone
  <SnIco size={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M12 17v4M9 21h6" />
  </SnIco>
);
const SnSpeaker = ({ size }) => (
  <SnIco size={size}>
    <path d="M4 10v4h3l4 3V7l-4 3H4z" />
    <path d="M15 9a4 4 0 0 1 0 6" />
    <path d="M18 6a8 8 0 0 1 0 12" />
  </SnIco>
);

// Controls
const SnSearch = ({ size }) => (
  <SnIco size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </SnIco>
);
const SnPlus = ({ size }) => (<SnIco size={size}><path d="M12 5v14M5 12h14" /></SnIco>);
const SnMinus = ({ size }) => (<SnIco size={size}><path d="M5 12h14" /></SnIco>);
const SnX = ({ size }) => (<SnIco size={size}><path d="M6 6l12 12M18 6L6 18" /></SnIco>);
const SnCheck = ({ size }) => (<SnIco size={size}><path d="M5 12.5l4.5 4.5L19 7" /></SnIco>);
const SnMore = ({ size }) => (
  <SnIco size={size}>
    <circle cx="5"  cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </SnIco>
);
const SnChevron = ({ size }) => (<SnIco size={size}><path d="M6 9l6 6 6-6" /></SnIco>);
const SnLink = ({ size }) => (
  // Link icon for routing
  <SnIco size={size}>
    <path d="M10 13a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1" />
    <path d="M14 11a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1" />
  </SnIco>
);
const SnSliders = ({ size }) => (
  // EQ
  <SnIco size={size}>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="9" cy="6" r="2" fill="var(--color-surface)" />
    <circle cx="15" cy="12" r="2" fill="var(--color-surface)" />
    <circle cx="7" cy="18" r="2" fill="var(--color-surface)" />
  </SnIco>
);
const SnSave = ({ size }) => (
  <SnIco size={size}>
    <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
    <path d="M8 5v5h7V5M8 19v-6h8v6" />
  </SnIco>
);
const SnReset = ({ size }) => (
  <SnIco size={size}>
    <path d="M4 12a8 8 0 0 1 14-5l2-2" />
    <path d="M20 4v4h-4" />
  </SnIco>
);

// Preset icons (small, abstract — none are brand marks)
const SnPresetMusic = ({ size }) => (
  <SnIco size={size}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="7" cy="18" r="2.2" />
    <circle cx="17" cy="16" r="2.2" />
  </SnIco>
);
const SnPresetGame = SnGame;
const SnPresetStudio = ({ size }) => (
  // Mixer board outline
  <SnIco size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M8 4v6M8 14v6M14 4v10M14 18v2" />
    <circle cx="8" cy="11.5" r="1.5" fill="currentColor" />
    <circle cx="14" cy="15.5" r="1.5" fill="currentColor" />
  </SnIco>
);
const SnPresetCinema = ({ size }) => (
  // Film strip
  <SnIco size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 9h18M3 15h18M8 5v14M16 5v14" />
  </SnIco>
);
const SnPresetSpeech = ({ size }) => (
  // Speech / waveform low+mid
  <SnIco size={size}>
    <path d="M4 12h2M8 9v6M11 7v10M14 10v4M17 12h3" />
  </SnIco>
);
const SnPresetFlat = ({ size }) => (
  <SnIco size={size}>
    <path d="M3 12h18" />
    <circle cx="12" cy="12" r="2" />
  </SnIco>
);

// More controls
const SnGrip = ({ size }) => (
  <SnIco size={size}>
    <circle cx="9"  cy="6"  r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6"  r="1" fill="currentColor" stroke="none" />
    <circle cx="9"  cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9"  cy="18" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
  </SnIco>
);
const SnTrash = ({ size }) => (
  <SnIco size={size}>
    <path d="M4 7h16" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V4h6v3" />
  </SnIco>
);
const SnArrow = ({ size }) => (
  <SnIco size={size}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </SnIco>
);
const SnInfo = ({ size }) => (
  <SnIco size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </SnIco>
);
const SnPulse = ({ size }) => (
  <SnIco size={size}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </SnIco>
);
const SnBolt = ({ size }) => (
  <SnIco size={size}>
    <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
  </SnIco>
);

Object.assign(window, {
  SnIco,
  SnHome, SnHeadset, SnWave, SnMonitor, SnLayers, SnKeyboard, SnCog,
  SnGame, SnChat, SnMedia, SnAux, SnMic, SnSpeaker,
  SnSearch, SnPlus, SnMinus, SnX, SnCheck, SnMore, SnChevron, SnLink, SnSliders,
  SnSave, SnReset,
  SnGrip, SnTrash, SnArrow, SnInfo, SnPulse, SnBolt,
  SnPresetMusic, SnPresetGame, SnPresetStudio, SnPresetCinema, SnPresetSpeech, SnPresetFlat,
});
