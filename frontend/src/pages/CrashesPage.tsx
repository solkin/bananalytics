import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Tag, Select, Space, Typography, message, Card, DatePicker } from 'antd'
import { Column, Line } from '@ant-design/charts'
import type { CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroups, getCrashVersions, getAppCrashStats, getCrashFreeStats, type VersionInfo, type DailyStat, type CrashFreeStats } from '@/api/crashes'
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
  const [data, setData] = useState<PaginatedResponse<CrashGroup> | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [stats, setStats] = useState<DailyStat[]>([])
  const [crashFreeStats, setCrashFreeStats] = useState<CrashFreeStats[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(14, 'day'),
    dayjs(),
  ])

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
        getCrashFreeStats(appId!, {
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
      
      // Fill crash-free stats
      const crashFreeMap = new Map(crashFreeData.map(s => [s.date, s]))
      const filledCrashFree: CrashFreeStats[] = []
      current = dateRange[0].startOf('day')
      
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD')
        const existing = crashFreeMap.get(dateStr)
        filledCrashFree.push(existing || {
          date: dateStr,
          total_sessions: 0,
          crash_free_sessions: 0,
          crash_free_rate: 100,
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
  const hasSessionData = crashFreeStats.some(s => s.total_sessions > 0)

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {hasSessionData && (
        <Card
          title="Crash-Free Sessions"
          styles={{ header: { background: '#fafafa' } }}
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
            data={crashFreeStats}
            xField="date"
            yField="crash_free_rate"
            height={200}
            color="#52c41a"
            xAxis={{
              label: {
                formatter: (v: string) => dayjs(v).format('MM-DD'),
              },
            }}
            yAxis={{
              min: 0,
              max: 100,
              label: {
                formatter: (v: string) => `${v}%`,
              },
            }}
            point={{
              size: 3,
              shape: 'circle',
            }}
            tooltip={{
              title: (d: CrashFreeStats) => dayjs(d.date).format('YYYY-MM-DD'),
              items: [
                { channel: 'y', name: 'Crash-Free Rate', valueFormatter: (v: number) => `${v.toFixed(1)}%` },
              ],
            }}
          />
        </Card>
      )}

      <Card
        title="Crash Timeline"
        styles={{ header: { background: '#fafafa' } }}
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
          color="#ff4d4f"
          xAxis={{
            label: {
              formatter: (v: string) => dayjs(v).format('MM-DD'),
            },
          }}
          yAxis={{
            label: {
              formatter: (v: string) => Math.floor(Number(v)).toString(),
            },
          }}
          tooltip={{
            title: (d: DailyStat) => dayjs(d.date).format('YYYY-MM-DD'),
            items: [{ channel: 'y', name: 'Crashes' }],
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
            setStatus(v)
            setPage(1)
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
            setSelectedVersion(v)
            setPage(1)
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
          onChange: setPage,
          showSizeChanger: false,
        }}
      />
    </Space>
  )
}
