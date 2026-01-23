import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Select, Space, message, Row, Col, Table, Empty } from 'antd'
import { Bar } from '@ant-design/charts'
import { getDeviceStats, getEventVersions, type DeviceStats, type VersionInfo } from '@/api/events'

export default function DevicesPage() {
  const { appId } = useParams<{ appId: string }>()
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (appId) {
      loadVersions()
    }
  }, [appId])

  useEffect(() => {
    if (appId) {
      loadStats()
    }
  }, [appId, selectedVersion])

  const loadVersions = async () => {
    try {
      const data = await getEventVersions(appId!)
      setVersions(data)
    } catch (error) {
      console.error('Failed to load versions', error)
    }
  }

  const loadStats = async () => {
    try {
      setLoading(true)
      const data = await getDeviceStats(appId!, { version: selectedVersion, limit: 10 })
      setStats(data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load device stats')
    } finally {
      setLoading(false)
    }
  }

  const hasData = stats && (
    stats.models.length > 0 ||
    stats.os_versions.length > 0 ||
    stats.countries.length > 0 ||
    stats.languages.length > 0
  )

  const chartConfig = (data: { name: string; count: number }[], color: string) => ({
    data,
    xField: 'count',
    yField: 'name',
    height: Math.max(200, data.length * 32),
    color,
    label: {
      text: 'count',
      position: 'right' as const,
      style: { fill: '#595959' },
    },
    axis: {
      y: { 
        labelFormatter: (v: string) => v.length > 20 ? v.substring(0, 20) + '...' : v,
      },
      x: {
        labelFormatter: (v: number) => v.toLocaleString(),
      },
    },
    interaction: {
      tooltip: {
        position: 'bottom' as const,
      },
    },
  })

  const tableColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      align: 'right' as const,
      render: (count: number) => count.toLocaleString(),
    },
  ]

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap>
          <span style={{ color: '#8c8c8c' }}>Filter by version:</span>
          <Select
            placeholder="All versions"
            allowClear
            style={{ width: 200 }}
            value={selectedVersion}
            onChange={(v) => setSelectedVersion(v)}
            options={versions.map((v) => ({
              label: v.version_name ? `${v.version_name} (${v.version_code})` : `Version ${v.version_code}`,
              value: v.version_code,
            }))}
          />
        </Space>
      </Card>

      {!loading && !hasData ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No device data available"
          />
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card
              title="Top Device Models"
              styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
              loading={loading}
            >
              {stats && stats.models.length > 0 ? (
                <Bar {...chartConfig(stats.models, '#1677ff')} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="Android Versions"
              styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
              loading={loading}
            >
              {stats && stats.os_versions.length > 0 ? (
                <Bar {...chartConfig(stats.os_versions, '#52c41a')} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="Top Countries"
              styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
              loading={loading}
            >
              {stats && stats.countries.length > 0 ? (
                <Table
                  dataSource={stats.countries}
                  columns={tableColumns}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="Top Languages"
              styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
              loading={loading}
            >
              {stats && stats.languages.length > 0 ? (
                <Table
                  dataSource={stats.languages}
                  columns={tableColumns}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  )
}
