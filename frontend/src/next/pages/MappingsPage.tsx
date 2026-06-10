import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Icons, Table, Tag, Text, toast, type Column } from '@/ui'
import type { AppVersion } from '@/types'
import { getMappingDownloadUrl, getVersions, uploadMapping } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { shortDate } from '../format'
import './pages.css'

export default function MappingsPage() {
  const { appId } = useParams()
  const state = useAsync(() => getVersions(appId!), [appId])
  const fileRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<AppVersion | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const pickFile = (version: AppVersion) => {
    targetRef.current = version
    fileRef.current?.click()
  }

  const onFile = async (file: File | undefined) => {
    const target = targetRef.current
    if (!file || !target) return
    setUploadingId(target.id)
    try {
      await uploadMapping(appId!, target.id, file)
      toast.success(`Mapping uploaded for ${target.version_name || target.version_code}`)
      state.reload()
    } catch (e) {
      toast.error(errorText(e, 'Failed to upload mapping'))
    } finally {
      setUploadingId(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const columns: Column<AppVersion>[] = [
    { key: 'version', title: 'Version', render: (r) => <Text strong>{r.version_name || r.version_code}</Text> },
    { key: 'code', title: 'Version code', align: 'right', render: (r) => <Text mono>{r.version_code}</Text> },
    { key: 'created', title: 'Created', align: 'right', render: (r) => <Text type="secondary">{shortDate(r.created_at)}</Text> },
    { key: 'status', title: 'Mapping', align: 'right', render: (r) => <Tag tone={r.has_mapping ? 'success' : 'warning'}>{r.has_mapping ? 'Available' : 'Missing'}</Tag> },
    {
      key: 'actions', title: '', align: 'right',
      render: (r) => (
        <span className="pg-rowactions">
          {r.has_mapping && (
            <Button
              size="sm"
              icon={<Icons.IconDownload size={14} />}
              onClick={() => window.open(getMappingDownloadUrl(appId!, r.id), '_blank')}
            >
              Download
            </Button>
          )}
          <Button
            size="sm"
            icon={<Icons.IconUpload size={14} />}
            loading={uploadingId === r.id}
            onClick={() => pickFile(r)}
          >
            {r.has_mapping ? 'Replace' : 'Upload'}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div className="pg">
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.map"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Card title="Mapping files" subtitle="ProGuard / R8 mappings deobfuscate crash stack traces." padded={false}>
        <Loaded state={state} emptyText="No versions yet">
          {(versions) => <Table<AppVersion> columns={columns} data={versions} rowKey={(r) => r.id} emptyText="No versions yet" />}
        </Loaded>
      </Card>
    </div>
  )
}
