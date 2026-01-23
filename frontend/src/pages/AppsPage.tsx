import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Popconfirm,
  Typography,
  Grid,
} from 'antd'
import { PlusOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons'
import type { App } from '@/types'
import { getApps, createApp, deleteApp } from '@/api/apps'

const { useBreakpoint } = Grid

export default function AppsPage() {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

  const loadApps = async () => {
    try {
      setLoading(true)
      const data = await getApps()
      setApps(data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load apps')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApps()
  }, [])

  const handleCreate = async (values: { name: string; package_name: string }) => {
    try {
      setCreating(true)
      await createApp(values.name, values.package_name)
      message.success('App created successfully')
      setModalOpen(false)
      form.resetFields()
      loadApps()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to create app')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteApp(id)
      message.success('App deleted successfully')
      loadApps()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete app')
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: App) => (
        <Link to={`/apps/${record.id}`}>
          <Space>
            <AppstoreOutlined />
            {name}
          </Space>
        </Link>
      ),
    },
    {
      title: 'Package Name',
      dataIndex: 'package_name',
      key: 'package_name',
      render: (pkg: string) => <Typography.Text code>{pkg}</Typography.Text>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: App) => (
        <Popconfirm
          title="Delete app"
          description="Are you sure you want to delete this app? All data will be lost."
          onConfirm={() => handleDelete(record.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: isMobile ? '8px 8px' : '12px 12px' }}>
      <Card
        title="Applications"
        styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {isMobile ? 'New' : 'New App'}
          </Button>
        }
      >
        <Table
          dataSource={apps}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={isMobile ? { x: 500 } : undefined}
        />
      </Card>

      <Modal
        title="New Application"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="App Name"
            rules={[{ required: true, message: 'Please enter app name' }]}
          >
            <Input placeholder="My App" />
          </Form.Item>
          <Form.Item
            name="package_name"
            label="Package Name"
            rules={[
              { required: true, message: 'Please enter package name' },
              { pattern: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, message: 'Invalid package name' },
            ]}
          >
            <Input placeholder="com.example.myapp" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                Create
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
