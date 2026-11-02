import { useParams } from 'react-router-dom'
import { Breakdown, EmptyState, LineChart, PageHeader, Segmented, type BreakdownItem } from '@/ui'
import { getDeviceStats, getSessionOverview, type SessionVersionStats } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { Distribution } from '../Distribution'
import { useStickyFilters } from '../filters'
import { fmtK, fromTo, shortDate, versionLabel } from '../format'
import './analytics.css'

const RANGES = [
  { label: '7d', value: 7 },
  { label: '28d', value: 28 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
]
const DEVICE_ROWS = 6

function byVersion(rows: SessionVersionStats[]): BreakdownItem[] {
  const totals = new Map<number, { label: string; value: number }>()
  for (const row of rows) {
    const entry = totals.get(row.version_code) ?? { label: versionLabel(row), value: 0 }
    entry.value += row.count
    totals.set(row.version_code, entry)
  }
  return [...totals.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, entry]) => ({ ...entry, display: fmtK(entry.value) }))
}

export default function OverviewPage() {
  const { appId } = useParams()
  const { get, set } = useStickyFilters(`overview_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  /* Every section reads the same window, so the filter cannot leave part of the
     screen describing a different period. */
  const sessions = useAsync(() => getSessionOverview(appId!, fromTo(days)), [appId, days], { key: `sessions-overview:${appId}:${days}` })
  const devices = useAsync(() => getDeviceStats(appId!, { limit: DEVICE_ROWS, ...fromTo(days) }), [appId, days], { key: `device-stats:${appId}:${DEVICE_ROWS}:all:${days}` })

  return (
    <section aria-label="Overview">
      <PageHeader title="Overview" className="an-header">
        <Segmented label="Period" value={days} onChange={(v) => set({ days: String(v) })} options={RANGES} />
      </PageHeader>

      <Loaded state={sessions} emptyText="No activity yet">
        {(data) => {
          const activity = data.activity
          const latest = activity[activity.length - 1]
          const crashFree = data.crash_free[data.crash_free.length - 1]?.crash_free_rate
          const versions = byVersion(data.versions)
          return (
            <>
              <div className="an-section">
                <dl className="an-metrics">
                  <div>
                    <dt>Daily users, latest</dt>
                    <dd>{latest ? latest.users.toLocaleString('en-US') : '—'}</dd>
                  </div>
                  <div>
                    <dt>Sessions</dt>
                    <dd>{fmtK(activity.reduce((sum, row) => sum + row.sessions, 0))}</dd>
                  </div>
                  <div>
                    <dt>Crash-free, latest</dt>
                    <dd>{crashFree != null ? `${crashFree.toFixed(1)}%` : '—'}</dd>
                  </div>
                </dl>
                <LineChart
                  label={`Daily users and sessions over the last ${days} days`}
                  series={[
                    { label: 'Users', data: activity.map((row) => ({ label: shortDate(row.date), value: row.users })) },
                    { label: 'Sessions', data: activity.map((row) => ({ label: shortDate(row.date), value: row.sessions })) },
                  ]}
                />
              </div>
              <div className="an-section an-section--ruled">
                <h2 className="an-heading">Sessions per version</h2>
                {versions.length ? <Breakdown items={versions} /> : <EmptyState title="No sessions in this period" />}
              </div>
            </>
          )
        }}
      </Loaded>

      <Loaded state={devices}>{(stats) => <Distribution stats={stats} />}</Loaded>
    </section>
  )
}
