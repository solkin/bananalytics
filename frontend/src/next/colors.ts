/* Categorical colour assignment. Both palettes are the kit's chart tokens —
   no colour is defined here, only which token a value gets. */

const PALETTE = [
  'var(--bnn-chart-5)',
  'var(--bnn-chart-1)',
  'var(--bnn-chart-4)',
  'var(--bnn-chart-6)',
  'var(--bnn-chart-3)',
  'var(--bnn-chart-2)',
]

/** Deterministic accent for an app icon, derived from its name. */
export function accentFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** Stable palette for multi-series charts (one colour per app version). */
export const SERIES_COLORS = [
  'var(--bnn-chart-1)',
  'var(--bnn-chart-5)',
  'var(--bnn-chart-6)',
  'var(--bnn-chart-4)',
  'var(--bnn-chart-3)',
  'var(--bnn-chart-2)',
  'var(--bnn-chart-7)',
  'var(--bnn-chart-8)',
]

export const seriesColor = (i: number): string => SERIES_COLORS[i % SERIES_COLORS.length]
