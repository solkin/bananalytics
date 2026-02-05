import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Select,
  Button,
  Typography,
  Timeline,
  Space,
  Tabs,
  message,
  Alert,
  Modal,
  Segmented,
} from 'antd'
import { ReloadOutlined, DeleteOutlined, ArrowLeftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Column } from '@ant-design/charts'
import type { Crash, CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroup, getCrashesInGroup, getCrashGroupVersions, updateCrashGroupStatus, retraceCrash, getCrashStats, deleteCrashGroup, type DailyStat, type VersionInfo } from '@/api/crashes'
import dayjs from 'dayjs'

const { Text } = Typography

const dateRangeOptions = [
  { label: 'Last 24 hours', value: 1 },
  { label: 'Last 3 days', value: 3 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 28 days', value: 28 },
]

const statusColors: Record<string, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
}

export default function CrashDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Read filters from URL
  const selectedVersion = searchParams.has('version') ? Number(searchParams.get('version')) : undefined
  const days = searchParams.has('days') ? Number(searchParams.get('days')) : 28
  
  const [group, setGroup] = useState<CrashGroup | null>(null)
  const [crashes, setCrashes] = useState<PaginatedResponse<Crash> | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [selectedCrash, setSelectedCrash] = useState<Crash | null>(null)
  const [loading, setLoading] = useState(true)
  const [retracing, setRetracing] = useState(false)
  const [stats, setStats] = useState<DailyStat[]>([])
  const [stacktraceView, setStacktraceView] = useState<'decoded' | 'raw'>('decoded')

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

  useEffect(() => {
    if (groupId) loadData()
  }, [groupId])

  useEffect(() => {
    if (groupId && group) {
      loadCrashes()
      loadStats()
    }
  }, [groupId, days, selectedVersion])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupData, versionsData] = await Promise.all([
        getCrashGroup(groupId!),
        getCrashGroupVersions(groupId!),
      ])
      setGroup(groupData)
      setVersions(versionsData)
      
      // Load crashes with current filters
      const crashesData = await getCrashesInGroup(groupId!, { 
        version: selectedVersion, 
        days, 
        pageSize: 50 
      })
      setCrashes(crashesData)
      if (crashesData.items.length > 0) {
        setSelectedCrash(crashesData.items[0])
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load crash')
    } finally {
      setLoading(false)
    }
  }

  const loadCrashes = async () => {
    try {
      const crashesData = await getCrashesInGroup(groupId!, { 
        version: selectedVersion, 
        days, 
        pageSize: 50 
      })
      setCrashes(crashesData)
      if (crashesData.items.length > 0) {
        setSelectedCrash(crashesData.items[0])
      } else {
        setSelectedCrash(null)
      }
    } catch (error) {
      console.error('Failed to load crashes', error)
    }
  }

  const loadStats = async () => {
    try {
      const fromDate = dayjs().subtract(days, 'day').startOf('day')
      const toDate = dayjs().endOf('day')
      
      const statsData = await getCrashStats(groupId!, {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        version: selectedVersion,
      })
      
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
    } catch (error) {
      console.error('Failed to load stats', error)
    }
  }

  const handleStatusChange = async (status: 'open' | 'resolved' | 'ignored') => {
    try {
      const updated = await updateCrashGroupStatus(groupId!, status)
      setGroup(updated)
      message.success(`Status changed to ${status}`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update status')
    }
  }

  const handleRetrace = async () => {
    if (!selectedCrash) return
    try {
      setRetracing(true)
      const updated = await retraceCrash(selectedCrash.id)
      setSelectedCrash(updated)
      message.success('Stacktrace retraced')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to retrace')
    } finally {
      setRetracing(false)
    }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Crash Group',
      content: (
        <Space direction="vertical">
          <Typography.Text>
            Are you sure you want to delete this crash group?
          </Typography.Text>
          <Typography.Text type="danger">
            This will permanently delete all {group?.occurrences || 0} crashes in this group.
          </Typography.Text>
        </Space>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCrashGroup(groupId!)
          message.success('Crash group deleted')
          navigate('..')
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete')
        }
      },
    })
  }

  if (loading || !group) {
    return <Card loading />
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Header with back button and filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('..')}
        >
          Back to Crashes
        </Button>
        <Space>
          <Select
            placeholder="All versions"
            allowClear
            style={{ width: 180 }}
            value={selectedVersion}
            onChange={(v) => updateParams({ version: v?.toString() })}
            options={versions.map((v) => ({
              label: v.version_name ? `${v.version_name} (${v.version_code})` : `Version ${v.version_code}`,
              value: v.version_code,
            }))}
          />
          <Select
            style={{ width: 140 }}
            value={days}
            onChange={(v) => updateParams({ days: v !== 28 ? v.toString() : undefined })}
            options={dateRangeOptions}
          />
        </Space>
      </div>

      <Card>
        <Descriptions
          column={4}
          title={
            <Space>
              <span>{group.exception_class || 'Unknown Exception'}</span>
              <Tag color={statusColors[group.status]}>{group.status.toUpperCase()}</Tag>
            </Space>
          }
          extra={
            <Space>
              <Select
                value={group.status}
                onChange={handleStatusChange}
                style={{ width: 120 }}
                options={[
                  { label: 'Open', value: 'open' },
                  { label: 'Resolved', value: 'resolved' },
                  { label: 'Ignored', value: 'ignored' },
                ]}
              />
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                Delete
              </Button>
            </Space>
          }
        >
          <Descriptions.Item label="Message" span={4}>
            {group.exception_message || 'No message'}
          </Descriptions.Item>
          <Descriptions.Item label="Occurrences">{group.occurrences}</Descriptions.Item>
          <Descriptions.Item label="Devices">{group.affected_devices}</Descriptions.Item>
          <Descriptions.Item label="First Seen">
            {dayjs(group.first_seen).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="Last Seen">
            {dayjs(group.last_seen).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="Crash Timeline"
        size="small"
        styles={{ body: { padding: '12px' } }}
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

      {selectedCrash && (
        <Card
          title="Crash Details"
          styles={{ header: { borderBottom: '1px solid #f0f0f0' }, body: { paddingTop: 8, paddingBottom: 8 } }}
          extra={
            <Space>
              <Button
                icon={<LeftOutlined />}
                disabled={!crashes?.items.length || crashes.items[0].id === selectedCrash.id}
                onClick={() => {
                  const currentIndex = crashes?.items.findIndex((c) => c.id === selectedCrash.id) ?? -1
                  if (currentIndex > 0) {
                    setSelectedCrash(crashes!.items[currentIndex - 1])
                  }
                }}
              />
              <Select
                value={selectedCrash.id}
                style={{ width: 280 }}
                onChange={(id) => {
                  const crash = crashes?.items.find((c) => c.id === id)
                  if (crash) setSelectedCrash(crash)
                }}
                options={crashes?.items.map((c) => ({
                  label: `${dayjs(c.created_at).format('MMM D, HH:mm')} – ${c.device_info?.model || 'Unknown'}`,
                  value: c.id,
                }))}
              />
              <Button
                icon={<RightOutlined />}
                disabled={!crashes?.items.length || crashes.items[crashes.items.length - 1].id === selectedCrash.id}
                onClick={() => {
                  const currentIndex = crashes?.items.findIndex((c) => c.id === selectedCrash.id) ?? -1
                  if (currentIndex >= 0 && currentIndex < (crashes?.items.length ?? 0) - 1) {
                    setSelectedCrash(crashes!.items[currentIndex + 1])
                  }
                }}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRetrace}
                loading={retracing}
                disabled={!selectedCrash.version_code}
              >
                Retrace
              </Button>
            </Space>
          }
        >
          <Tabs
            items={[
              {
                key: 'stacktrace',
                label: 'Stacktrace',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {selectedCrash.decode_error && (
                      <Alert
                        type="warning"
                        message="Retrace failed"
                        description={selectedCrash.decode_error}
                        showIcon
                      />
                    )}
                    {selectedCrash.stacktrace_decoded && (
                      <Segmented
                        value={stacktraceView}
                        onChange={(value) => setStacktraceView(value as 'decoded' | 'raw')}
                        options={[
                          { label: 'Deobfuscated', value: 'decoded' },
                          { label: 'Original', value: 'raw' },
                        ]}
                      />
                    )}
                    <pre className="stacktrace" style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {stacktraceView === 'raw' || !selectedCrash.stacktrace_decoded
                        ? selectedCrash.stacktrace_raw
                        : selectedCrash.stacktrace_decoded}
                    </pre>
                  </Space>
                ),
              },
              {
                key: 'device',
                label: 'Device',
                children: selectedCrash.device_info && (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="Model">
                      {selectedCrash.device_info.manufacturer} {selectedCrash.device_info.model}
                    </Descriptions.Item>
                    <Descriptions.Item label="OS Version">
                      Android {selectedCrash.device_info.os_version}
                    </Descriptions.Item>
                    <Descriptions.Item label="Country">
                      {selectedCrash.device_info.country}
                    </Descriptions.Item>
                    <Descriptions.Item label="Language">
                      {selectedCrash.device_info.language}
                    </Descriptions.Item>
                    <Descriptions.Item label="Thread">
                      {selectedCrash.thread || 'Unknown'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Version Code">
                      {selectedCrash.version_code || 'Unknown'}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'breadcrumbs',
                label: 'Breadcrumbs',
                children: selectedCrash.breadcrumbs && selectedCrash.breadcrumbs.length > 0 ? (
                  <Timeline
                    items={selectedCrash.breadcrumbs.map((b) => ({
                      children: (
                        <Space direction="vertical" size={0}>
                          <Text strong>{b.message}</Text>
                          <Text type="secondary">
                            {b.category} • {dayjs(b.timestamp).format('HH:mm:ss.SSS')}
                          </Text>
                        </Space>
                      ),
                    }))}
                  />
                ) : (
                  <Text type="secondary">No breadcrumbs</Text>
                ),
              },
              {
                key: 'context',
                label: 'Context',
                children: selectedCrash.context && Object.keys(selectedCrash.context).length > 0 ? (
                  <Descriptions column={1} bordered size="small">
                    {Object.entries(selectedCrash.context).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        {value}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                ) : (
                  <Text type="secondary">No context data</Text>
                ),
              },
            ]}
          />
        </Card>
      )}
    </Space>
  )
}
