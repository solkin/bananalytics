import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space, Alert, Spin } from 'antd'
import { MailOutlined, LockOutlined, UserOutlined, GiftOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { getInviteInfo } from '@/api/auth'

const { Title, Text } = Typography

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const { register, config } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [form] = Form.useForm()

  // Fetch invite info when token is present
  useEffect(() => {
    if (inviteToken) {
      setInviteLoading(true)
      getInviteInfo(inviteToken)
        .then((info) => {
          setInviteEmail(info.email)
          form.setFieldsValue({ email: info.email })
        })
        .catch((error) => {
          setInviteError(error instanceof Error ? error.message : 'Invalid invitation')
        })
        .finally(() => {
          setInviteLoading(false)
        })
    }
  }, [inviteToken, form])

  // Don't redirect if we have an invite token
  useEffect(() => {
    if (config && !config.registration_enabled && !inviteToken) {
      navigate('/login')
    }
  }, [config, navigate, inviteToken])

  const handleSubmit = async (values: { email: string; password: string; name?: string }) => {
    try {
      setLoading(true)
      await register(values.email, values.password, values.name, inviteToken || undefined)
      message.success('Registration successful!')
      navigate('/')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Only hide page if registration is disabled AND there's no invite token
  if (config && !config.registration_enabled && !inviteToken) {
    return null
  }

  if (inviteLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (inviteError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
        }}
      >
        <Card style={{ width: 400 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>🍌</span>
              <Title level={3} style={{ margin: '16px 0 0' }}>
                Bananalytics
              </Title>
            </div>
            <Alert
              type="error"
              showIcon
              message="Invalid Invitation"
              description="This invitation link is invalid or has expired. Please contact the person who sent you the invitation."
            />
            <div style={{ textAlign: 'center' }}>
              <Link to="/login">Go to Login</Link>
            </div>
          </Space>
        </Card>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>🍌</span>
            <Title level={3} style={{ margin: '16px 0 0' }}>
              Bananalytics
            </Title>
            <Text type="secondary">
              {inviteToken ? 'Accept your invitation' : 'Create your account'}
            </Text>
          </div>

          {inviteToken && (
            <Alert
              type="success"
              showIcon
              icon={<GiftOutlined />}
              message="You've been invited!"
              description="Complete registration to accept your invitation and get access to the project."
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
              <Input
                prefix={<MailOutlined />}
                placeholder="Email"
                size="large"
                disabled={!!inviteEmail}
              />
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
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Confirm password"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                {inviteToken ? 'Accept Invitation' : 'Sign Up'}
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
