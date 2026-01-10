import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Table, Select, DatePicker, Space, Typography, Tag, message, Drawer, Descriptions } from 'antd'
import type { Event, PaginatedResponse } from '@/types'
import { getEvents, getEventNames } from '@/api/events'
import dayjs, { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

export default function EventsPage() {
  const { appId } = useParams<{ appId: string }>()
  const [data, setData] = useState<PaginatedResponse<Event> | null>(null)
  const [eventNames, setEventNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedName, setSelectedName] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const loadEvents = async () => {
    try {
      setLoading(true)
      const result = await getEvents(appId!, {
        name: selectedName,
        from: dateRange?.[0]?.toISOString(),
        to: dateRange?.[1]?.toISOString(),
        page,
        pageSize: 50,
      })
      setData(result)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  const loadEventNames = async () => {
    try {
      const names = await getEventNames(appId!)
      setEventNames(names)
    } catch (error) {
      // Ignore
    }
  }

  useEffect(() => {
    if (appId) {
      loadEventNames()
    }
  }, [appId])

  useEffect(() => {
    if (appId) loadEvents()
  }, [appId, selectedName, dateRange, page])

  const columns = [
    {
      title: 'Event Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Tag>{name}</Tag>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: Record<string, string> | null) =>
        tags ? (
          <Space wrap>
            {Object.entries(tags).slice(0, 3).map(([k, v]) => (
              <Tag key={k} color="blue">
                {k}: {v}
              </Tag>
            ))}
            {Object.keys(tags).length > 3 && <Tag>+{Object.keys(tags).length - 3}</Tag>}
          </Space>
        ) : null,
    },
    {
      title: 'Fields',
      dataIndex: 'fields',
      key: 'fields',
      render: (fields: Record<string, number> | null) =>
        fields ? (
          <Space wrap>
            {Object.entries(fields).slice(0, 2).map(([k, v]) => (
              <Typography.Text key={k} code>
                {k}: {v}
              </Typography.Text>
            ))}
            {Object.keys(fields).length > 2 && <Tag>+{Object.keys(fields).length - 2}</Tag>}
          </Space>
        ) : null,
    },
    {
      title: 'Device',
      key: 'device',
      render: (_: unknown, record: Event) =>
        record.device_info ? (
          <Typography.Text type="secondary">
            {record.device_info.manufacturer} {record.device_info.model}
          </Typography.Text>
        ) : null,
    },
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Select
            placeholder="Filter by event name"
            allowClear
            showSearch
            style={{ width: 200 }}
            value={selectedName}
            onChange={(value) => {
              setSelectedName(value)
              setPage(1)
            }}
            options={eventNames.map((name) => ({ label: name, value: name }))}
          />
          <RangePicker
            showTime
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates as [Dayjs, Dayjs] | null)
              setPage(1)
            }}
          />
        </Space>

        <Table
          dataSource={data?.items || []}
          columns={columns}
          rowKey="id"
          loading={loading}
          onRow={(record) => ({
            onClick: () => setSelectedEvent(record),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: 50,
            total: data?.total || 0,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} events`,
          }}
        />
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
                {selectedEvent.version_code || 'Unknown'}
              </Descriptions.Item>
            </Descriptions>

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
          </Space>
        )}
      </Drawer>
    </>
  )
}
