/* Deterministic accent color for an app icon, derived from its name. */
const PALETTE = ['#2aa775', '#1f6feb', '#7c5cff', '#b8902b', '#d92d3a', '#16b8c4']

export function accentFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/* Stable palette for multi-series charts (one color per app version). */
export const SERIES_COLORS = ['#1f6feb', '#2aa775', '#b87503', '#7c5cff', '#d92d3a', '#16b8c4', '#c2417f', '#5c6470']

export const seriesColor = (i: number): string => SERIES_COLORS[i % SERIES_COLORS.length]
