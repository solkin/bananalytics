import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space } from 'antd'
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'

const { Title, Text } = Typography

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const { register, config } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (config && !config.registration_enabled) {
      navigate('/login')
    }
  }, [config, navigate])

  const handleSubmit = async (values: { email: string; password: string; name?: string }) => {
    try {
      setLoading(true)
      await register(values.email, values.password, values.name)
      navigate('/')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (config && !config.registration_enabled) {
    return null
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
            <Text type="secondary">Create your account</Text>
          </div>

          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="name">
              <Input prefix={<UserOutlined />} placeholder="Name (optional)" size="large" />
            </Form.Item>

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
              rules={[
                { required: true, message: 'Please enter a password' },
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Passwords do not match'))
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" size="large" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign Up
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">
              Already have an account? <Link to="/login">Sign in</Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  )
}
