import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IcBold = () => (
  <svg {...base}>
    <path d="M6 12V4h5a3.5 3.5 0 0 1 0 7H6" />
    <path d="M6 12h6a3.5 3.5 0 0 1 0 7H6v-7Z" />
  </svg>
);

export const IcItalic = () => (
  <svg {...base}>
    <line x1="10" y1="4" x2="18" y2="4" />
    <line x1="6" y1="20" x2="14" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);

export const IcUnderline = () => (
  <svg {...base}>
    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </svg>
);

export const IcStrike = () => (
  <svg {...base}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M16 6.5C15.5 5 13.8 4 12 4c-2.2 0-4 1.3-4 3.2 0 1.6 1.2 2.4 2.6 2.8" />
    <path d="M8 17.5c.5 1.5 2.2 2.5 4 2.5 2.2 0 4-1.2 4-3.2 0-1.6-1.2-2.4-2.6-2.8" />
  </svg>
);

export const IcAlignLeft = () => (
  <svg {...base}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="14" y2="12" />
    <line x1="4" y1="18" x2="17" y2="18" />
  </svg>
);

export const IcAlignCenter = () => (
  <svg {...base}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="6" y1="18" x2="18" y2="18" />
  </svg>
);

export const IcAlignRight = () => (
  <svg {...base}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="7" y1="18" x2="20" y2="18" />
  </svg>
);

export const IcOL = () => (
  <svg {...base}>
    <line x1="10" y1="6" x2="20" y2="6" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="18" x2="20" y2="18" />
    <text x="2" y="8" fontSize="7" stroke="none" fill="currentColor">
      1
    </text>
    <text x="2" y="14" fontSize="7" stroke="none" fill="currentColor">
      2
    </text>
    <text x="2" y="20" fontSize="7" stroke="none" fill="currentColor">
      3
    </text>
  </svg>
);

export const IcUL = () => (
  <svg {...base}>
    <line x1="10" y1="6" x2="20" y2="6" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="18" x2="20" y2="18" />
    <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IcIndentIncrease = () => (
  <svg {...base}>
    <line x1="10" y1="6" x2="20" y2="6" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="18" x2="20" y2="18" />
    <path d="M4 9l3 3-3 3" />
  </svg>
);

export const IcIndentDecrease = () => (
  <svg {...base}>
    <line x1="10" y1="6" x2="20" y2="6" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="18" x2="20" y2="18" />
    <path d="M7 9L4 12l3 3" />
  </svg>
);

export const IcLink = () => (
  <svg {...base}>
    <path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export const IcTable = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="4" x2="9" y2="20" />
  </svg>
);

export const IcCode = () => (
  <svg {...base}>
    <polyline points="9 18 3 12 9 6" />
    <polyline points="15 6 21 12 15 18" />
  </svg>
);

export const IcQuote = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <path d="M7 7c-2.2 0-4 1.8-4 4v6h6v-6H6.2C6.6 9.6 7.7 8.5 9 8V6c-.7 0-1.4.3-2 1Z" />
    <path d="M17 7c-2.2 0-4 1.8-4 4v6h6v-6h-2.8c.4-1.4 1.5-2.5 2.8-3V6c-.7 0-1.4.3-2 1Z" />
  </svg>
);

export const IcDivider = () => (
  <svg {...base}>
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
);

export const IcColor = () => (
  <svg {...base}>
    <path d="M11 4 5 18h2.5l1.2-3h4.6l1.2 3H17L11 4Zm-1.4 8.8L11 8.4l1.4 4.4H9.6Z" />
    <line x1="4" y1="21" x2="20" y2="21" strokeWidth={3} />
  </svg>
);

export const IcHighlight = () => (
  <svg {...base}>
    <path d="M9 11 15 5l4 4-6 6" />
    <path d="M9 11 5 15v4h4l4-4" />
  </svg>
);

export const IcFullscreen = () => (
  <svg {...base}>
    <polyline points="4 9 4 4 9 4" />
    <polyline points="20 9 20 4 15 4" />
    <polyline points="4 15 4 20 9 20" />
    <polyline points="20 15 20 20 15 20" />
  </svg>
);

export const IcExitFullscreen = () => (
  <svg {...base}>
    <polyline points="9 4 9 9 4 9" />
    <polyline points="15 4 15 9 20 9" />
    <polyline points="9 20 9 15 4 15" />
    <polyline points="15 20 15 15 20 15" />
  </svg>
);

export const IcImage = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export const IcAttachment = () => (
  <svg {...base}>
    <path d="M17 7.5 8.5 16a3 3 0 1 1-4.24-4.24L13 3a2 2 0 1 1 2.83 2.83l-8.25 8.25a1 1 0 0 1-1.42-1.42L14 5" />
  </svg>
);

export const IcEmoji = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14s1.5 2 3.5 2 3.5-2 3.5-2" />
    <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth={3} />
    <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth={3} />
  </svg>
);

export const IcMic = () => (
  <svg {...base}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
  </svg>
);

export const IcChevronDown = () => (
  <svg {...base}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const IcChevronUp = () => (
  <svg {...base}>
    <polyline points="6 15 12 9 18 15" />
  </svg>
);
