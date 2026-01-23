import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Select, Space, Typography, message, Card, DatePicker } from 'antd'
import { Line } from '@ant-design/charts'
import type { EventSummary, VersionInfo, SessionVersionStats } from '@/api/events'
import { getEventSummary, getEventVersions, getUniqueSessionsByVersion } from '@/api/events'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

// Colors for version lines
const versionColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa541c', '#2f54eb']

export default function EventsPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<EventSummary[]>([])
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [sessionStats, setSessionStats] = useState<SessionVersionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(14, 'day'),
    dayjs(),
  ])

  const loadData = async () => {
    try {
      setLoading(true)
      const [summaryData, versionsData] = await Promise.all([
        getEventSummary(appId!, selectedVersion),
        getEventVersions(appId!),
      ])
      setData(summaryData)
      setVersions(versionsData)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  const loadSessionStats = async () => {
    try {
      const stats = await getUniqueSessionsByVersion(appId!, {
        from: dateRange[0].startOf('day').toISOString(),
        to: dateRange[1].endOf('day').toISOString(),
      })
      
      // Transform data for multi-line chart
      const transformed = stats.map(s => ({
        ...s,
        version: s.version_name ? `${s.version_name} (${s.version_code})` : `v${s.version_code}`,
      }))
      
      // Get unique versions from the data
      const uniqueVersions = [...new Set(transformed.map(s => s.version))]
      
      // Create a map for quick lookup
      const dataMap = new Map<string, number>()
      transformed.forEach(s => {
        dataMap.set(`${s.date}-${s.version}`, s.count)
      })
      
      // Fill missing dates for each version
      const filledData: SessionVersionStats[] = []
      let current = dateRange[0].startOf('day')
      const end = dateRange[1].startOf('day')
      
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        uniqueVersions.forEach(version => {
          const count = dataMap.get(`${dateStr}-${version}`) || 0
          filledData.push({
            date: dateStr,
            version_code: 0, // Not used in chart
            version_name: null,
            count,
            version,
          } as SessionVersionStats & { version: string })
        })
        current = current.add(1, 'day')
      }
      
      setSessionStats(filledData as SessionVersionStats[])
    } catch (error) {
      console.error('Failed to load session stats', error)
    }
  }

  useEffect(() => {
    if (appId) loadData()
  }, [appId, selectedVersion])

  useEffect(() => {
    if (appId) loadSessionStats()
  }, [appId, dateRange])

  const columns = [
    {
      title: 'Event Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      sorter: (a: EventSummary, b: EventSummary) => a.total - b.total,
      render: (count: number) => (
        <Typography.Text strong>{count.toLocaleString()}</Typography.Text>
      ),
    },
    {
      title: 'This Month',
      dataIndex: 'this_month',
      key: 'this_month',
      width: 120,
      sorter: (a: EventSummary, b: EventSummary) => a.this_month - b.this_month,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: 'Today',
      dataIndex: 'today',
      key: 'today',
      width: 120,
      sorter: (a: EventSummary, b: EventSummary) => a.today - b.today,
      render: (count: number) => count.toLocaleString(),
    },
  ]

  // Check if we have session data
  const hasSessionData = sessionStats.length > 0

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {hasSessionData && (
        <Card
          title="Unique Sessions by Version"
          styles={{ header: { borderBottom: '1px solid #f0f0f0' }, body: { padding: '8px 0 0 0' } }}
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
          <Line
            data={sessionStats.map(s => ({
              date: s.date,
              count: s.count,
              version: (s as any).version || `v${s.version_code}`,
            }))}
            xField="date"
            yField="count"
            colorField="version"
            shapeField="smooth"
            height={200}
            scale={{
              color: {
                range: versionColors,
              },
            }}
            axis={{
              x: {
                labelFormatter: (v: string) => dayjs(v).format('MM-DD'),
              },
              y: {
                labelFormatter: (v: number) => Number.isInteger(v) ? v.toString() : '',
                tickFilter: (d: number) => Number.isInteger(d),
              },
            }}
            style={{
              lineWidth: 2,
            }}
            interaction={{
              tooltip: {
                render: (_: any, { title, items }: any) => {
                  return `<div style="padding: 8px">
                    <div style="margin-bottom: 4px; font-weight: 500">${dayjs(title).format('YYYY-MM-DD')}</div>
                    ${items.map((item: any) => `
                      <div style="display: flex; align-items: center; gap: 8px">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color}"></span>
                        <span>${item.name}: ${item.value}</span>
                      </div>
                    `).join('')}
                  </div>`;
                },
              },
            }}
            legend={{
              color: {
                position: 'bottom',
                layout: { justifyContent: 'center' },
              },
            }}
          />
        </Card>
      )}

      <Space wrap>
        <Select
          placeholder="Filter by version"
          allowClear
          style={{ width: 200 }}
          value={selectedVersion}
          onChange={setSelectedVersion}
          options={versions.map((v) => ({
            label: v.version_name ? `${v.version_name} (${v.version_code})` : `Version ${v.version_code}`,
            value: v.version_code,
          }))}
        />
      </Space>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="name"
        loading={loading}
        pagination={false}
        bordered
        style={{ borderRadius: '8px 8px 0 0', overflow: 'hidden' }}
        onRow={(record) => ({
          onClick: () => navigate(encodeURIComponent(record.name)),
          style: { cursor: 'pointer' },
        })}
      />
    </Space>
  )
}
