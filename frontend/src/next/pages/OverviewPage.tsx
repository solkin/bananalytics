import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MultiAreaChart, BarChart, BarList, Card, Icons, Segmented, Statistic, Text, type BarListItem, type ChartPoint } from '@/ui'
import { getDeviceStats, getDailyActivity, getUniqueSessionsByVersion } from '@/api/events'
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
  const [range, setRange] = useState(28)
  const sess = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(28)), [appId])
  const act = useAsync(() => getDailyActivity(appId!, fromTo(range)), [appId, range])
  const dev = useAsync(() => getDeviceStats(appId!, { limit: 6 }), [appId])
  const cf = useAsync(() => getCrashFreeStats(appId!, fromTo(range)), [appId, range])

  const sessRows = sess.data ?? []
  const actRows = act.data ?? []
  const usersSeries = actRows.map((r) => ({ label: shortDate(r.date), value: r.users }))
  const sessionsSeries = actRows.map((r) => ({ label: shortDate(r.date), value: r.sessions }))
  const cfRows = cf.data ?? []
  const rangeSessions = actRows.reduce((s, r) => s + r.sessions, 0)
  const totalSessions = cfRows.reduce((s, r) => s + r.total_sessions, 0)
  const crashFree = cfRows.length ? `${cfRows[cfRows.length - 1].crash_free_rate.toFixed(1)}%` : '—'

  return (
    <div className="ov">
      <Card
        title="Active users"
        extra={
          <span className="ov-card-extra">
            <Segmented<number>
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { label: '7d', value: 7 },
                { label: '28d', value: 28 },
                { label: '90d', value: 90 },
                { label: '1y', value: 365 },
              ]}
            />
            <HelpDot />
          </span>
        }
      >
        <div className="ov-split">
          <div className="ov-split__chart">
            <MultiAreaChart
              height={230}
              series={[
                { label: 'Users', color: 'var(--bnn-chart-1)', data: usersSeries },
                { label: 'Sessions', color: 'var(--bnn-chart-2)', data: sessionsSeries },
              ]}
            />
          </div>
          <div className="ov-rail">
            <Statistic title={`Last ${range} days`} value={fmtK(rangeSessions)} />
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
