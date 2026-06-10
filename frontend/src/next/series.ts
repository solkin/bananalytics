import type { ChartSeries } from '@/ui'
import { seriesColor } from './colors'
import { dayAxis, shortDate } from './format'

interface VersionRow {
  date: string
  version_code: number
  version_name: string | null
  count: number
}

/* Group per-version daily rows into aligned chart series: every series
   shares the same zero-filled day axis, so MultiAreaChart can index by
   position. Versions are ordered newest-first; capped to keep the chart
   readable. */
export function versionSeries(rows: VersionRow[], days: number, maxSeries = 6): ChartSeries[] {
  const axis = dayAxis(days)
  const byVersion = new Map<number, { name: string | null; counts: Map<string, number> }>()
  for (const r of rows) {
    let v = byVersion.get(r.version_code)
    if (!v) {
      v = { name: r.version_name, counts: new Map() }
      byVersion.set(r.version_code, v)
    }
    const d = r.date.slice(0, 10)
    v.counts.set(d, (v.counts.get(d) ?? 0) + r.count)
  }
  return [...byVersion.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, maxSeries)
    .map(([code, v], i) => ({
      label: v.name ? `${v.name} (${code})` : `v${code}`,
      color: seriesColor(i),
      data: axis.map((d) => ({ label: shortDate(d), value: v.counts.get(d) ?? 0 })),
    }))
}
