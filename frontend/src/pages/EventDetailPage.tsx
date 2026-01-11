import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card,
  Table,
  Select,
  Space,
  Typography,
  Tag,
  Breadcrumb,
  Descriptions,
  message,
  Drawer,
  DatePicker,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Column } from '@ant-design/charts'
import type { Event, PaginatedResponse } from '@/types'
import type { EventVersionStats, DailyStat } from '@/api/events'
import { getEventsByName, getEventVersionStats, getEventStats } from '@/api/events'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function EventDetailPage() {
  const { appId, eventName } = useParams<{ appId: string; eventName: string }>()
  const decodedEventName = decodeURIComponent(eventName || '')
  
  const [events, setEvents] = useState<PaginatedResponse<Event> | null>(null)
  const [versionStats, setVersionStats] = useState<EventVersionStats[]>([])
  const [stats, setStats] = useState<DailyStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(14, 'day'),
    dayjs(),
  ])

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsData, versionsData] = await Promise.all([
        getEventsByName(appId!, decodedEventName, {
          version: selectedVersion,
          page,
          pageSize: 50,
        }),
        getEventVersionStats(appId!, decodedEventName),
      ])
      setEvents(eventsData)
      setVersionStats(versionsData)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load event details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (appId && eventName) loadData()
  }, [appId, eventName, selectedVersion, page])

  useEffect(() => {
    if (appId && eventName) loadStats()
  }, [appId, eventName, dateRange])

  const loadStats = async () => {
    try {
      const statsData = await getEventStats(appId!, decodedEventName, {
        from: dateRange[0].startOf('day').toISOString(),
        to: dateRange[1].endOf('day').toISOString(),
      })
      
      // Fill all dates in range with zeros where no data
      const statsMap = new Map(statsData.map(s => [s.date, s.count]))
      const filledStats: DailyStat[] = []
      let current = dateRange[0].startOf('day')
      const end = dateRange[1].startOf('day')
      
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        filledStats.push({
          date: dateStr,
          count: statsMap.get(dateStr) || 0,
        })
        current = current.add(1, 'day')
      }
      
      setStats(filledStats)
    } catch (error) {
      console.error('Failed to load stats', error)
    }
  }

  const columns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Version',
      dataIndex: 'version_code',
      key: 'version_code',
      width: 100,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: 'Device',
      key: 'device',
      width: 200,
      render: (_: unknown, record: Event) =>
        record.device_info ? (
          <Typography.Text>
            {record.device_info.manufacturer} {record.device_info.model}
          </Typography.Text>
        ) : (
          '—'
        ),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: Record<string, string> | null) =>
        tags ? (
          <Space wrap size={4}>
            {Object.entries(tags).slice(0, 3).map(([k, v]) => (
              <Tag key={k} color="blue">
                {k}: {v}
              </Tag>
            ))}
            {Object.keys(tags).length > 3 && (
              <Tag>+{Object.keys(tags).length - 3}</Tag>
            )}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Fields',
      dataIndex: 'fields',
      key: 'fields',
      render: (fields: Record<string, number> | null) =>
        fields ? (
          <Space wrap size={4}>
            {Object.entries(fields).slice(0, 2).map(([k, v]) => (
              <Typography.Text key={k} code>
                {k}: {v}
              </Typography.Text>
            ))}
            {Object.keys(fields).length > 2 && (
              <Tag>+{Object.keys(fields).length - 2}</Tag>
            )}
          </Space>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Breadcrumb
          items={[
            { title: <Link to=".."><ArrowLeftOutlined /> Events</Link> },
            { title: decodedEventName },
          ]}
        />

        <Card
          title="Event Timeline"
          styles={{ header: { background: '#fafafa' }, body: { padding: '8px 0' } }}
          extra={
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]])
                }
              }}
              allowClear={false}
            />
          }
        >
          <Column
            data={stats}
            xField="date"
            yField="count"
            height={200}
            style={{ fill: '#1890ff' }}
            axis={{
              x: {
                labelFormatter: (v: string) => dayjs(v).format('MM-DD'),
              },
              y: {
                labelFormatter: (v: number) => Number.isInteger(v) ? v.toString() : '',
                tickFilter: (d: number) => Number.isInteger(d),
              },
            }}
            interaction={{
              tooltip: {
                render: (_: any, { title, items }: any) => {
                  return `<div style="padding: 8px">
                    <div style="margin-bottom: 4px; font-weight: 500">${dayjs(title).format('YYYY-MM-DD')}</div>
                    <div>Events: ${items[0]?.value ?? 0}</div>
                  </div>`;
                },
              },
            }}
          />
        </Card>

        <Table
          dataSource={versionStats}
          rowKey="version_code"
          size="small"
          pagination={false}
          bordered
          style={{ borderRadius: '8px 8px 0 0', overflow: 'hidden' }}
          columns={[
            {
              title: 'Version',
              key: 'version',
              render: (_: unknown, record: EventVersionStats) =>
                record.version_name
                  ? `${record.version_name} (${record.version_code})`
                  : record.version_code,
            },
            {
              title: 'Count',
              dataIndex: 'count',
              key: 'count',
              width: 120,
              render: (count: number) => count.toLocaleString(),
            },
          ]}
          locale={{ emptyText: 'No version data' }}
          summary={() => {
            const total = versionStats.reduce((sum, v) => sum + v.count, 0)
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Typography.Text strong>Total</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Typography.Text strong>{total.toLocaleString()}</Typography.Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }}
        />

        <Card
          title="Events"
          styles={{ header: { background: '#fafafa' }, body: { padding: 0 } }}
          extra={
            <Select
              placeholder="Filter by version"
              allowClear
              style={{ width: 180 }}
              value={selectedVersion}
              onChange={(v) => {
                setSelectedVersion(v)
                setPage(1)
              }}
              options={versionStats.map((v) => ({
                label: v.version_name ? `${v.version_name} (${v.version_code})` : `Version ${v.version_code}`,
                value: v.version_code,
              }))}
            />
          }
        >
          <Table
            dataSource={events?.items || []}
            columns={columns}
            rowKey="id"
            loading={loading}
            bordered
            onRow={(record) => ({
              onClick: () => setSelectedEvent(record),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              current: page,
              pageSize: 50,
              total: events?.total || 0,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (total) => `${total} events`,
            }}
          />
        </Card>
      </Space>

      <Drawer
        title="Event Details"
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        width={500}
      >
        {selectedEvent && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Event Name">{selectedEvent.name}</Descriptions.Item>
              <Descriptions.Item label="Time">
                {dayjs(selectedEvent.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Version Code">
                {selectedEvent.version_code ?? '—'}
              </Descriptions.Item>
            </Descriptions>

            {selectedEvent.device_info && (
              <Descriptions title="Device" column={1} bordered size="small">
                <Descriptions.Item label="Model">
                  {selectedEvent.device_info.manufacturer} {selectedEvent.device_info.model}
                </Descriptions.Item>
                <Descriptions.Item label="OS Version">
                  Android {selectedEvent.device_info.os_version}
                </Descriptions.Item>
                <Descriptions.Item label="Country">
                  {selectedEvent.device_info.country}
                </Descriptions.Item>
                <Descriptions.Item label="Language">
                  {selectedEvent.device_info.language}
                </Descriptions.Item>
              </Descriptions>
            )}

            {selectedEvent.tags && Object.keys(selectedEvent.tags).length > 0 && (
              <Descriptions title="Tags" column={1} bordered size="small">
                {Object.entries(selectedEvent.tags).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {value}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}

            {selectedEvent.fields && Object.keys(selectedEvent.fields).length > 0 && (
              <Descriptions title="Fields" column={1} bordered size="small">
                {Object.entries(selectedEvent.fields).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {value}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}
          </Space>
        )}
      </Drawer>
    </>
  )
}
