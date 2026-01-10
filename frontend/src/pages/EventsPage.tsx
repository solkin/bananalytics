import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Select, Space, Typography, message } from 'antd'
import type { EventSummary, VersionInfo } from '@/api/events'
import { getEventSummary, getEventVersions } from '@/api/events'

export default function EventsPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<EventSummary[]>([])
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined)

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

  useEffect(() => {
    if (appId) loadData()
  }, [appId, selectedVersion])

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

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
        onRow={(record) => ({
          onClick: () => navigate(encodeURIComponent(record.name)),
          style: { cursor: 'pointer' },
        })}
      />
    </Space>
  )
}
