import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Card,
  Menu,
  Typography,
  message,
} from 'antd'
import {
  BugOutlined,
  BarChartOutlined,
  TagsOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { App } from '@/types'
import { getApp } from '@/api/apps'

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)

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

  const menuItems = [
    { key: 'crashes', icon: <BugOutlined />, label: <Link to="crashes">Crashes</Link> },
    { key: 'events', icon: <BarChartOutlined />, label: <Link to="events">Events</Link> },
    { key: 'versions', icon: <TagsOutlined />, label: <Link to="versions">Versions</Link> },
    { key: 'access', icon: <TeamOutlined />, label: <Link to="access">Access</Link> },
    { key: 'settings', icon: <SettingOutlined />, label: <Link to="settings">Settings</Link> },
  ]

  if (loading || !app) {
    return <Card loading={loading} />
  }

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{app.name}</Typography.Title>
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[currentTab]}
        items={menuItems}
        style={{ borderBottom: 'none' }}
      />
      <div style={{ padding: 24 }}>
        <Outlet context={{ app, reload: loadApp }} />
      </div>
    </Card>
  )
}
