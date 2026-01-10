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
  Upload,
  Drawer,
  Descriptions,
  Divider,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LinkOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import type { AppVersion } from '@/types'
import {
  getVersions,
  createVersion,
  uploadMapping,
  updateVersion,
  uploadApk,
  deleteApk,
  getMappingDownloadUrl,
  getApkDownloadUrl,
  createDownloadToken,
} from '@/api/apps'

const { Dragger } = Upload
const { TextArea } = Input

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function VersionsPage() {
  const { appId } = useParams<{ appId: string }>()
  const [versions, setVersions] = useState<AppVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()
  const [mappingFileList, setMappingFileList] = useState<UploadFile[]>([])
  const [apkFileList, setApkFileList] = useState<UploadFile[]>([])

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(null)
  const [saving, setSaving] = useState(false)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [uploadMappingFileList, setUploadMappingFileList] = useState<UploadFile[]>([])
  const [uploadApkFileList, setUploadApkFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [downloadLink, setDownloadLink] = useState<string | null>(null)

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
    release_notes?: string
  }) => {
    try {
      setCreating(true)
      const mappingFile = mappingFileList[0]?.originFileObj
      const apkFile = apkFileList[0]?.originFileObj
      
      // First create version with mapping
      const version = await createVersion(appId!, values.version_code, values.version_name, mappingFile)
      
      // Then upload APK if provided
      if (apkFile) {
        await uploadApk(appId!, version.id, apkFile)
      }
      
      // Update release notes if provided
      if (values.release_notes) {
        await updateVersion(appId!, version.id, { release_notes: values.release_notes })
      }
      
      message.success('Version created')
      setModalOpen(false)
      form.resetFields()
      setMappingFileList([])
      setApkFileList([])
      loadVersions()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to create version')
    } finally {
      setCreating(false)
    }
  }

  const openDrawer = (version: AppVersion) => {
    setSelectedVersion(version)
    setReleaseNotes(version.release_notes || '')
    setUploadMappingFileList([])
    setUploadApkFileList([])
    setDownloadLink(null)
    setDrawerOpen(true)
  }

  const handleToggle = async (type: 'crashes' | 'events' | 'published', enabled: boolean) => {
    if (!selectedVersion) return
    try {
      const update: Record<string, boolean> = {}
      if (type === 'crashes') update.mute_crashes = !enabled
      else if (type === 'events') update.mute_events = !enabled
      else if (type === 'published') update.published_for_testers = enabled

      await updateVersion(appId!, selectedVersion.id, update)
      message.success('Settings updated')
      loadVersions()
      // Update local state
      setSelectedVersion({
        ...selectedVersion,
        ...(type === 'crashes' ? { mute_crashes: !enabled } : {}),
        ...(type === 'events' ? { mute_events: !enabled } : {}),
        ...(type === 'published' ? { published_for_testers: enabled } : {}),
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update settings')
    }
  }

  const handleSaveReleaseNotes = async () => {
    if (!selectedVersion) return
    try {
      setSaving(true)
      await updateVersion(appId!, selectedVersion.id, { release_notes: releaseNotes })
      message.success('Release notes saved')
      loadVersions()
      setSelectedVersion({ ...selectedVersion, release_notes: releaseNotes })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadMapping = async () => {
    if (!selectedVersion || uploadMappingFileList.length === 0) return
    const file = uploadMappingFileList[0]?.originFileObj
    if (!file) return

    try {
      setUploading(true)
      await uploadMapping(appId!, selectedVersion.id, file)
      message.success('Mapping uploaded')
      setUploadMappingFileList([])
      loadVersions()
      setSelectedVersion({ ...selectedVersion, has_mapping: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to upload')
    } finally {
      setUploading(false)
    }
  }

  const handleUploadApk = async () => {
    if (!selectedVersion || uploadApkFileList.length === 0) return
    const file = uploadApkFileList[0]?.originFileObj
    if (!file) return

    try {
      setUploading(true)
      const updated = await uploadApk(appId!, selectedVersion.id, file)
      message.success('APK uploaded')
      setUploadApkFileList([])
      loadVersions()
      setSelectedVersion(updated)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to upload')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteApk = async () => {
    if (!selectedVersion) return
    try {
      await deleteApk(appId!, selectedVersion.id)
      message.success('APK deleted')
      loadVersions()
      setSelectedVersion({
        ...selectedVersion,
        has_apk: false,
        apk_size: null,
        apk_filename: null,
        apk_uploaded_at: null,
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete')
    }
  }

  const handleCreateDownloadLink = async () => {
    if (!selectedVersion) return
    try {
      const token = await createDownloadToken(appId!, selectedVersion.id, 24)
      const fullUrl = `${window.location.origin}${token.download_url}`
      setDownloadLink(fullUrl)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to create link')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('Copied to clipboard')
  }

  const columns = [
    {
      title: 'Version Name',
      dataIndex: 'version_name',
      key: 'version_name',
      render: (name: string | null) => name || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Version Code',
      dataIndex: 'version_code',
      key: 'version_code',
    },
    {
      title: 'APK',
      dataIndex: 'has_apk',
      key: 'has_apk',
      width: 120,
      render: (hasApk: boolean, record: AppVersion) =>
        hasApk ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {record.apk_size ? formatBytes(record.apk_size) : 'Uploaded'}
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            No APK
          </Tag>
        ),
    },
    {
      title: 'Mapping',
      dataIndex: 'has_mapping',
      key: 'has_mapping',
      width: 100,
      render: (hasMapping: boolean) =>
        hasMapping ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Yes
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            No
          </Tag>
        ),
    },
    {
      title: 'Published',
      dataIndex: 'published_for_testers',
      key: 'published_for_testers',
      width: 100,
      render: (published: boolean) =>
        published ? (
          <Tag color="blue">Published</Tag>
        ) : (
          <Tag color="default">Draft</Tag>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
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
          onRow={(record) => ({
            onClick: () => openDrawer(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Space>

      {/* Create Version Modal */}
      <Modal
        title="Add Version"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setMappingFileList([])
          setApkFileList([])
        }}
        footer={null}
        width={600}
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
          <Form.Item name="release_notes" label="Release Notes">
            <TextArea rows={3} placeholder="What's new in this version..." />
          </Form.Item>
          <Form.Item label="APK File (optional)">
            <div className="compact-dragger">
              <Dragger
                accept=".apk"
                maxCount={1}
                fileList={apkFileList}
                beforeUpload={() => false}
                onChange={({ fileList }) => setApkFileList(fileList)}
              >
                <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                <p className="ant-upload-text">Click or drag APK file (max 200MB)</p>
              </Dragger>
            </div>
          </Form.Item>
          <Form.Item label="Mapping File (optional)">
            <div className="compact-dragger">
              <Dragger
                accept=".txt,.map"
                maxCount={1}
                fileList={mappingFileList}
                beforeUpload={() => false}
                onChange={({ fileList }) => setMappingFileList(fileList)}
              >
                <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                <p className="ant-upload-text">Click or drag mapping.txt</p>
              </Dragger>
            </div>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setModalOpen(false)
                setMappingFileList([])
                setApkFileList([])
              }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                Create
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Version Details Drawer */}
      <Drawer
        title={
          selectedVersion
            ? `Version ${selectedVersion.version_name || selectedVersion.version_code}`
            : 'Version Details'
        }
        placement="right"
        width={480}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {selectedVersion && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Version Code">{selectedVersion.version_code}</Descriptions.Item>
              <Descriptions.Item label="Version Name">{selectedVersion.version_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(selectedVersion.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Settings</Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Crashes enabled</span>
                <Switch
                  checked={!selectedVersion.mute_crashes}
                  onChange={(enabled) => handleToggle('crashes', enabled)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Events enabled</span>
                <Switch
                  checked={!selectedVersion.mute_events}
                  onChange={(enabled) => handleToggle('events', enabled)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Published for testers</span>
                <Switch
                  checked={selectedVersion.published_for_testers}
                  onChange={(enabled) => handleToggle('published', enabled)}
                />
              </div>
            </Space>

            <Divider orientation="left">Release Notes</Divider>
            <TextArea
              rows={3}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="What's new in this version..."
            />
            <Button
              onClick={handleSaveReleaseNotes}
              loading={saving}
              disabled={releaseNotes === (selectedVersion.release_notes || '')}
            >
              Save Release Notes
            </Button>

            <Divider orientation="left">APK</Divider>
            {selectedVersion.has_apk ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Filename">{selectedVersion.apk_filename}</Descriptions.Item>
                  <Descriptions.Item label="Size">
                    {selectedVersion.apk_size ? formatBytes(selectedVersion.apk_size) : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Uploaded">
                    {selectedVersion.apk_uploaded_at
                      ? new Date(selectedVersion.apk_uploaded_at).toLocaleString()
                      : '—'}
                  </Descriptions.Item>
                </Descriptions>
                <Space wrap>
                  <Button
                    icon={<DownloadOutlined />}
                    href={getApkDownloadUrl(appId!, selectedVersion.id)}
                    target="_blank"
                  >
                    Download
                  </Button>
                  <Button icon={<LinkOutlined />} onClick={handleCreateDownloadLink}>
                    Create Link
                  </Button>
                  <Popconfirm
                    title="Delete APK?"
                    onConfirm={handleDeleteApk}
                    okText="Delete"
                    okType="danger"
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
                {downloadLink && (
                  <Input.Group compact style={{ marginTop: 8 }}>
                    <Input
                      value={downloadLink}
                      readOnly
                      style={{ width: 'calc(100% - 32px)' }}
                    />
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(downloadLink)}
                    />
                  </Input.Group>
                )}
                <Divider dashed />
                <Typography.Text type="secondary">Update APK:</Typography.Text>
                <div className="compact-dragger">
                  <Dragger
                    accept=".apk"
                    maxCount={1}
                    fileList={uploadApkFileList}
                    beforeUpload={() => false}
                    onChange={({ fileList }) => setUploadApkFileList(fileList)}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Click or drag APK file</p>
                  </Dragger>
                </div>
                {uploadApkFileList.length > 0 && (
                  <Button
                    type="primary"
                    onClick={handleUploadApk}
                    loading={uploading}
                  >
                    Upload APK
                  </Button>
                )}
              </Space>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="compact-dragger">
                  <Dragger
                    accept=".apk"
                    maxCount={1}
                    fileList={uploadApkFileList}
                    beforeUpload={() => false}
                    onChange={({ fileList }) => setUploadApkFileList(fileList)}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Click or drag APK file (max 200MB)</p>
                  </Dragger>
                </div>
                {uploadApkFileList.length > 0 && (
                  <Button
                    type="primary"
                    onClick={handleUploadApk}
                    loading={uploading}
                  >
                    Upload APK
                  </Button>
                )}
              </Space>
            )}

            <Divider orientation="left">Mapping</Divider>
            {selectedVersion.has_mapping ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Button
                    icon={<DownloadOutlined />}
                    href={getMappingDownloadUrl(appId!, selectedVersion.id)}
                    target="_blank"
                  >
                    Download Mapping
                  </Button>
                </Space>
                <Divider dashed />
                <Typography.Text type="secondary">Update Mapping:</Typography.Text>
                <div className="compact-dragger">
                  <Dragger
                    accept=".txt,.map"
                    maxCount={1}
                    fileList={uploadMappingFileList}
                    beforeUpload={() => false}
                    onChange={({ fileList }) => setUploadMappingFileList(fileList)}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Click or drag mapping.txt</p>
                  </Dragger>
                </div>
                {uploadMappingFileList.length > 0 && (
                  <Button onClick={handleUploadMapping} loading={uploading}>
                    Upload Mapping
                  </Button>
                )}
              </Space>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="compact-dragger">
                  <Dragger
                    accept=".txt,.map"
                    maxCount={1}
                    fileList={uploadMappingFileList}
                    beforeUpload={() => false}
                    onChange={({ fileList }) => setUploadMappingFileList(fileList)}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Click or drag mapping.txt</p>
                  </Dragger>
                </div>
                {uploadMappingFileList.length > 0 && (
                  <Button onClick={handleUploadMapping} loading={uploading}>
                    Upload Mapping
                  </Button>
                )}
              </Space>
            )}
          </Space>
        )}
      </Drawer>
    </>
  )
}
