/* Deterministic accent color for an app icon, derived from its name. */
const PALETTE = ['#2aa775', '#1f6feb', '#7c5cff', '#b8902b', '#d92d3a', '#16b8c4']

export function accentFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
