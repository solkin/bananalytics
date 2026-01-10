import { Layout, Typography, Dropdown, Space, Avatar } from 'antd'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'

const { Header, Content } = Layout

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const menuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <span style={{ fontSize: 24, marginRight: 8 }}>🍌</span>
          <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
            Bananalytics
          </Typography.Title>
        </Link>

        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', color: '#fff' }}>
            <Avatar size="small" icon={<UserOutlined />} />
            <span>{user?.name || user?.email}</span>
          </Space>
        </Dropdown>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
