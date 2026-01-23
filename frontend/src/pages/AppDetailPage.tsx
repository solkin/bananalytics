import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Layout,
  Menu,
  Typography,
  message,
  Skeleton,
  Drawer,
  Button,
  Grid,
} from 'antd'
import {
  BugOutlined,
  BarChartOutlined,
  TagsOutlined,
  TeamOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  ArrowLeftOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import type { App } from '@/types'
import { getApp } from '@/api/apps'
import { getMyRole } from '@/api/auth'

const { Sider, Content } = Layout
const { useBreakpoint } = Grid

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const [app, setApp] = useState<App | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isMobile = !screens.md
  const currentTab = location.pathname.split('/')[3] || 'crashes'

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!appId) return
    loadApp()
  }, [appId])

  const loadApp = async () => {
    try {
      setLoading(true)
      const [appData, userRole] = await Promise.all([
        getApp(appId!),
        getMyRole(appId!),
      ])
      setApp(appData)
      setRole(userRole)

      // If tester, redirect to distribution if not already there
      if (userRole === 'tester' && currentTab !== 'distribution') {
        navigate('distribution', { replace: true })
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load app')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const isTester = role === 'tester'
  const isAdmin = role === 'admin'

  const allMenuItems = [
    { key: 'crashes', icon: <BugOutlined />, label: 'Crashes' },
    { key: 'events', icon: <BarChartOutlined />, label: 'Events' },
    { key: 'versions', icon: <TagsOutlined />, label: 'Versions' },
    { key: 'distribution', icon: <CloudDownloadOutlined />, label: 'Distribution' },
    { key: 'access', icon: <TeamOutlined />, label: 'Access' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ]

  // Testers only see Distribution
  const menuItems = isTester
    ? allMenuItems.filter(item => item.key === 'distribution')
    : isAdmin
      ? allMenuItems
      : allMenuItems.filter(item => !['access', 'settings'].includes(item.key))

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(`/apps/${appId}/${key}`)
  }

  const sidebarContent = (
    <>
      <div style={{ padding: '20px 16px 12px' }}>
        <Link 
          to="/" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            color: '#8c8c8c',
            fontSize: 13,
            marginBottom: 16,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#1677ff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8c8c8c'}
        >
          <ArrowLeftOutlined style={{ marginRight: 8 }} />
          All Applications
        </Link>
        {loading ? (
          <Skeleton.Input active size="small" style={{ width: 140 }} />
        ) : (
          <Typography.Title level={5} style={{ margin: 0, color: '#262626', fontWeight: 600 }}>
            {app?.name}
          </Typography.Title>
        )}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[currentTab]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ 
          border: 'none',
          paddingTop: 8,
        }}
      />
    </>
  )

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider
          width={240}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            position: 'sticky',
            top: 64,
            height: 'calc(100vh - 64px)',
            overflow: 'auto',
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        {sidebarContent}
      </Drawer>

      <Content style={{ padding: isMobile ? '8px 8px' : '12px 12px', background: '#f5f5f5' }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button 
              icon={<MenuOutlined />} 
              onClick={() => setDrawerOpen(true)}
            />
            {!loading && (
              <Typography.Title level={5} style={{ margin: 0 }}>
                {app?.name}
              </Typography.Title>
            )}
          </div>
        )}
        
        {loading ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : (
          <Outlet context={{ app, role, reload: loadApp }} />
        )}
      </Content>
    </Layout>
  )
}
