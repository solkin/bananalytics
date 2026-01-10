import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Table, Tag, Select, Space, Typography, message } from 'antd'
import type { CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroups } from '@/api/crashes'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const statusColors: Record<string, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
}

export default function CrashesPage() {
  const { appId } = useParams<{ appId: string }>()
  const [data, setData] = useState<PaginatedResponse<CrashGroup> | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const loadCrashes = async () => {
    try {
      setLoading(true)
      const result = await getCrashGroups(appId!, { status, page, pageSize: 20 })
      setData(result)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load crashes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (appId) loadCrashes()
  }, [appId, status, page])

  const columns = [
    {
      title: 'Exception',
      key: 'exception',
      render: (_: unknown, record: CrashGroup) => (
        <Link to={record.id}>
          <Space direction="vertical" size={0}>
            <Typography.Text strong style={{ color: '#1890ff' }}>
              {record.exception_class || 'Unknown Exception'}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: 500 }}>
              {record.exception_message || 'No message'}
            </Typography.Text>
          </Space>
        </Link>
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

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <Select
          placeholder="Filter by status"
          allowClear
          style={{ width: 150 }}
          value={status}
          onChange={setStatus}
          options={[
            { label: 'Open', value: 'open' },
            { label: 'Resolved', value: 'resolved' },
            { label: 'Ignored', value: 'ignored' },
          ]}
        />
      </Space>

      <Table
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        loading={loading}
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
