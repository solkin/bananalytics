import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Table, Tag, Select, Space, Typography, message, Card, DatePicker } from 'antd'
import { Column, Line } from '@ant-design/charts'
import type { CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroups, getCrashVersions, getAppCrashStats, getCrashFreeStatsByVersion, type VersionInfo, type DailyStat, type SessionVersionStats } from '@/api/crashes'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { RangePicker } = DatePicker

const statusColors: Record<string, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
}

// Colors for version lines
const versionColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2']

export default function CrashesPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Read initial state from URL
  const status = searchParams.get('status') || undefined
  const selectedVersion = searchParams.get('version') ? Number(searchParams.get('version')) : undefined
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1

  const [data, setData] = useState<PaginatedResponse<CrashGroup> | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [stats, setStats] = useState<DailyStat[]>([])
  const [crashFreeStats, setCrashFreeStats] = useState<(SessionVersionStats & { version: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(14, 'day'),
    dayjs(),
  ])

  // Update URL params
  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })
      return newParams
    })
  }, [setSearchParams])

  const loadCrashes = async () => {
    try {
      setLoading(true)
      const [result, versionsData] = await Promise.all([
        getCrashGroups(appId!, { status, version: selectedVersion, page, pageSize: 20 }),
        getCrashVersions(appId!),
      ])
      setData(result)
      setVersions(versionsData)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load crashes')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const [statsData, crashFreeData] = await Promise.all([
        getAppCrashStats(appId!, {
          from: dateRange[0].startOf('day').toISOString(),
          to: dateRange[1].endOf('day').toISOString(),
        }),
        getCrashFreeStatsByVersion(appId!, {
          from: dateRange[0].startOf('day').toISOString(),
          to: dateRange[1].endOf('day').toISOString(),
        }),
      ])
      
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
      
      // Transform crash-free data for multi-line chart
      const transformed = crashFreeData.map(s => ({
        ...s,
        version: s.version_name ? `${s.version_name} (${s.version_code})` : `v${s.version_code}`,
      }))
      
      // Get unique versions from the data
      const uniqueVersions = [...new Set(transformed.map(s => s.version))]
      
      // Create a map for quick lookup (key: date-version, value: count which is crash-free rate * 10)
      const dataMap = new Map<string, number>()
      transformed.forEach(s => {
        dataMap.set(`${s.date}-${s.version}`, s.count)
      })
      
      // Fill missing dates for each version
      const filledCrashFree: (SessionVersionStats & { version: string })[] = []
      current = dateRange[0].startOf('day')
      
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        uniqueVersions.forEach(version => {
          const count = dataMap.get(`${dateStr}-${version}`) ?? 1000 // 1000 = 100% when no data
          filledCrashFree.push({
            date: dateStr,
            version_code: 0,
            version_name: null,
            count,
            version,
          })
        })
        current = current.add(1, 'day')
      }
      
      setCrashFreeStats(filledCrashFree)
    } catch (error) {
      console.error('Failed to load stats', error)
    }
  }

  useEffect(() => {
    if (appId) loadCrashes()
  }, [appId, status, selectedVersion, page])

  useEffect(() => {
    if (appId) loadStats()
  }, [appId, dateRange])

  const columns = [
    {
      title: 'Exception',
      key: 'exception',
      render: (_: unknown, record: CrashGroup) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong style={{ color: '#1890ff' }}>
            {record.exception_class || 'Unknown Exception'}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: 500 }}>
            {record.exception_message || 'No message'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Count',
      dataIndex: 'occurrences',
      key: 'occurrences',
      width: 80,
      render: (count: number) => <Typography.Text strong>{count}</Typography.Text>,
    },
    {
      title: 'Last Seen',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 150,
      render: (date: string) => dayjs(date).fromNow(),
    },
    {
      title: 'First Seen',
      dataIndex: 'first_seen',
      key: 'first_seen',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ]

  // Check if we have session data
  const hasSessionData = crashFreeStats.length > 0

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {hasSessionData && (
        <Card
          title="Crash-Free Sessions"
          styles={{ header: { background: '#fafafa' }, body: { padding: '8px 0 0 0' } }}
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
            data={crashFreeStats.map(s => ({
              date: s.date,
              rate: s.count / 10, // count stores rate * 10 for precision
              version: s.version,
            }))}
            xField="date"
            yField="rate"
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
                labelFormatter: (v: number) => `${v}%`,
                domainMin: 0,
                domainMax: 100,
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
                        <span>${item.name}: ${item.value.toFixed(1)}%</span>
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

      <Card
        title="Crash Timeline"
        styles={{ header: { background: '#fafafa' }, body: { padding: '8px 0 0 0' } }}
        extra={
          !hasSessionData && (
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]])
                }
              }}
              allowClear={false}
            />
          )
        }
      >
        <Column
          data={stats}
          xField="date"
          yField="count"
          height={200}
          style={{ fill: '#ff4d4f' }}
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
                  <div>Crashes: ${items[0]?.value ?? 0}</div>
                </div>`;
              },
            },
          }}
        />
      </Card>

      <Space wrap>
        <Select
          placeholder="Filter by status"
          allowClear
          style={{ width: 150 }}
          value={status}
          onChange={(v) => {
            updateParams({ status: v, page: undefined })
          }}
          options={[
            { label: 'Open', value: 'open' },
            { label: 'Resolved', value: 'resolved' },
            { label: 'Ignored', value: 'ignored' },
          ]}
        />
        <Select
          placeholder="Filter by version"
          allowClear
          style={{ width: 200 }}
          value={selectedVersion}
          onChange={(v) => {
            updateParams({ version: v?.toString(), page: undefined })
          }}
          options={versions.map((v) => ({
            label: v.version_name ? `${v.version_name} (${v.version_code})` : `Version ${v.version_code}`,
            value: v.version_code,
          }))}
        />
      </Space>

      <Table
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        loading={loading}
        bordered
        style={{ borderRadius: '8px 8px 0 0', overflow: 'hidden' }}
        onRow={(record) => ({
          onClick: () => navigate(record.id),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: (p) => updateParams({ page: p > 1 ? p.toString() : undefined }),
          showSizeChanger: false,
        }}
      />
    </Space>
  )
}
