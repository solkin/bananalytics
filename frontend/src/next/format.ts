export const fmtK = (n: number): string =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${MON[d.getMonth()]} ${d.getDate()}`
}

export function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return iso
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`
  const y = Math.floor(mo / 12)
  return `${y} year${y > 1 ? 's' : ''} ago`
}

export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function fromTo(days: number): { from: string; to: string } {
  const now = Date.now()
  return {
    from: new Date(now - days * 86400000).toISOString(),
    to: new Date(now).toISOString(),
  }
}

export const fmtBytes = (b: number | null): string =>
  b == null ? '—' : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${MON[d.getMonth()]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const versionLabel = (v: { version_code: number; version_name: string | null }): string =>
  v.version_name ? `${v.version_name} (${v.version_code})` : `Version ${v.version_code}`

/* Zero-filled day axis for the last `days` days (inclusive of today). */
export function dayAxis(days: number): string[] {
  const out: string[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function fillDaily(rows: { date: string; count: number }[], days: number): { label: string; value: number }[] {
  const m = new Map(rows.map((r) => [r.date.slice(0, 10), r.count] as const))
  return dayAxis(days).map((d) => ({ label: shortDate(d), value: m.get(d) ?? 0 }))
}
