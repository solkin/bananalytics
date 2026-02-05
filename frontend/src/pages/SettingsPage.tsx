import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Button,
  Typography,
  Space,
  message,
  Modal,
  Tooltip,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  CopyOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  ToolOutlined,
  MergeCellsOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import type { App } from '@/types'
import { regenerateApiKey, deleteApp } from '@/api/apps'
import { migrateCrashFingerprints, cleanupOrphanedCrashes, type MigrationResult, type CleanupResult } from '@/api/crashes'

interface OutletContext {
  app: App
  reload: () => void
}

export default function SettingsPage() {
  const { app, reload } = useOutletContext<OutletContext>()
  const navigate = useNavigate()
  const [showApiKey, setShowApiKey] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(app.api_key)
    message.success('API key copied to clipboard')
  }

  const handleRegenerateKey = () => {
    Modal.confirm({
      title: 'Regenerate API Key',
      content: 'This will invalidate the current API key. Your app will need to be updated with the new key.',
      okText: 'Regenerate',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await regenerateApiKey(app.id)
          message.success('API key regenerated')
          reload()
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to regenerate key')
        }
      },
    })
  }

  const handleDeleteApp = () => {
    Modal.confirm({
      title: 'Delete Application',
      content: (
        <Space direction="vertical">
          <Typography.Text>
            Are you sure you want to delete <strong>{app.name}</strong>?
          </Typography.Text>
          <Typography.Text type="danger">
            This action cannot be undone. All crashes, events, and versions will be permanently deleted.
          </Typography.Text>
        </Space>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteApp(app.id)
          message.success('Application deleted')
          navigate('/')
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete application')
        }
      },
    })
  }

  const handleMigrateFingerprints = async () => {
    setMigrating(true)
    setMigrationResult(null)
    try {
      const result = await migrateCrashFingerprints(app.id)
      setMigrationResult(result)
      if (result.groups_merged > 0) {
        message.success(`Migration complete: ${result.groups_merged} groups merged`)
      } else {
        message.info('Migration complete: no groups needed merging')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  const handleCleanupOrphanedCrashes = async () => {
    setCleaningUp(true)
    setCleanupResult(null)
    try {
      const result = await cleanupOrphanedCrashes(app.id)
      setCleanupResult(result)
      if (result.crashes_deleted > 0) {
        message.success(`Cleanup complete: ${result.crashes_deleted} crashes deleted`)
      } else {
        message.info('Cleanup complete: no orphaned crashes found')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cleanup failed')
    } finally {
      setCleaningUp(false)
    }
  }

  const maskedKey = showApiKey ? app.api_key : `${app.api_key.slice(0, 8)}${'•'.repeat(24)}`

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Name">{app.name}</Descriptions.Item>
        <Descriptions.Item label="Package">
          <Typography.Text code>{app.package_name}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {new Date(app.created_at).toLocaleDateString()}
        </Descriptions.Item>
        <Descriptions.Item label="API Key">
          <Space>
            <Typography.Text code>{maskedKey}</Typography.Text>
            <Tooltip title={showApiKey ? 'Hide' : 'Show'}>
              <Button
                icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowApiKey(!showApiKey)}
                size="small"
                type="text"
              />
            </Tooltip>
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={handleCopyApiKey} size="small" type="text" />
            </Tooltip>
            <Tooltip title="Regenerate">
              <Button icon={<ReloadOutlined />} onClick={handleRegenerateKey} size="small" type="text" danger />
            </Tooltip>
          </Space>
        </Descriptions.Item>
      </Descriptions>

      <Card
        title={
          <Space>
            <ToolOutlined />
            Maintenance
          </Space>
        }
        styles={{
          header: { background: '#f0f5ff', color: '#1d39c4', borderBottom: '1px solid #adc6ff' },
          body: { background: '#fff' },
        }}
        style={{ borderColor: '#adc6ff' }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>
              <MergeCellsOutlined /> Regroup Crashes
            </Typography.Title>
            <Typography.Text type="secondary">
              Merge crash groups with variable data in exception messages (e.g., memory sizes, 
              file paths, timestamps). This improves grouping for crashes like{' '}
              <Typography.Text code>TransactionTooLargeException: data parcel size 1057544 bytes</Typography.Text>.
            </Typography.Text>
          </div>
          
          <Button 
            type="primary"
            icon={<MergeCellsOutlined />}
            onClick={handleMigrateFingerprints}
            loading={migrating}
          >
            {migrating ? 'Processing...' : 'Run Migration'}
          </Button>

          {migrationResult && (
            <Row gutter={16}>
              <Col span={8}>
                <Statistic 
                  title="Groups Processed" 
                  value={migrationResult.groups_processed} 
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Groups Merged" 
                  value={migrationResult.groups_merged}
                  valueStyle={migrationResult.groups_merged > 0 ? { color: '#52c41a' } : undefined}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Crashes Reassigned" 
                  value={migrationResult.crashes_reassigned}
                />
              </Col>
            </Row>
          )}

          <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>
              <ClearOutlined /> Cleanup Orphaned Crashes
            </Typography.Title>
            <Typography.Text type="secondary">
              Delete crashes that are no longer associated with any existing version.
              This cleans up data from deleted versions.
            </Typography.Text>
          </div>
          
          <Button 
            type="primary"
            icon={<ClearOutlined />}
            onClick={handleCleanupOrphanedCrashes}
            loading={cleaningUp}
          >
            {cleaningUp ? 'Cleaning up...' : 'Run Cleanup'}
          </Button>

          {cleanupResult && (
            <Row gutter={16}>
              <Col span={8}>
                <Statistic 
                  title="Crashes Deleted" 
                  value={cleanupResult.crashes_deleted}
                  valueStyle={cleanupResult.crashes_deleted > 0 ? { color: '#52c41a' } : undefined}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Groups Recalculated" 
                  value={cleanupResult.groups_recalculated}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Groups Deleted" 
                  value={cleanupResult.groups_deleted}
                  valueStyle={cleanupResult.groups_deleted > 0 ? { color: '#faad14' } : undefined}
                />
              </Col>
            </Row>
          )}
        </Space>
      </Card>

      <Card
        title="Danger Zone"
        styles={{
          header: { background: '#fff2f0', color: '#cf1322', borderBottom: '1px solid #ffccc7' },
          body: { background: '#fff' },
        }}
        style={{ borderColor: '#ffccc7' }}
      >
        <Space direction="vertical" size={12}>
          <Typography.Text>
            Once you delete an application, there is no going back. Please be certain.
          </Typography.Text>
          <Button danger icon={<DeleteOutlined />} onClick={handleDeleteApp}>
            Delete Application
          </Button>
        </Space>
      </Card>
    </Space>
  )
}
