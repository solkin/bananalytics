import { useNavigate, useParams } from 'react-router-dom'
import { AreaChart, Card, Select, Table, Tag, Text, type ChartPoint, type Column } from '@/ui'
import type { CrashGroup } from '@/types'
import { getAppCrashStats, getCrashFreeStats, getCrashGroups, getCrashVersions } from '@/api/crashes'
import { useAsync, Loaded } from '../async'
import { cap, fillDaily, fmtK, fromTo, relTime, shortDate, versionLabel } from '../format'
import { issueStatusTone } from '../tones'
import { useStickyFilters } from '../filters'
import './pages.css'

const PAGE_SIZE = 15

const DAY_OPTIONS = [
  { label: 'Last 24 hours', value: '1' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

export default function IssuesPage() {
  const navigate = useNavigate()
  const { appId } = useParams()
  const { get, set } = useStickyFilters(`issues_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const status = get('status', 'open')
  const version = get('version') ? Number(get('version')) : undefined

  const page = Math.max(1, Number(get('page', '1')) || 1)
  const sortBy = get('sortBy', 'occurrences')
  const sortOrder = get('sortOrder', 'desc') === 'asc' ? 'asc' : 'desc'
  const setFilter = (values: Record<string, string | undefined>) => set({ ...values, page: undefined })

  const versions = useAsync(() => getCrashVersions(appId!), [appId])
  const groups = useAsync(
    () => getCrashGroups(appId!, { days, version, status: status === 'all' ? undefined : status, page, pageSize: PAGE_SIZE, sortBy, sortOrder }),
    [appId, days, status, version, page, sortBy, sortOrder],
  )
  const stats = useAsync(() => getAppCrashStats(appId!, { ...fromTo(days), version }), [appId, days, version])
  const crashFree = useAsync(() => getCrashFreeStats(appId!, { ...fromTo(days), version }), [appId, days, version])

  const series: ChartPoint[] = fillDaily(stats.data ?? [], days)
  const total = (stats.data ?? []).reduce((s, d) => s + d.count, 0)
  /* No zero-fill here: a day without sessions is not a 0% crash-free day. */
  const cfRows = crashFree.data ?? []
  const cfSeries: ChartPoint[] = cfRows.map((r) => ({ label: shortDate(r.date), value: Math.round(r.crash_free_rate * 10) / 10 }))
  const cfLast = cfRows.length ? `${cfRows[cfRows.length - 1].crash_free_rate.toFixed(1)}%` : '—'

  const columns: Column<CrashGroup>[] = [
    {
      key: 'title', title: 'Issue',
      render: (r) => (
        <div className="pg-titlecell">
          <span className="pg-titlecell__main">{r.exception_class || 'Unknown error'}</span>
          <span className="pg-titlecell__sub">{r.exception_message || '—'}</span>
        </div>
      ),
    },
    { key: 'occurrences', title: 'Count', align: 'right', sorter: true, render: (r) => <Text strong>{fmtK(r.occurrences)}</Text> },
    { key: 'affected_devices', title: 'Devices', align: 'right', sorter: true, render: (r) => fmtK(r.affected_devices) },
    {
      key: 'status', title: 'Status', align: 'right',
      render: (r) => <Tag tone={issueStatusTone(r.status)}>{cap(r.status)}</Tag>,
    },
    {
      key: 'last_seen', title: 'Last report', align: 'right',
      sorter: true,
      render: (r) => <Text type="tertiary">{relTime(r.last_seen)}</Text>,
    },
  ]

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <div className="pg-filter">
          <span className="pg-filter__label">Version</span>
          <Select
            style={{ width: 180 }}
            placeholder="All versions"
            allowClear
            value={version ?? null}
            onChange={(v) => setFilter({ version: v === '' ? undefined : String(v) })}
            options={(versions.data ?? []).map((v) => ({ label: versionLabel(v), value: v.version_code }))}
          />
        </div>
        <div className="pg-filter">
          <span className="pg-filter__label">Time</span>
          <Select style={{ width: 150 }} value={String(days)} onChange={(v) => setFilter({ days: String(v) })} options={DAY_OPTIONS} />
        </div>
        <div className="pg-filter">
          <span className="pg-filter__label">Status</span>
          <Select
            style={{ width: 130 }}
            value={status}
            onChange={(v) => setFilter({ status: String(v) })}
            options={[
              { label: 'Open', value: 'open' },
              { label: 'Resolved', value: 'resolved' },
              { label: 'Ignored', value: 'ignored' },
              { label: 'All', value: 'all' },
            ]}
          />
        </div>
      </div>

      <div className="pg-grid2">
        <Card title="Crashes" extra={<span className="pg-charttotal"><span className="pg-charttotal__num pg-charttotal__num--crash">{stats.data ? fmtK(total) : '—'}</span><span className="pg-charttotal__label">total</span></span>}>
          <Loaded state={stats}>{() => <AreaChart data={series} color="var(--bnn-danger)" height={150} />}</Loaded>
        </Card>
        <Card title="Crash-free sessions" extra={<span className="pg-charttotal"><span className="pg-charttotal__num pg-charttotal__num--ok">{cfLast}</span><span className="pg-charttotal__label">latest</span></span>}>
          <Loaded state={crashFree}>{() => <AreaChart data={cfSeries} color="var(--bnn-success)" height={150} />}</Loaded>
        </Card>
      </div>

      <Card title="Issues" padded={false}>
        <Loaded state={groups}>
          {(result) => (
            <Table<CrashGroup>
              columns={columns}
              data={result.items}
              rowKey={(r) => r.id}
              pagination={{ page, pageSize: PAGE_SIZE, total: result.total, onChange: (next) => set({ page: String(next) }) }}
              sort={{ key: sortBy, direction: sortOrder, onChange: (key, direction) => setFilter({ sortBy: key, sortOrder: direction }) }}
              emptyText="No crashes reported in this period"
              onRowClick={(r) => navigate(`/apps/${appId}/diagnostics/issues/${r.id}`)}
            />
          )}
        </Loaded>
      </Card>
    </div>
  )
}
