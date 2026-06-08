import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, AreaChart, Card, Segmented, Select, Table, Text, type ChartPoint, type Column } from '@/ui'
import type { CrashGroup } from '@/types'
import { getAppCrashStats, getCrashGroups } from '@/api/crashes'
import { useAsync, Loaded } from '../async'
import { cap, fmtK, fromTo, relTime, shortDate } from '../format'
import './pages.css'

type IssueTab = 'all' | 'crash' | 'error'
const DAYS: Record<string, number> = { '7d': 7, '28d': 28, '90d': 90 }

export default function IssuesPage() {
  const navigate = useNavigate()
  const { appId } = useParams()
  const [tab, setTab] = useState<IssueTab>('all')
  const [range, setRange] = useState<string | number>('28d')
  const [status, setStatus] = useState<string | number>('open')
  const days = DAYS[String(range)] ?? 28

  const groups = useAsync(
    () => getCrashGroups(appId!, { days, status: status === 'all' ? undefined : String(status), page: 1, pageSize: 100 }),
    [appId, days, status],
  )
  const stats = useAsync(() => getAppCrashStats(appId!, fromTo(days)), [appId, days])

  const series: ChartPoint[] = (stats.data ?? []).map((d) => ({ label: shortDate(d.date), value: d.count }))
  const total = (stats.data ?? []).reduce((s, d) => s + d.count, 0)

  const rows = useMemo(() => (tab === 'error' ? [] : groups.data?.items ?? []), [groups.data, tab])

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
    { key: 'count', title: 'Count', align: 'right', sorter: (a, b) => a.occurrences - b.occurrences, render: (r) => <Text strong>{fmtK(r.occurrences)}</Text> },
    { key: 'devices', title: 'Devices', align: 'right', sorter: (a, b) => a.affected_devices - b.affected_devices, render: (r) => fmtK(r.affected_devices) },
    {
      key: 'status', title: 'Status', align: 'right',
      render: (r) => <Text type={r.status === 'open' ? 'success' : r.status === 'ignored' ? 'warning' : 'tertiary'}>{cap(r.status)}</Text>,
    },
    { key: 'lastReport', title: 'Last report', align: 'right', render: (r) => <Text type="tertiary">{relTime(r.last_seen)}</Text> },
  ]

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <div className="pg-filter">
          <span className="pg-filter__label">Time</span>
          <Select style={{ width: 150 }} value={range} onChange={setRange} options={[{ label: 'Last 7 days', value: '7d' }, { label: 'Last 28 days', value: '28d' }, { label: 'Last 90 days', value: '90d' }]} />
        </div>
        <div className="pg-filter">
          <span className="pg-filter__label">Status</span>
          <Select style={{ width: 130 }} value={status} onChange={setStatus} options={[{ label: 'Open', value: 'open' }, { label: 'Resolved', value: 'resolved' }, { label: 'Ignored', value: 'ignored' }, { label: 'All', value: 'all' }]} />
        </div>
      </div>

      <Segmented<IssueTab>
        value={tab}
        onChange={setTab}
        options={[{ label: 'All', value: 'all' }, { label: 'Crashes', value: 'crash' }, { label: 'Errors', value: 'error' }]}
      />

      <Alert type="info" message="Crash groups are clustered by stack trace. Open one to see the trace, affected devices and occurrences." />

      <div className="pg-grid2">
        <Card title="Crashes" extra={<span className="pg-charttotal"><span className="pg-charttotal__num pg-charttotal__num--crash">{fmtK(total)}</span><span className="pg-charttotal__label">total</span></span>}>
          <AreaChart data={series} color="var(--bnn-danger)" height={150} />
        </Card>
        <Card title="Errors" extra={<span className="pg-charttotal"><span className="pg-charttotal__num pg-charttotal__num--error">0</span><span className="pg-charttotal__label">total</span></span>}>
          <AreaChart data={[]} color="var(--bnn-warning)" height={150} />
        </Card>
      </div>

      <Card title="Groups" padded={false}>
        <Loaded state={groups}>
          {() => (
            <Table<CrashGroup>
              columns={columns}
              data={rows}
              rowKey={(r) => r.id}
              pageSize={10}
              emptyText="No crashes reported in this period"
              onRowClick={(r) => navigate(`/next/apps/${appId}/diagnostics/issues/${r.id}`)}
            />
          )}
        </Loaded>
      </Card>
    </div>
  )
}
