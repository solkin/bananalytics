import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Breakdown,
  DataList,
  DayBars,
  DetailPanel,
  EmptyState,
  PageHeader,
  Properties,
  SplitView,
  type DataListColumn,
} from '@/ui'
import type { Event } from '@/types'
import { getEventStats, getEventVersionStats, getEventVersions, getEventsByName } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { AnalyticsFilters } from '../AnalyticsFilters'
import { useStickyFilters } from '../filters'
import { androidVersion, countryName, fillDaily, fmtDateTime, fmtK, fromTo, versionLabel } from '../format'
import './analytics.css'

const PAGE_SIZE = 25

const pairs = (record: Record<string, string | number> | null) =>
  Object.entries(record ?? {}).map(([label, value]) => ({ label, value: String(value) }))

function EventRecord({ event, onClose }: { event: Event; onClose: () => void }) {
  const device = event.device_info
  const groups = [
    {
      title: 'Event',
      items: [
        { label: 'Time', value: fmtDateTime(event.created_at) },
        { label: 'App version', value: event.version_code ?? '—' },
      ],
    },
    {
      title: 'Device',
      items: device
        ? [
            { label: 'Model', value: `${device.manufacturer} ${device.model}` },
            { label: 'OS version', value: androidVersion(device.os_version) },
            { label: 'Country', value: device.country ? countryName(device.country) : '—' },
            { label: 'Language', value: device.language || '—' },
          ]
        : [],
    },
    { title: 'Tags', items: pairs(event.tags) },
    { title: 'Fields', items: pairs(event.fields) },
  ]
  return (
    <DetailPanel title="Event record" label="Event record" onClose={onClose}>
      <div className="an-record">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title}>
              <h3 className="an-record__title">{group.title}</h3>
              <Properties items={group.items} />
            </div>
          ))}
      </div>
    </DetailPanel>
  )
}

const COLUMNS: DataListColumn<Event>[] = [
  { key: 'time', title: 'Time', width: 164, render: (r) => <span className="an-muted">{fmtDateTime(r.created_at)}</span> },
  { key: 'version', title: 'Version', width: 72, optional: true, render: (r) => <span className="an-muted">{r.version_code ?? '—'}</span> },
  { key: 'device', title: 'Device', render: (r) => (r.device_info ? `${r.device_info.manufacturer} ${r.device_info.model}` : '—') },
  {
    key: 'tags',
    title: 'Tags',
    optional: true,
    render: (r) => <span className="an-tags">{pairs(r.tags).map((p) => `${p.label}: ${p.value}`).join(', ') || '—'}</span>,
  },
]

export default function EventDetailPage() {
  const { name = '' } = useParams()
  /* Keyed by event: the page and the open record belong to one event only. */
  return <EventDetail key={name} name={name} />
}

function EventDetail({ name }: { name: string }) {
  const { appId } = useParams()
  const { get, set } = useStickyFilters(`events_filters_${appId}`)
  const days = Number(get('days', '28')) || 28
  const version = get('version') ? Number(get('version')) : undefined
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Event | null>(null)

  /* One set of filters drives every section: they all describe the same slice. */
  const versions = useAsync(() => getEventVersions(appId!), [appId], { key: `event-versions:${appId}` })
  const stats = useAsync(() => getEventStats(appId!, name, { ...fromTo(days), version }), [appId, name, days, version])
  const byVersion = useAsync(() => getEventVersionStats(appId!, name, fromTo(days)), [appId, name, days])
  const events = useAsync(
    () => getEventsByName(appId!, name, { version, ...fromTo(days), page, pageSize: PAGE_SIZE }),
    [appId, name, version, days, page],
  )
  const versionTotal = (byVersion.data ?? []).reduce((sum, row) => sum + row.count, 0)
  const share = (count: number) => `${versionTotal ? Math.round((count / versionTotal) * 100) : 0}%`

  return (
    <SplitView
      detailWidth={380}
      list={
        <section aria-label={name}>
          <PageHeader
            className="an-header"
            title={
              <span className="an-breadcrumb">
                <Link to={`/apps/${appId}/analytics/events`}>Events</Link>
                <span aria-hidden>/</span>
                <span className="an-breadcrumb__name">{name}</span>
              </span>
            }
          >
            <AnalyticsFilters
              days={days}
              version={version}
              versions={versions.data ?? []}
              onChange={(updates) => {
                setPage(1)
                set(updates)
              }}
            />
          </PageHeader>

          <div className="an-section">
            <Loaded state={stats} emptyText="No data for this event in this period">
              {(rows) => (
                <>
                  <dl className="an-total">
                    <dt>Count, last {days} days</dt>
                    <dd>{fmtK(rows.reduce((sum, row) => sum + row.count, 0))}</dd>
                  </dl>
                  <DayBars height={72} data={fillDaily(rows, days)} label={`Count per day over the last ${days} days`} />
                </>
              )}
            </Loaded>
          </div>

          <div className="an-section an-section--ruled">
            <h2 className="an-heading">By version</h2>
            <Loaded state={byVersion} emptyText="No version data">
              {(rows) => (
                <Breakdown
                  items={rows.map((row) => ({
                    label: versionLabel(row),
                    value: row.count,
                    display: `${fmtK(row.count)} · ${share(row.count)}`,
                  }))}
                />
              )}
            </Loaded>
          </div>

          <div className="an-section an-section--ruled">
            <h2 className="an-heading">Recent events</h2>
          </div>
          <Loaded state={events} empty={<EmptyState title="No events in this period" />} preserveHeight>
            {(data) => (
              <DataList
                label="Recent events"
                columns={COLUMNS}
                data={data.items}
                rowKey={(r) => r.id}
                selectedKey={selected?.id}
                onRowClick={setSelected}
                pagination={{ page, pageSize: PAGE_SIZE, total: data.total, onChange: setPage }}
              />
            )}
          </Loaded>
        </section>
      }
      detail={selected ? <EventRecord event={selected} onClose={() => setSelected(null)} /> : undefined}
    />
  )
}
