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
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { AppAccess } from '@/types/auth'
import { getAppAccess, grantAccess, updateAccess, revokeAccess } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'

export default function AccessPage() {
  const { appId } = useParams<{ appId: string }>()
  const { user } = useAuth()
  const [accessList, setAccessList] = useState<AppAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  const handleGrant = async (values: { email: string; role: string }) => {
    try {
      setSubmitting(true)
      await grantAccess(appId!, values.email, values.role)
      message.success('Access granted')
      setModalOpen(false)
      form.resetFields()
      loadAccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to grant access')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await updateAccess(appId!, userId, role)
      message.success('Role updated')
      loadAccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  const handleRevoke = async (userId: string) => {
    try {
      await revokeAccess(appId!, userId)
      message.success('Access revoked')
      loadAccess()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to revoke access')
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
            onChange={(newRole) => handleUpdateRole(record.user_id, newRole)}
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Viewer', value: 'viewer' },
            ]}
          />
        ) : (
          <Tag color={role === 'admin' ? 'blue' : 'default'}>
            {role.toUpperCase()}
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
            width: 100,
            render: (_: unknown, record: AppAccess) =>
              record.user_id !== user?.id && (
                <Popconfirm
                  title="Revoke access"
                  description="Are you sure you want to revoke this user's access?"
                  onConfirm={() => handleRevoke(record.user_id)}
                  okText="Revoke"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
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
        />
      </Space>

      <Modal
        title="Grant Access"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
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
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            initialValue="viewer"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Viewer — Can view crashes and events', value: 'viewer' },
                { label: 'Admin — Full access including settings', value: 'admin' },
              ]}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Grant Access
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
