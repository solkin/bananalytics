import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  DatePicker,
  Modal,
  Segmented,
} from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { Column } from '@ant-design/charts'
import type { Crash, CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroup, getCrashesInGroup, updateCrashGroupStatus, retraceCrash, getCrashStats, deleteCrashGroup, type DailyStat } from '@/api/crashes'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const { Text, Paragraph } = Typography

const statusColors: Record<string, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
}

export default function CrashDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<CrashGroup | null>(null)
  const [crashes, setCrashes] = useState<PaginatedResponse<Crash> | null>(null)
  const [selectedCrash, setSelectedCrash] = useState<Crash | null>(null)
  const [loading, setLoading] = useState(true)
  const [retracing, setRetracing] = useState(false)
  const [stats, setStats] = useState<DailyStat[]>([])
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(14, 'day'),
    dayjs(),
  ])
  const [stacktraceView, setStacktraceView] = useState<'decoded' | 'raw'>('decoded')

  useEffect(() => {
    if (groupId) loadData()
  }, [groupId])

  useEffect(() => {
    if (groupId) loadStats()
  }, [groupId, dateRange])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupData, crashesData] = await Promise.all([
        getCrashGroup(groupId!),
        getCrashesInGroup(groupId!, { pageSize: 50 }),
      ])
      setGroup(groupData)
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

  const loadStats = async () => {
    try {
      const statsData = await getCrashStats(groupId!, {
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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Descriptions
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
          <Descriptions.Item label="Message" span={3}>
            {group.exception_message || 'No message'}
          </Descriptions.Item>
          <Descriptions.Item label="Occurrences">{group.occurrences}</Descriptions.Item>
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

      {selectedCrash && (
        <Card
          title="Crash Details"
          styles={{ header: { background: '#fafafa' }, body: { paddingTop: 8, paddingBottom: 8 } }}
          extra={
            <Space>
              <Select
                value={selectedCrash.id}
                style={{ width: 300 }}
                onChange={(id) => {
                  const crash = crashes?.items.find((c) => c.id === id)
                  if (crash) setSelectedCrash(crash)
                }}
                options={crashes?.items.map((c) => ({
                  label: `${dayjs(c.created_at).format('YYYY-MM-DD HH:mm')} - ${c.device_info?.model || 'Unknown'}`,
                  value: c.id,
                }))}
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
                    <Paragraph>
                      <pre className="stacktrace">
                        {stacktraceView === 'raw' || !selectedCrash.stacktrace_decoded
                          ? selectedCrash.stacktrace_raw
                          : selectedCrash.stacktrace_decoded}
                      </pre>
                    </Paragraph>
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
