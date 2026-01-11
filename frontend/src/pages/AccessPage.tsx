import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  message,
  Popconfirm,
  Typography,
  Alert,
  Tooltip,
} from 'antd'
import { PlusOutlined, DeleteOutlined, MailOutlined, CopyOutlined, SendOutlined } from '@ant-design/icons'
import type { AppAccess } from '@/types/auth'
import {
  getAppAccess,
  grantAccess,
  updateAccess,
  revokeAccess,
  checkEmail,
  getInvitationLink,
  resendInvitation,
} from '@/api/auth'
import { useAuth } from '@/context/AuthContext'

export default function AccessPage() {
  const { appId } = useParams<{ appId: string }>()
  const { user, config } = useAuth()
  const [accessList, setAccessList] = useState<AppAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [emailCheckResult, setEmailCheckResult] = useState<{
    checked: boolean
    exists: boolean
    smtpConfigured: boolean
  } | null>(null)
  const [form] = Form.useForm()

  const loadAccess = async () => {
    try {
      setLoading(true)
      const data = await getAppAccess(appId!)
      setAccessList(data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load access list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (appId) loadAccess()
  }, [appId])

  const currentUserAccess = accessList.find((a) => a.user_id === user?.id)
  const isAdmin = currentUserAccess?.role === 'admin'

  const handleEmailBlur = async () => {
    const email = form.getFieldValue('email')
    if (!email || !email.includes('@')) {
      setEmailCheckResult(null)
      return
    }

    try {
      const result = await checkEmail(email)
      setEmailCheckResult({
        checked: true,
        exists: result.exists,
        smtpConfigured: result.smtp_configured,
      })
    } catch {
      setEmailCheckResult(null)
    }
  }

  const handleGrant = async (values: { email: string; role: string }) => {
    try {
      setSubmitting(true)
      await grantAccess(appId!, values.email, values.role)

      if (emailCheckResult && !emailCheckResult.exists) {
        if (emailCheckResult.smtpConfigured) {
          message.success('Invitation email sent')
        } else {
          message.success('Invitation created (email not sent - SMTP not configured)')
        }
      } else {
        message.success('Access granted')
      }

      setModalOpen(false)
      form.resetFields()
      setEmailCheckResult(null)
      loadAccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to grant access')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateRole = async (accessId: string, role: string) => {
    try {
      await updateAccess(appId!, accessId, role)
      message.success('Role updated')
      loadAccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  const handleRevoke = async (accessId: string, status: string) => {
    try {
      await revokeAccess(appId!, accessId)
      message.success(status === 'invited' ? 'Invitation cancelled' : 'Access revoked')
      loadAccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to revoke access')
    }
  }

  const handleCopyLink = async (invitationId: string) => {
    try {
      const url = await getInvitationLink(appId!, invitationId)
      await navigator.clipboard.writeText(url)
      message.success('Invitation link copied to clipboard')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to copy link')
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      setResending(invitationId)
      await resendInvitation(appId!, invitationId)
      message.success('Invitation email sent')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to resend invitation')
    } finally {
      setResending(null)
    }
  }

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, record: AppAccess) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {record.user_name || record.user_email}
            {record.user_id === user?.id && <Tag style={{ marginLeft: 8 }}>You</Tag>}
            {record.status === 'invited' && (
              <Tag color="orange" style={{ marginLeft: 8 }} icon={<MailOutlined />}>
                Invited
              </Tag>
            )}
          </Typography.Text>
          {record.user_name && (
            <Typography.Text type="secondary">{record.user_email}</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role: string, record: AppAccess) =>
        isAdmin && record.user_id !== user?.id ? (
          <Select
            value={role}
            style={{ width: 120 }}
            onChange={(newRole) => handleUpdateRole(record.id, newRole)}
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Viewer', value: 'viewer' },
              { label: 'Tester', value: 'tester' },
            ]}
          />
        ) : (
          <Tag color={role === 'admin' ? 'blue' : role === 'tester' ? 'green' : 'default'}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Tag>
        ),
    },
    {
      title: 'Added',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    ...(isAdmin
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 140,
            render: (_: unknown, record: AppAccess) =>
              record.user_id !== user?.id && (
                <Space size="small">
                  {record.status === 'invited' && (
                    <>
                      <Tooltip title="Copy invitation link">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopyLink(record.id)}
                        />
                      </Tooltip>
                      {config?.smtp_configured && (
                        <Tooltip title="Resend invitation email">
                          <Button
                            type="text"
                            icon={<SendOutlined />}
                            loading={resending === record.id}
                            onClick={() => handleResendInvitation(record.id)}
                          />
                        </Tooltip>
                      )}
                    </>
                  )}
                  <Popconfirm
                    title={record.status === 'invited' ? 'Cancel invitation' : 'Revoke access'}
                    description={
                      record.status === 'invited'
                        ? 'Are you sure you want to cancel this invitation?'
                        : "Are you sure you want to revoke this user's access?"
                    }
                    onConfirm={() => handleRevoke(record.id, record.status)}
                    okText={record.status === 'invited' ? 'Cancel' : 'Revoke'}
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
          },
        ]
      : []),
  ]

  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Add User
            </Button>
          </div>
        )}

        <Table
          dataSource={accessList}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          bordered
          style={{ borderRadius: '8px 8px 0 0', overflow: 'hidden' }}
        />
      </Space>

      <Modal
        title="Grant Access"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEmailCheckResult(null)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleGrant}>
          <Form.Item
            name="email"
            label="User Email"
            rules={[
              { required: true, message: 'Please enter user email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="user@example.com" onBlur={handleEmailBlur} />
          </Form.Item>

          {emailCheckResult && !emailCheckResult.exists && (
            <Alert
              type="info"
              showIcon
              icon={<MailOutlined />}
              message="User not registered"
              description={
                emailCheckResult.smtpConfigured
                  ? 'An invitation email will be sent to this address. The user will be able to register and will automatically get access to this project.'
                  : 'An invitation will be created. Note: SMTP is not configured, so no email will be sent. Share the registration link manually.'
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="role"
            label="Role"
            initialValue="viewer"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Admin — Full access including settings', value: 'admin' },
                { label: 'Viewer — Can view crashes and events', value: 'viewer' },
                { label: 'Tester — Can download APK builds', value: 'tester' },
              ]}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setModalOpen(false)
                  setEmailCheckResult(null)
                  form.resetFields()
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {emailCheckResult && !emailCheckResult.exists ? 'Send Invitation' : 'Grant Access'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
