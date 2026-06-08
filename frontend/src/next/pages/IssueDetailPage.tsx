import { useParams } from 'react-router-dom'
import {
  AreaChart,
  BarList,
  Button,
  Card,
  Descriptions,
  Divider,
  Icons,
  Tabs,
  Tag,
  Text,
  type BarListItem,
  type ChartPoint,
} from '@/ui'
import type { Crash } from '@/types'
import { getCrashGroup, getCrashStats, getCrashesInGroup, updateCrashGroupStatus } from '@/api/crashes'
import { useAsync, Loaded } from '../async'
import { cap, fmtK, fromTo, relTime, shortDate } from '../format'
import { useDetailCrumb } from '../layout/useDetailCrumb'
import './pages.css'

function rank(items: Crash[], keyFn: (c: Crash) => string | null, topN = 5): BarListItem[] {
  const m = new Map<string, number>()
  for (const c of items) {
    const k = keyFn(c)
    if (k) m.set(k, (m.get(k) || 0) + 1)
  }
  const total = items.length || 1
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, value: count, display: `${Math.round((count / total) * 100)}%` }))
}

export default function IssueDetailPage() {
  const { issueId = '' } = useParams()
  const state = useAsync(async () => {
    const [group, stats, crashes] = await Promise.all([
      getCrashGroup(issueId),
      getCrashStats(issueId, fromTo(28)),
      getCrashesInGroup(issueId, { pageSize: 50 }),
    ])
    return { group, stats, crashes: crashes.items }
  }, [issueId])

  const cls = state.data?.group.exception_class
  useDetailCrumb(state.data ? (cls ? cls.split('.').pop() || cls : 'Issue') : null)

  const setStatus = async (s: 'resolved' | 'ignored' | 'open') => {
    await updateCrashGroupStatus(issueId, s)
    state.reload()
  }

  return (
    <div className="pg">
      <Loaded state={state}>
        {({ group, stats, crashes }) => {
          const rep: Crash | undefined = crashes[0]
          const series: ChartPoint[] = stats.map((d) => ({ label: shortDate(d.date), value: d.count }))
          const devices = rank(crashes, (c) => c.device_info?.model ?? null)
          const oses = rank(crashes, (c) => (c.device_info ? `Android ${c.device_info.os_version}` : null))
          const stack = rep?.stacktrace_decoded || rep?.stacktrace_raw || 'No stack trace available.'
          const version = rep?.version_code != null ? String(rep.version_code) : '—'

          const overview = (
            <div className="pg">
              <Card title="Stack trace" extra={<Button size="sm" icon={<Icons.IconCopy size={14} />} onClick={() => navigator.clipboard?.writeText(stack)}>Copy</Button>}>
                <pre className="stacktrace">{stack}</pre>
              </Card>
              <Card title="Reports" extra={<Text type="danger" strong>{fmtK(group.occurrences)}</Text>}>
                <AreaChart data={series} color="var(--bnn-danger)" height={160} />
              </Card>
              <div className="pg-affected">
                <Card title="Most affected devices">
                  {devices.length ? <BarList items={devices} /> : <Text type="tertiary">No device data.</Text>}
                </Card>
                <Card title="Most affected OS">
                  {oses.length ? <BarList items={oses} /> : <Text type="tertiary">No OS data.</Text>}
                </Card>
              </div>
            </div>
          )

          const threads = (
            <div className="pg">
              <Card title="Occurrence">
                {rep ? (
                  <Descriptions
                    column={4}
                    items={[
                      { label: 'Device', value: rep.device_info?.model ?? '—' },
                      { label: 'OS', value: rep.device_info ? `Android ${rep.device_info.os_version}` : '—' },
                      { label: 'App version', value: version },
                      { label: 'When', value: relTime(rep.created_at) },
                      { label: 'Country', value: rep.device_info?.country ?? '—' },
                      { label: 'Language', value: rep.device_info?.language ?? '—' },
                      { label: 'Thread', value: rep.thread ?? 'main' },
                      { label: 'Fatal', value: rep.is_fatal ? 'Yes' : 'No' },
                    ]}
                  />
                ) : (
                  <Text type="tertiary">No occurrences captured.</Text>
                )}
              </Card>
              <Card title="Stack trace">
                <pre className="stacktrace">{stack}</pre>
              </Card>
            </div>
          )

          return (
            <>
              <Card>
                <div className="pg-detailhead">
                  <div className="pg-detailhead__main">
                    <div className="pg-detailhead__titlerow">
                      <div className="pg-detailhead__title">{group.exception_class || 'Unknown error'}</div>
                      <Tag tone={group.status === 'open' ? 'success' : group.status === 'ignored' ? 'warning' : 'neutral'}>{cap(group.status)}</Tag>
                    </div>
                    <div className="pg-detailhead__msg">{group.exception_message || '—'}</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Tag tone="primary">v{version}</Tag>
                      <Tag tone="danger">crash</Tag>
                    </div>
                  </div>
                  <div className="pg-detailhead__actions">
                    {group.status !== 'ignored' && <Button onClick={() => setStatus('ignored')}>Ignore</Button>}
                    {group.status === 'open' ? (
                      <Button variant="primary" onClick={() => setStatus('resolved')}>Close issue</Button>
                    ) : (
                      <Button onClick={() => setStatus('open')}>Reopen</Button>
                    )}
                  </div>
                </div>
                <Divider />
                <div className="pg-meta">
                  <div className="pg-meta__item"><span className="pg-meta__label">Reports</span><span className="pg-meta__value">{fmtK(group.occurrences)}</span></div>
                  <div className="pg-meta__item"><span className="pg-meta__label">Devices</span><span className="pg-meta__value">{fmtK(group.affected_devices)}</span></div>
                  <div className="pg-meta__item"><span className="pg-meta__label">First seen</span><span className="pg-meta__value">{relTime(group.first_seen)}</span></div>
                  <div className="pg-meta__item"><span className="pg-meta__label">Last report</span><span className="pg-meta__value">{relTime(group.last_seen)}</span></div>
                </div>
              </Card>

              <Tabs
                items={[
                  { key: 'overview', label: 'Overview', children: overview },
                  { key: 'threads', label: 'Threads', children: threads },
                  { key: 'events', label: 'Events', children: <Card><Text type="secondary">No breadcrumb events captured for this issue.</Text></Card> },
                ]}
              />
            </>
          )
        }}
      </Loaded>
    </div>
  )
}
