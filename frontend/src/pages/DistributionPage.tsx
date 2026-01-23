import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Typography, message, Button, Empty, Tag, Divider } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
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
      <Card 
        title="Available Versions" 
        styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
        loading={loading}
      >
        <div style={{ height: 200 }} />
      </Card>
    )
  }

  if (versions.length === 0) {
    return (
      <Card 
        title="Available Versions" 
        styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No versions available for testing yet"
        />
      </Card>
    )
  }

  return (
    <Card 
      title="Available Versions" 
      styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
    >
      {versions.map((version, index) => (
        <div key={version.id}>
          {index > 0 && <Divider style={{ margin: '16px 0' }} />}
          
          <div className="distribution-version-card">
            <div className="distribution-version-info">
              <div className="distribution-version-header">
                <Title level={5} style={{ margin: 0 }}>
                  {version.version_name || `Version ${version.version_code}`}
                </Title>
                <Tag color="blue" style={{ marginLeft: 8 }}>v{version.version_code}</Tag>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                {version.apk_uploaded_at 
                  ? `Published ${new Date(version.apk_uploaded_at).toLocaleDateString()}`
                  : `Created ${new Date(version.created_at).toLocaleDateString()}`
                }
                {version.apk_size && ` • ${formatBytes(version.apk_size)}`}
              </Text>
              
              {version.release_notes && (
                <div style={{ marginTop: 12 }}>
                  <Text strong>What's New:</Text>
                  <Paragraph 
                    type="secondary" 
                    style={{ marginTop: 4, marginBottom: 0, whiteSpace: 'pre-wrap' }}
                  >
                    {version.release_notes}
                  </Paragraph>
                </div>
              )}
            </div>
            
            <div className="distribution-version-action">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="large"
                href={getApkDownloadUrl(appId!, version.id)}
                target="_blank"
                block
              >
                Download APK
              </Button>
            </div>
          </div>
        </div>
      ))}
    </Card>
  )
}
