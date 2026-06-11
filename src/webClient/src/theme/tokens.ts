import type { CSSProperties } from 'react'

/**
 * Web client design tokens.
 *
 * Colors come exclusively from the CSS custom properties defined in
 * `styles/globals.css` (`var(--color-*)`) so light/dark theming keeps working.
 * This module defines everything else pages need to stay visually consistent:
 * the typography scale, spacing scale and control sizing. Pages must not
 * hardcode font sizes/weights or magic widths — use these tokens or the
 * matching CSS utility classes (`.card-title`, `.card-field-label`,
 * `.card-row-label`, `.mono`).
 */

/** Monospace stack used for row labels and value readouts (matches the main app). */
export const MONO_FONT = "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace"

/** Typography presets — the only text styles the web client uses. */
export const text = {
  /** Page heading (one per page, rendered by `PageHeader`). */
  pageTitle: {
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.3,
    color: 'var(--color-text-primary)',
  },
  /** Card header title — mirror of the `.card-title` class. */
  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.4,
    color: 'var(--color-text-primary)',
  },
  /** Sub-section heading inside a card body (e.g. a channel or monitor name). */
  subtitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  /** Uppercase group label — mirror of the `.card-field-label` class. */
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-secondary)',
  },
  /** Mono control-row label — mirror of the `.card-row-label` class. */
  rowLabel: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    color: 'var(--color-text-secondary)',
  },
  /** Primary body copy. */
  body: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
  },
  /** Muted body copy (status text, empty states, descriptions). */
  bodyMuted: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  /** Small secondary copy (status chips, hints). */
  caption: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  /** Numeric readout next to sliders (mono, right-aligned by convention). */
  value: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    color: 'var(--color-text-secondary)',
  },
} satisfies Record<string, CSSProperties>

/** Spacing scale (px). */
export const space = {
  /** Page edge padding. */
  page: 16,
  /** Gap between cards on a page. */
  cardGap: 12,
  /** Gap between sections inside a card. */
  sectionGap: 14,
  /** Gap between control rows. */
  rowGap: 10,
  /** Gap between a label and its control / between items inside a row. */
  fieldGap: 8,
} satisfies Record<string, number>

/** Control sizing (px). */
export const size = {
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 8,
  /** Fixed label column width for inline `Field` rows — keeps controls aligned. */
  rowLabelWidth: 68,
  /** Numeric readout column width next to sliders. */
  valueWidth: 38,
  /** Square icon-button side (touch friendly). */
  iconButton: 32,
  /** Minimum height for touch controls (selects, segment buttons). */
  touchControl: 34,
} satisfies Record<string, number>
