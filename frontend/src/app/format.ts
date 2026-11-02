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
  // Round `to` up to a 5-minute boundary so repeated calls produce identical
  // URLs — that lets the SWR cache and the browser HTTP cache actually hit.
  const STEP = 5 * 60 * 1000
  const now = Math.ceil(Date.now() / STEP) * STEP
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

/* Country codes come off the SDK as ISO 3166-1 alpha-2 (Locale.getDefault()),
   or the literal "Unknown" when the device did not report one. */
const REGIONS =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

export const isCountryCode = (code: string): boolean => /^[A-Z]{2}$/.test(code)

/** "US" -> "United States". Anything unrecognised passes through as-is. */
export function countryName(code: string): string {
  if (!isCountryCode(code)) return code
  try {
    return REGIONS?.of(code) ?? code
  } catch {
    return code
  }
}

/** "US" -> the flag emoji, built from regional indicator symbols. */
export function countryFlag(code: string): string {
  if (!isCountryCode(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/* Devices report Build.VERSION.SDK_INT, so the stats carry API levels: "34",
   not "14". Nobody thinks in API levels, but developers still need them, so
   both are shown. */
const ANDROID_RELEASES: Record<number, string> = {
  16: '4.1', 17: '4.2', 18: '4.3', 19: '4.4', 20: '4.4W', 21: '5.0', 22: '5.1',
  23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10',
  30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16',
}

/** "34" -> "Android 14 (API 34)". Unknown levels keep the raw number. */
export function androidVersion(sdk: number | string | null | undefined): string {
  if (sdk == null || sdk === '') return 'Unknown'
  const api = Number(sdk)
  if (!Number.isInteger(api)) return String(sdk)
  const release = ANDROID_RELEASES[api]
  return release ? `Android ${release} (API ${api})` : `API ${api}`
}
