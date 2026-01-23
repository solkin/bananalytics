import { Layout, Typography, Dropdown, Space, Avatar } from 'antd'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { UserOutlined, LogoutOutlined, AppstoreOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'

const { Header, Content } = Layout

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 24px',
          background: '#001529',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <AppstoreOutlined style={{ fontSize: 24, marginRight: 12, color: '#fff' }} />
          <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
            Bananalytics
          </Typography.Title>
        </Link>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', color: '#fff' }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
            <span>{user?.name || user?.email}</span>
          </Space>
        </Dropdown>
      </Header>

      <Content style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
