import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Space, Typography, message, Button, Empty, Tag } from 'antd'
import { DownloadOutlined, AndroidOutlined } from '@ant-design/icons'
import type { AppVersion } from '@/types'
import { getDistributionVersions, getApkDownloadUrl } from '@/api/apps'

const { Title, Text, Paragraph } = Typography

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function DistributionPage() {
  const { appId } = useParams<{ appId: string }>()
  const [versions, setVersions] = useState<AppVersion[]>([])
  const [loading, setLoading] = useState(true)

  const loadVersions = async () => {
    try {
      setLoading(true)
      const data = await getDistributionVersions(appId!)
      setVersions(data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (appId) loadVersions()
  }, [appId])

  if (loading) {
    return (
      <Card loading={loading}>
        <div style={{ height: 200 }} />
      </Card>
    )
  }

  if (versions.length === 0) {
    return (
      <Card>
        <Empty
          image={<AndroidOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={
            <Text type="secondary">
              No versions available for testing yet.
            </Text>
          }
        />
      </Card>
    )
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>Available Versions</Title>
      
      {versions.map((version) => (
        <Card key={version.id} hoverable>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Space align="center">
                  <Title level={5} style={{ margin: 0 }}>
                    {version.version_name || `Version ${version.version_code}`}
                  </Title>
                  <Tag color="blue">v{version.version_code}</Tag>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                  {version.apk_uploaded_at 
                    ? `Published ${new Date(version.apk_uploaded_at).toLocaleDateString()}`
                    : `Created ${new Date(version.created_at).toLocaleDateString()}`
                  }
                  {version.apk_size && ` • ${formatBytes(version.apk_size)}`}
                </Text>
              </div>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="large"
                href={getApkDownloadUrl(appId!, version.id)}
                target="_blank"
              >
                Download APK
              </Button>
            </div>
            
            {version.release_notes && (
              <>
                <div style={{ marginTop: 12 }}>
                  <Text strong>What's New:</Text>
                  <Paragraph 
                    type="secondary" 
                    style={{ marginTop: 4, marginBottom: 0, whiteSpace: 'pre-wrap' }}
                  >
                    {version.release_notes}
                  </Paragraph>
                </div>
              </>
            )}
          </Space>
        </Card>
      ))}
    </Space>
  )
}
