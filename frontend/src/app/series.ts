import type { ChartSeries } from '@/ui'
import { dayAxis, shortDate } from './format'

interface VersionRow {
  date: string
  version_code: number
  version_name: string | null
  count: number
}

/** Newest versions a chart names; the rest add up to one dashed "Other" line. */
const NAMED_VERSIONS = 3
const OTHER_LABEL = 'Other'

/* Groups per-version daily rows into aligned series: every series shares the
   same zero-filled day axis, newest version first. */
export function versionSeries(rows: VersionRow[], days: number): ChartSeries[] {
  const axis = dayAxis(days)
  const byVersion = new Map<number, { name: string | null; counts: Map<string, number> }>()
  for (const row of rows) {
    let version = byVersion.get(row.version_code)
    if (!version) {
      version = { name: row.version_name, counts: new Map() }
      byVersion.set(row.version_code, version)
    }
    const day = row.date.slice(0, 10)
    version.counts.set(day, (version.counts.get(day) ?? 0) + row.count)
  }
  const versions = [...byVersion.entries()].sort((a, b) => b[0] - a[0])
  const line = (counts: (day: string) => number) =>
    axis.map((day) => ({ label: shortDate(day), value: counts(day) }))

  const named = versions.slice(0, NAMED_VERSIONS).map(([code, version]) => ({
    label: version.name ? `${version.name} (${code})` : `v${code}`,
    data: line((day) => version.counts.get(day) ?? 0),
  }))
  const rest = versions.slice(NAMED_VERSIONS)
  if (!rest.length) return named
  return [
    ...named,
    {
      label: OTHER_LABEL,
      dashed: true,
      data: line((day) => rest.reduce((sum, [, version]) => sum + (version.counts.get(day) ?? 0), 0)),
    },
  ]
}

/** Keeps only the rows of the selected version; no selection keeps them all.
 *  The per-version endpoints return every version at once, so a page filter
 *  narrows the same cached response instead of refetching. */
export function forVersion<T extends { version_code: number }>(rows: T[], version?: number): T[] {
  return version == null ? rows : rows.filter((r) => r.version_code === version)
}
