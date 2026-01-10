import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Card,
  Menu,
  Descriptions,
  Button,
  Typography,
  Space,
  message,
  Modal,
  Tooltip,
} from 'antd'
import {
  BugOutlined,
  BarChartOutlined,
  TagsOutlined,
  TeamOutlined,
  CopyOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons'
import type { App } from '@/types'
import { getApp, regenerateApiKey } from '@/api/apps'

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)

  const currentTab = location.pathname.split('/')[3] || 'crashes'

  useEffect(() => {
    if (!appId) return
    loadApp()
  }, [appId])

  const loadApp = async () => {
    try {
      setLoading(true)
      const data = await getApp(appId!)
      setApp(data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load app')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyApiKey = () => {
    if (app) {
      navigator.clipboard.writeText(app.api_key)
      message.success('API key copied to clipboard')
    }
  }

  const handleRegenerateKey = () => {
    Modal.confirm({
      title: 'Regenerate API Key',
      content: 'This will invalidate the current API key. Your app will need to be updated with the new key.',
      okText: 'Regenerate',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const newKey = await regenerateApiKey(appId!)
          setApp((prev) => (prev ? { ...prev, api_key: newKey } : null))
          message.success('API key regenerated')
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to regenerate key')
        }
      },
    })
  }

  const menuItems = [
    { key: 'crashes', icon: <BugOutlined />, label: <Link to="crashes">Crashes</Link> },
    { key: 'events', icon: <BarChartOutlined />, label: <Link to="events">Events</Link> },
    { key: 'versions', icon: <TagsOutlined />, label: <Link to="versions">Versions</Link> },
    { key: 'access', icon: <TeamOutlined />, label: <Link to="access">Access</Link> },
  ]

  if (loading || !app) {
    return <Card loading={loading} />
  }

  const maskedKey = showApiKey ? app.api_key : `${app.api_key.slice(0, 8)}${'•'.repeat(24)}`

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Descriptions
          title={app.name}
          extra={
            <Space>
              <Tooltip title={showApiKey ? 'Hide' : 'Show'}>
                <Button
                  icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => setShowApiKey(!showApiKey)}
                />
              </Tooltip>
              <Tooltip title="Copy API Key">
                <Button icon={<CopyOutlined />} onClick={handleCopyApiKey} />
              </Tooltip>
              <Tooltip title="Regenerate API Key">
                <Button icon={<ReloadOutlined />} onClick={handleRegenerateKey} />
              </Tooltip>
            </Space>
          }
        >
          <Descriptions.Item label="Package">
            <Typography.Text code>{app.package_name}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="API Key">
            <Typography.Text code copyable={false}>
              {maskedKey}
            </Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Menu
          mode="horizontal"
          selectedKeys={[currentTab]}
          items={menuItems}
          style={{ borderBottom: 'none', borderRadius: '8px 8px 0 0' }}
        />
        <div style={{ padding: 24 }}>
          <Outlet context={{ app, reload: loadApp }} />
        </div>
      </Card>
    </Space>
  )
}
