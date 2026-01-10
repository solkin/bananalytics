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
} from 'antd'
import {
  CopyOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { App } from '@/types'
import { regenerateApiKey, deleteApp } from '@/api/apps'

interface OutletContext {
  app: App
  reload: () => void
}

export default function SettingsPage() {
  const { app, reload } = useOutletContext<OutletContext>()
  const navigate = useNavigate()
  const [showApiKey, setShowApiKey] = useState(false)

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

  const maskedKey = showApiKey ? app.api_key : `${app.api_key.slice(0, 8)}${'•'.repeat(24)}`

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
        title="Danger Zone"
        styles={{
          header: { background: '#fff2f0', color: '#cf1322', borderBottom: '1px solid #ffccc7' },
          body: { background: '#fff' },
        }}
        style={{ borderColor: '#ffccc7' }}
      >
        <Space direction="vertical" size="middle">
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
