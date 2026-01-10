import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { login, config } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      setLoading(true)
      await login(values.email, values.password)
      navigate('/')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f0f2f5'
    }}>
      <Card style={{ width: 400 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>🍌</span>
            <Title level={3} style={{ margin: '16px 0 0' }}>Bananalytics</Title>
            <Text type="secondary">Sign in to your account</Text>
          </div>

          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign In
              </Button>
            </Form.Item>
          </Form>

          {config?.registration_enabled && (
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">
                Don't have an account? <Link to="/register">Sign up</Link>
              </Text>
            </div>
          )}
        </Space>
      </Card>
    </div>
  )
}
