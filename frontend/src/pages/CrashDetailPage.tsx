import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Select,
  Button,
  Table,
  Typography,
  Timeline,
  Space,
  Tabs,
  message,
  Alert,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { Crash, CrashGroup, PaginatedResponse } from '@/types'
import { getCrashGroup, getCrashesInGroup, updateCrashGroupStatus, retraceCrash } from '@/api/crashes'
import dayjs from 'dayjs'

const { Text, Paragraph } = Typography

const statusColors: Record<string, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
}

export default function CrashDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [group, setGroup] = useState<CrashGroup | null>(null)
  const [crashes, setCrashes] = useState<PaginatedResponse<Crash> | null>(null)
  const [selectedCrash, setSelectedCrash] = useState<Crash | null>(null)
  const [loading, setLoading] = useState(true)
  const [retracing, setRetracing] = useState(false)

  useEffect(() => {
    if (groupId) loadData()
  }, [groupId])

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

  if (loading || !group) {
    return <Card loading />
  }

  const stacktrace = selectedCrash?.stacktrace_decoded || selectedCrash?.stacktrace_raw || ''

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

      {selectedCrash && (
        <Card
          title="Crash Details"
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
                      <Tag color="green">Deobfuscated</Tag>
                    )}
                    <Paragraph>
                      <pre className="stacktrace">{stacktrace}</pre>
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
