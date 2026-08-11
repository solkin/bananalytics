import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MultiAreaChart, BarChart, Card, Segmented, Statistic, type ChartPoint } from '@/ui'
import { getDeviceStats, getDailyActivity, getUniqueSessionsByVersion } from '@/api/events'
import { getCrashFreeStats } from '@/api/crashes'
import { useAsync, Loaded } from '../async'
import { CardHelp, DistributionCards } from '../DistributionCards'
import { fmtK, fromTo, shortDate } from '../format'
import './pages.css'

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
  const sess = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(28)), [appId], { key: `sessions-unique:${appId}:28` })
  const act = useAsync(() => getDailyActivity(appId!, fromTo(range)), [appId, range], { key: `activity:${appId}:${range}` })
  const dev = useAsync(() => getDeviceStats(appId!, { limit: 6 }), [appId], { key: `device-stats:${appId}:6:all` })
  const cf = useAsync(() => getCrashFreeStats(appId!, fromTo(range)), [appId, range], { key: `crash-free:${appId}:${range}` })

  const sessRows = sess.data ?? []
  const actRows = act.data ?? []
  const usersSeries = actRows.map((r) => ({ label: shortDate(r.date), value: r.users }))
  const sessionsSeries = actRows.map((r) => ({ label: shortDate(r.date), value: r.sessions }))
  const cfRows = cf.data ?? []
  const rangeSessions = actRows.reduce((s, r) => s + r.sessions, 0)
  const totalSessions = cfRows.reduce((s, r) => s + r.total_sessions, 0)
  const crashFree = cfRows.length ? `${cfRows[cfRows.length - 1].crash_free_rate.toFixed(1)}%` : '—'

  return (
    <div className="pg">
      <Card
        title="Active users"
        extra={
          <span className="pg-card-extra">
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
            <CardHelp text="Distinct devices and sessions per day over the selected period." />
          </span>
        }
      >
        <div className="pg-split">
          <div className="pg-split__chart">
            <MultiAreaChart
              height={230}
              series={[
                { label: 'Users', color: 'var(--bnn-chart-1)', data: usersSeries },
                { label: 'Sessions', color: 'var(--bnn-chart-2)', data: sessionsSeries },
              ]}
            />
          </div>
          <div className="pg-rail">
            <Statistic variant="kpi" title={`Last ${range} days`} value={fmtK(rangeSessions)} />
            <Statistic variant="kpi" title="Total sessions" value={fmtK(totalSessions)} />
            <Statistic variant="kpi" title="Crash-free" value={crashFree} />
          </div>
        </div>
      </Card>

      <Card
        title="Sessions per version"
        extra={<CardHelp text="Unique sessions in the last 28 days, grouped by app version." />}
      >
        <BarChart data={byVersion(sessRows)} color="var(--bnn-warning)" height={220} />
      </Card>

      <Loaded state={dev}>{(d) => <DistributionCards stats={d} />}</Loaded>
    </div>
  )
}
