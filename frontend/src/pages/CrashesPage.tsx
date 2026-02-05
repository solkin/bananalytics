import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Table, Tag, Select, Space, Typography, message, Card } from 'antd'
import { Column, Line } from '@ant-design/charts'
import type { CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroups, getCrashVersions, getAppCrashStats, getCrashFreeStatsByVersion, type VersionInfo, type DailyStat, type SessionVersionStats } from '@/api/crashes'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const statusColors: Record<string, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
}

const formatCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

// Colors for version lines
const versionColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2']

// Date range options
const dateRangeOptions = [
  { label: 'Last 24 hours', value: 1 },
  { label: 'Last 3 days', value: 3 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 28 days', value: 28 },
]

// LocalStorage helpers
const STORAGE_KEY = 'crashes_filters'

interface StoredFilters {
  version?: number
  days?: number
  status?: string
}

function getStoredFilters(appId: string): StoredFilters {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${appId}`)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveFilters(appId: string, filters: StoredFilters) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${appId}`, JSON.stringify(filters))
  } catch {
    // Ignore storage errors
  }
}

export default function CrashesPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialized, setInitialized] = useState(false)
  
  // Get stored filters for this app
  const storedFilters = appId ? getStoredFilters(appId) : {}
  
  // Read state: URL params take priority, then localStorage, then defaults
  const hasUrlParams = searchParams.has('status') || searchParams.has('version') || searchParams.has('days')
  
  const status = searchParams.get('status') || (hasUrlParams ? undefined : storedFilters.status) || undefined
  const selectedVersion = searchParams.has('version') 
    ? Number(searchParams.get('version')) 
    : (hasUrlParams ? undefined : storedFilters.version)
  const days = searchParams.has('days') 
    ? Number(searchParams.get('days')) 
    : (hasUrlParams ? 28 : (storedFilters.days ?? 28))
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1

  const [data, setData] = useState<PaginatedResponse<CrashGroup> | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [stats, setStats] = useState<DailyStat[]>([])
  const [crashFreeStats, setCrashFreeStats] = useState<(SessionVersionStats & { version: string })[]>([])
  const [loading, setLoading] = useState(true)

  // Initialize URL from localStorage if no URL params
  useEffect(() => {
    if (!initialized && appId && !hasUrlParams && Object.keys(storedFilters).length > 0) {
      const newParams = new URLSearchParams()
      if (storedFilters.version) newParams.set('version', storedFilters.version.toString())
      if (storedFilters.days && storedFilters.days !== 28) newParams.set('days', storedFilters.days.toString())
      if (storedFilters.status) newParams.set('status', storedFilters.status)
      if (newParams.toString()) {
        setSearchParams(newParams, { replace: true })
      }
    }
    setInitialized(true)
  }, [appId])

  // Save filters to localStorage when they change
  useEffect(() => {
    if (appId && initialized) {
      saveFilters(appId, {
        version: selectedVersion,
        days,
        status,
      })
    }
  }, [appId, selectedVersion, days, status, initialized])

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
        getCrashGroups(appId!, { status, version: selectedVersion, days, page, pageSize: 20 }),
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
      const fromDate = dayjs().subtract(days, 'day').startOf('day')
      const toDate = dayjs().endOf('day')
      
      const [statsData, crashFreeData] = await Promise.all([
        getAppCrashStats(appId!, {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          version: selectedVersion,
        }),
        getCrashFreeStatsByVersion(appId!, {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          version: selectedVersion,
        }),
      ])
      
      // Fill all dates in range with zeros where no data
      const statsMap = new Map(statsData.map(s => [s.date, s.count]))
      const filledStats: DailyStat[] = []
      let current = fromDate
      const end = toDate.startOf('day')
      
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
      current = fromDate
      
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
  }, [appId, status, selectedVersion, days, page])

  useEffect(() => {
    if (appId) loadStats()
  }, [appId, days, selectedVersion])

  const columns = [
    {
      title: 'Exception',
      key: 'exception',
      ellipsis: true,
      render: (_: unknown, record: CrashGroup) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {record.exception_class || 'Unknown Exception'}
          </div>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
            {record.exception_message || 'No message'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={statusColors[status]} style={{ margin: 0 }}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Count',
      dataIndex: 'occurrences',
      key: 'occurrences',
      width: 70,
      align: 'right' as const,
      render: (count: number) => (
        <span style={{ fontWeight: 500 }}>{formatCount(count)}</span>
      ),
    },
    {
      title: 'Devices',
      dataIndex: 'affected_devices',
      key: 'affected_devices',
      width: 70,
      align: 'right' as const,
      render: (count: number) => (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {formatCount(count)}
        </Typography.Text>
      ),
    },
    {
      title: 'Last Report',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 120,
      render: (date: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {dayjs(date).fromNow()}
        </Typography.Text>
      ),
    },
  ]

  // Check if we have session data
  const hasSessionData = crashFreeStats.length > 0

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Header with title and filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Crashes</Typography.Title>
        <Space wrap>
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
          <Select
            value={days}
            style={{ width: 150 }}
            onChange={(v) => {
              updateParams({ days: v !== 28 ? v.toString() : undefined, page: undefined })
            }}
            options={dateRangeOptions}
          />
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
        </Space>
      </div>

      {hasSessionData && (
        <Card
          title="Crash-Free Sessions"
          styles={{ header: { borderBottom: '1px solid #f0f0f0' }, body: { padding: '8px 0 0 0' } }}
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
                position: 'bottom-right',
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
        styles={{ header: { borderBottom: '1px solid #f0f0f0' }, body: { padding: '8px 0 0 0' } }}
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
              position: 'bottom-right',
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

      <Table
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
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
          size: 'small',
        }}
      />
    </Space>
  )
}
