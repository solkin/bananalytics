import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AreaChart,
  Card,
  Descriptions,
  Drawer,
  Select,
  Statistic,
  Table,
  Tag,
  Text,
  Title,
  type ChartPoint,
  type Column,
  type DescItem,
} from '@/ui'
import type { Event } from '@/types'
import { getEventStats, getEventVersionStats, getEventsByName, type EventVersionStats } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { fillDaily, fmtDateTime, fmtK, fromTo, versionLabel } from '../format'
import { useDetailCrumb } from '../layout/useDetailCrumb'
import './pages.css'

const DAY_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 28 days', value: '28' },
  { label: 'Last 90 days', value: '90' },
]

const PAGE_SIZE = 25

function kvPreview(obj: Record<string, string | number> | null, max: number) {
  if (!obj) return <Text type="tertiary">—</Text>
  const entries = Object.entries(obj)
  return (
    <span className="evd-tags">
      {entries.slice(0, max).map(([k, v]) => (
        <Tag key={k}>{k}: {String(v)}</Tag>
      ))}
      {entries.length > max && <Tag tone="neutral">+{entries.length - max}</Tag>}
    </span>
  )
}

function EventDrawer({ event, onClose }: { event: Event; onClose: () => void }) {
  const main: DescItem[] = [
    { label: 'Event', value: <Text mono>{event.name}</Text> },
    { label: 'Time', value: fmtDateTime(event.created_at) },
    { label: 'App version', value: event.version_code ?? '—' },
  ]
  const device: DescItem[] = event.device_info
    ? [
        { label: 'Model', value: `${event.device_info.manufacturer} ${event.device_info.model}` },
        { label: 'OS version', value: `Android ${event.device_info.os_version}` },
        { label: 'Country', value: event.device_info.country || '—' },
        { label: 'Language', value: event.device_info.language || '—' },
      ]
    : []
  return (
    <Drawer open onClose={onClose} title="Event details" width={440}>
      <div className="pg">
        <Descriptions column={1} size="sm" items={main} />
        {device.length > 0 && (
          <Card title="Device"><Descriptions column={1} size="sm" bordered={false} items={device} /></Card>
        )}
        {event.tags && Object.keys(event.tags).length > 0 && (
          <Card title="Tags">
            <Descriptions column={1} size="sm" bordered={false} items={Object.entries(event.tags).map(([label, value]) => ({ label, value }))} />
          </Card>
        )}
        {event.fields && Object.keys(event.fields).length > 0 && (
          <Card title="Fields">
            <Descriptions column={1} size="sm" bordered={false} items={Object.entries(event.fields).map(([label, value]) => ({ label, value }))} />
          </Card>
        )}
      </div>
    </Drawer>
  )
}

export default function EventDetailPage() {
  const { appId, name = '' } = useParams()
  const decoded = decodeURIComponent(name)
  useDetailCrumb(decoded)

  const [days, setDays] = useState(28)
  const [version, setVersion] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Event | null>(null)

  const stats = useAsync(() => getEventStats(appId!, decoded, fromTo(days)), [appId, decoded, days])
  const byVersion = useAsync(() => getEventVersionStats(appId!, decoded), [appId, decoded])
  const events = useAsync(
    () => getEventsByName(appId!, decoded, { version, page, pageSize: PAGE_SIZE }),
    [appId, decoded, version, page],
  )

  const versionTotal = (byVersion.data ?? []).reduce((s, v) => s + v.count, 0)

  const versionColumns: Column<EventVersionStats>[] = [
    { key: 'version', title: 'Version', render: (r) => versionLabel(r) },
    { key: 'count', title: 'Count', align: 'right', sorter: (a, b) => a.count - b.count, render: (r) => <Text strong>{fmtK(r.count)}</Text> },
    {
      key: 'share', title: 'Share', align: 'right',
      render: (r) => <Text type="secondary">{versionTotal ? `${Math.round((r.count / versionTotal) * 100)}%` : '—'}</Text>,
    },
  ]

  const eventColumns: Column<Event>[] = [
    { key: 'time', title: 'Time', width: 180, render: (r) => <Text type="secondary">{fmtDateTime(r.created_at)}</Text> },
    { key: 'version', title: 'Version', width: 90, align: 'right', render: (r) => r.version_code ?? '—' },
    {
      key: 'device', title: 'Device', width: 200,
      render: (r) => r.device_info ? `${r.device_info.manufacturer} ${r.device_info.model}` : '—',
    },
    { key: 'tags', title: 'Tags', render: (r) => kvPreview(r.tags, 3) },
    { key: 'fields', title: 'Fields', render: (r) => kvPreview(r.fields, 2) },
  ]

  return (
    <div className="pg">
      <Title level={3}>{decoded}</Title>

      <Card
        title="Count"
        extra={
          <Select
            size="sm"
            style={{ width: 140 }}
            value={String(days)}
            onChange={(v) => setDays(Number(v) || 28)}
            options={DAY_OPTIONS}
          />
        }
      >
        <Loaded state={stats} emptyText="No data for this event yet">
          {(rows) => {
            const series: ChartPoint[] = fillDaily(rows, days)
            const total = rows.reduce((s, d) => s + d.count, 0)
            return (
              <div className="pg-split">
                <div className="pg-split__chart"><AreaChart data={series} height={220} /></div>
                <div className="pg-rail"><Statistic variant="kpi" title={`Last ${days} days`} value={fmtK(total)} /></div>
              </div>
            )
          }}
        </Loaded>
      </Card>

      <Card title="By version" extra={<Text strong>{fmtK(versionTotal)} total</Text>} padded={false}>
        <Loaded state={byVersion} emptyText="No version data">
          {(rows) => (
            <Table<EventVersionStats> columns={versionColumns} data={rows} rowKey={(r) => r.version_code} size="sm" emptyText="No version data" />
          )}
        </Loaded>
      </Card>

      <Card
        title="Recent events"
        padded={false}
        extra={
          <Select
            size="sm"
            style={{ width: 170 }}
            placeholder="All versions"
            allowClear
            value={version ?? null}
            onChange={(v) => {
              setVersion(v === '' ? undefined : Number(v))
              setPage(1)
            }}
            options={(byVersion.data ?? []).map((v) => ({ label: versionLabel(v), value: v.version_code }))}
          />
        }
      >
        <Loaded state={events} emptyText="No events yet">
          {(pageData) => (
            <Table<Event>
              columns={eventColumns}
              data={pageData.items}
              rowKey={(r) => r.id}
              size="sm"
              emptyText="No events"
              onRowClick={setSel}
              pagination={{ page, pageSize: PAGE_SIZE, total: pageData.total, onChange: setPage }}
            />
          )}
        </Loaded>
      </Card>

      {sel && <EventDrawer event={sel} onClose={() => setSel(null)} />}
    </div>
  )
}
