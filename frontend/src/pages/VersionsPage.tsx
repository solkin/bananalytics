import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Space,
  message,
  Typography,
  Switch,
} from 'antd'
import { PlusOutlined, UploadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { AppVersion } from '@/types'
import { getVersions, createVersion, uploadMapping, updateVersionMute } from '@/api/apps'

const { TextArea } = Input

export default function VersionsPage() {
  const { appId } = useParams<{ appId: string }>()
  const [versions, setVersions] = useState<AppVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form] = Form.useForm()
  const [uploadForm] = Form.useForm()

  const loadVersions = async () => {
    try {
      setLoading(true)
      const data = await getVersions(appId!)
      setVersions(data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (appId) loadVersions()
  }, [appId])

  const handleCreate = async (values: {
    version_code: number
    version_name?: string
    mapping_content?: string
  }) => {
    try {
      setCreating(true)
      await createVersion(appId!, values.version_code, values.version_name, values.mapping_content)
      message.success('Version created')
      setModalOpen(false)
      form.resetFields()
      loadVersions()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to create version')
    } finally {
      setCreating(false)
    }
  }

  const handleUploadMapping = async (values: { mapping_content: string }) => {
    if (!selectedVersion) return
    try {
      setUploading(true)
      await uploadMapping(appId!, selectedVersion.id, values.mapping_content)
      message.success('Mapping uploaded')
      setUploadModalOpen(false)
      uploadForm.resetFields()
      loadVersions()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to upload mapping')
    } finally {
      setUploading(false)
    }
  }

  const handleToggle = async (
    version: AppVersion,
    type: 'crashes' | 'events',
    enabled: boolean
  ) => {
    try {
      // Invert: enabled means NOT muted
      await updateVersionMute(
        appId!,
        version.id,
        type === 'crashes' ? !enabled : undefined,
        type === 'events' ? !enabled : undefined
      )
      message.success(`${type === 'crashes' ? 'Crashes' : 'Events'} ${enabled ? 'enabled' : 'disabled'}`)
      loadVersions()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update settings')
    }
  }

  const columns = [
    {
      title: 'Version Code',
      dataIndex: 'version_code',
      key: 'version_code',
      render: (code: number) => <Typography.Text strong>{code}</Typography.Text>,
    },
    {
      title: 'Version Name',
      dataIndex: 'version_name',
      key: 'version_name',
      render: (name: string | null) => name || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Mapping',
      dataIndex: 'has_mapping',
      key: 'has_mapping',
      render: (hasMapping: boolean) =>
        hasMapping ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Uploaded
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            Not uploaded
          </Tag>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Crashes',
      key: 'crashes_enabled',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: AppVersion) => (
        <Switch
          checked={!record.mute_crashes}
          onChange={(enabled) => handleToggle(record, 'crashes', enabled)}
          size="small"
        />
      ),
    },
    {
      title: 'Events',
      key: 'events_enabled',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: AppVersion) => (
        <Switch
          checked={!record.mute_events}
          onChange={(enabled) => handleToggle(record, 'events', enabled)}
          size="small"
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: AppVersion) => (
        <Button
          type="link"
          icon={<UploadOutlined />}
          onClick={() => {
            setSelectedVersion(record)
            setUploadModalOpen(true)
          }}
        >
          {record.has_mapping ? 'Update' : 'Upload'} Mapping
        </Button>
      ),
    },
  ]

  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Version
          </Button>
        </div>

        <Table
          dataSource={versions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          bordered
          style={{ borderRadius: '8px 8px 0 0', overflow: 'hidden' }}
        />
      </Space>

      <Modal
        title="Add Version"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="version_code"
            label="Version Code"
            rules={[{ required: true, message: 'Please enter version code' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="123" />
          </Form.Item>
          <Form.Item name="version_name" label="Version Name">
            <Input placeholder="1.2.3" />
          </Form.Item>
          <Form.Item name="mapping_content" label="Mapping File (optional)">
            <TextArea rows={6} placeholder="Paste mapping.txt content here..." />
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

      <Modal
        title={`Upload Mapping for v${selectedVersion?.version_code}`}
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUploadMapping}>
          <Form.Item
            name="mapping_content"
            label="Mapping File"
            rules={[{ required: true, message: 'Please paste mapping content' }]}
          >
            <TextArea rows={10} placeholder="Paste mapping.txt content here..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setUploadModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={uploading}>
                Upload
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
