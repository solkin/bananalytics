import { useParams } from 'react-router-dom'
import { AreaChart, BarChart, BarList, Card, Icons, Statistic, Text, type BarListItem, type ChartPoint } from '@/ui'
import { getDeviceStats, getUniqueSessionsByVersion } from '@/api/events'
import { getCrashFreeStats } from '@/api/crashes'
import { useAsync, Loaded } from '../async'
import { fmtK, fromTo, shortDate } from '../format'
import './overview.css'

function HelpDot() {
  return <span className="ov-help" aria-hidden><Icons.IconHelp size={15} /></span>
}
function toBars(items: { name: string; count: number }[]): BarListItem[] {
  const total = items.reduce((s, i) => s + i.count, 0) || 1
  return items.map((i) => ({ label: i.name, value: i.count, display: fmtK(i.count), secondary: `${Math.round((i.count / total) * 100)}%` }))
}
function byDate(rows: { date: string; count: number }[]): ChartPoint[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.date, (m.get(r.date) || 0) + r.count)
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => ({ label: shortDate(date), value: v }))
}
function byVersion(rows: { version_code: number; version_name: string | null; count: number }[]): ChartPoint[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = r.version_name || String(r.version_code)
    m.set(k, (m.get(k) || 0) + r.count)
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }))
}

export default function OverviewPage() {
  const { appId } = useParams()
  const sess = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(28)), [appId])
  const dev = useAsync(() => getDeviceStats(appId!, { limit: 6 }), [appId])
  const cf = useAsync(() => getCrashFreeStats(appId!, fromTo(28)), [appId])

  const sessRows = sess.data ?? []
  const cfRows = cf.data ?? []
  const last28 = sessRows.reduce((s, r) => s + r.count, 0)
  const totalSessions = cfRows.reduce((s, r) => s + r.total_sessions, 0)
  const crashFree = cfRows.length ? `${cfRows[cfRows.length - 1].crash_free_rate.toFixed(1)}%` : '—'

  return (
    <div className="ov">
      <Card title="Active users" extra={<HelpDot />}>
        <div className="ov-split">
          <div className="ov-split__chart"><AreaChart data={byDate(sessRows)} height={230} /></div>
          <div className="ov-rail">
            <Statistic title="Last 28 days" value={fmtK(last28)} />
            <Statistic title="Total sessions" value={fmtK(totalSessions)} />
            <Statistic title="Crash-free" value={crashFree} />
          </div>
        </div>
      </Card>

      <Card title="Sessions per version" extra={<HelpDot />}>
        <BarChart data={byVersion(sessRows)} color="var(--bnn-warning)" height={220} />
      </Card>

      <Loaded state={dev}>
        {(d) => (
          <>
            <div className="ov-grid2">
              <Card title="Top devices" extra={<HelpDot />}>{d.models.length ? <BarList items={toBars(d.models)} /> : <Text type="tertiary">No device data yet</Text>}</Card>
              <Card title="OS distribution" extra={<HelpDot />}>{d.os_versions.length ? <BarList items={toBars(d.os_versions)} /> : <Text type="tertiary">No data yet</Text>}</Card>
            </div>
            <div className="ov-grid2">
              <Card title="Country / Region" extra={<HelpDot />}>{d.countries.length ? <BarList items={toBars(d.countries)} /> : <Text type="tertiary">No data yet</Text>}</Card>
              <Card title="Languages" extra={<HelpDot />}>{d.languages.length ? <BarList items={toBars(d.languages)} /> : <Text type="tertiary">No data yet</Text>}</Card>
            </div>
          </>
        )}
      </Loaded>
    </div>
  )
}
