import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DataList, Input, LineChart, PageHeader, Sparkline, type DataListColumn } from '@/ui'
import { getEventSummary, getEventVersions, getUniqueSessionsByVersion, type EventSummary } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { AnalyticsFilters } from '../AnalyticsFilters'
import { useStickyFilters } from '../filters'
import { fillDaily, fmtK, fromTo } from '../format'
import { forVersion, versionSeries } from '../series'
import './analytics.css'

const PAGE_SIZE = 25

export default function EventsPage() {
  const navigate = useNavigate()
  const { appId } = useParams()
  const [query, setQuery] = useState('')
  const { get, set } = useStickyFilters(`events_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const version = get('version') ? Number(get('version')) : undefined

  const versions = useAsync(() => getEventVersions(appId!), [appId], { key: `event-versions:${appId}` })
  const events = useAsync(
    () => getEventSummary(appId!, { version, ...fromTo(days) }),
    [appId, version, days],
    { key: `event-summary:${appId}:${version ?? 'all'}:${days}` },
  )
  const sessions = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(days)), [appId, days], { key: `sessions-unique:${appId}:${days}` })

  const columns: DataListColumn<EventSummary>[] = [
    { key: 'name', title: 'Name', render: (r) => <span className="an-event-name">{r.name}</span> },
    {
      /* The row's shape says more than a second number would. */
      key: 'trend',
      title: 'Trend',
      width: 136,
      optional: true,
      render: (r) => <Sparkline width={104} height={20} data={fillDaily(r.daily, days).map((d) => d.value)} />,
    },
    { key: 'total', title: 'Count', width: 96, align: 'right', sorter: (a, b) => a.total - b.total, render: (r) => <strong className="an-count">{fmtK(r.total)}</strong> },
  ]

  return (
    <section aria-label="Events">
      <PageHeader title="Events" className="an-header">
        <AnalyticsFilters days={days} version={version} versions={versions.data ?? []} onChange={set} />
      </PageHeader>
      <div className="an-section">
        <h2 className="an-heading">Unique sessions per version</h2>
        <Loaded state={sessions}>
          {(rows) => (
            <LineChart
              height={160}
              label={`Unique sessions per version over the last ${days} days`}
              series={versionSeries(forVersion(rows, version), days)}
            />
          )}
        </Loaded>
      </div>
      <div className="an-search">
        <Input
          size="sm"
          aria-label="Search events"
          placeholder="Search events"
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
        />
      </div>
      <Loaded state={events} emptyText="No events in this period">
        {(list) => (
          <DataList
            label="Events"
            columns={columns}
            data={list.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))}
            rowKey={(r) => r.name}
            pageSize={PAGE_SIZE}
            emptyText="No events match this search"
            onRowClick={(r) => navigate(`/apps/${appId}/analytics/events/${encodeURIComponent(r.name)}`)}
          />
        )}
      </Loaded>
    </section>
  )
}
