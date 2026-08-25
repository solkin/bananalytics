import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Icons, Input, MultiAreaChart, Select, Sparkline, Table, Text, type Column } from '@/ui'
import { getEventSummary, getEventVersions, getUniqueSessionsByVersion, type EventSummary } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { fillDaily, fmtK, fromTo, versionLabel } from '../format'
import { useStickyFilters } from '../filters'
import { forVersion, versionSeries } from '../series'
import './pages.css'

const DAY_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

export default function EventsPage() {
  const navigate = useNavigate()
  const { appId } = useParams()
  const [query, setQuery] = useState('')
  const { get, set } = useStickyFilters(`events_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const version = get('version') ? Number(get('version')) : undefined

  const versions = useAsync(() => getEventVersions(appId!), [appId], { key: `event-versions:${appId}` })
  const state = useAsync(
    () => getEventSummary(appId!, { version, ...fromTo(days) }),
    [appId, version, days],
    { key: `event-summary:${appId}:${version ?? 'all'}:${days}` },
  )
  const sessions = useAsync(() => getUniqueSessionsByVersion(appId!, fromTo(days)), [appId, days], { key: `sessions-unique:${appId}:${days}` })

  const columns: Column<EventSummary>[] = [
    { key: 'name', title: 'Name', render: (r) => <Text mono>{r.name}</Text> },
    {
      /* Three raw numbers said less about an event than its shape does; the
         count is still there, the trend is what ranks it. */
      key: 'trend', title: 'Trend', width: 120,
      render: (r) => <Sparkline data={fillDaily(r.daily, days).map((d) => d.value)} />,
    },
    { key: 'total', title: 'Count', align: 'right', sorter: (a, b) => a.total - b.total, render: (r) => <Text strong>{fmtK(r.total)}</Text> },
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
            onChange={(v) => set({ version: v === '' ? undefined : String(v) })}
            options={(versions.data ?? []).map((v) => ({ label: versionLabel(v), value: v.version_code }))}
          />
        </div>
        <div className="pg-filter">
          <span className="pg-filter__label">Time</span>
          <Select style={{ width: 150 }} value={String(days)} onChange={(v) => set({ days: String(v) })} options={DAY_OPTIONS} />
        </div>
      </div>

      <Card title="Unique sessions per version">
        <MultiAreaChart height={200} series={versionSeries(forVersion(sessions.data ?? [], version), days)} />
      </Card>

      <Card title="Events" padded={false}>
        <div className="pg-tablesearch">
          <Input
            prefix={<Icons.IconSearch size={15} />}
            placeholder="Search events"
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
          />
        </div>
        <Loaded state={state} emptyText="No events in this period">
          {(events) => {
            const rows = events.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
            return (
              <Table<EventSummary>
                columns={columns}
                data={rows}
                rowKey={(r) => r.name}
                pageSize={15}
                emptyText="No events match"
                onRowClick={(r) => navigate(`/apps/${appId}/analytics/events/${encodeURIComponent(r.name)}`)}
              />
            )
          }}
        </Loaded>
      </Card>
    </div>
  )
}
