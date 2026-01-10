import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
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
} from '@ant-design/icons'
import type { App } from '@/types'
import { regenerateApiKey } from '@/api/apps'

interface OutletContext {
  app: App
  reload: () => void
}

export default function SettingsPage() {
  const { app, reload } = useOutletContext<OutletContext>()
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

  const maskedKey = showApiKey ? app.api_key : `${app.api_key.slice(0, 8)}${'•'.repeat(24)}`

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="Application Info" styles={{ header: { background: '#fafafa' } }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Name">{app.name}</Descriptions.Item>
          <Descriptions.Item label="Package">
            <Typography.Text code>{app.package_name}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(app.created_at).toLocaleDateString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="API Key"
        styles={{ header: { background: '#fafafa' } }}
        extra={
          <Space>
            <Tooltip title={showApiKey ? 'Hide' : 'Show'}>
              <Button
                icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowApiKey(!showApiKey)}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={handleCopyApiKey} size="small" />
            </Tooltip>
            <Tooltip title="Regenerate">
              <Button icon={<ReloadOutlined />} onClick={handleRegenerateKey} size="small" danger />
            </Tooltip>
          </Space>
        }
      >
        <Typography.Text code style={{ fontSize: 14 }}>
          {maskedKey}
        </Typography.Text>
      </Card>
    </Space>
  )
}
