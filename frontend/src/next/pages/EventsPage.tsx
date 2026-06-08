import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Card, Icons, Input, Table, Text, type Column } from '@/ui'
import { getEventSummary, type EventSummary } from '@/api/events'
import { useAsync, Loaded } from '../async'
import { fmtK } from '../format'
import './pages.css'

export default function EventsPage() {
  const navigate = useNavigate()
  const { appId } = useParams()
  const [query, setQuery] = useState('')
  const state = useAsync(() => getEventSummary(appId!), [appId])

  const columns: Column<EventSummary>[] = [
    { key: 'name', title: 'Name', render: (r) => <Text mono>{r.name}</Text> },
    { key: 'total', title: 'Count', align: 'right', sorter: (a, b) => a.total - b.total, render: (r) => <Text strong>{fmtK(r.total)}</Text> },
    { key: 'month', title: 'This month', align: 'right', sorter: (a, b) => a.this_month - b.this_month, render: (r) => fmtK(r.this_month) },
    { key: 'today', title: 'Today', align: 'right', render: (r) => fmtK(r.today) },
  ]

  return (
    <div className="pg">
      <Alert type="info" message="Event counts update in near real-time as the SDK submits analytics." />
      <Card>
        <Input className="pg-searchinput" prefix={<Icons.IconSearch size={15} />} placeholder="Search events" allowClear value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} />
      </Card>
      <Card title="Events" padded={false}>
        <Loaded state={state} emptyText="No events yet">
          {(events) => {
            const rows = events.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
            return (
              <Table<EventSummary>
                columns={columns}
                data={rows}
                rowKey={(r) => r.name}
                pageSize={15}
                emptyText="No events match"
                onRowClick={(r) => navigate(`/next/apps/${appId}/analytics/events/${encodeURIComponent(r.name)}`)}
              />
            )
          }}
        </Loaded>
      </Card>
    </div>
  )
}
