import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, DataList, FileButton, PageHeader, Status, toast, type DataListColumn } from '@/ui'
import type { AppVersion } from '@/types'
import { getMappingDownloadUrl, getVersions, uploadMapping } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { shortDate } from '../format'
import { useShell } from '../layout/AppShell'
import './mappings.css'

export const MAPPING_ACCEPT = '.txt,.map,.gz'

export default function MappingsPage() {
  const { appId } = useParams()
  const { role } = useShell()
  const state = useAsync(() => getVersions(appId!), [appId], { key: `versions:${appId}` })
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const upload = async (version: AppVersion, file: File) => {
    setUploadingId(version.id)
    try {
      await uploadMapping(appId!, version.id, file)
      toast.success(`Mapping uploaded for ${version.version_name || version.version_code}`)
      state.reload()
    } catch (e) {
      toast.error(errorText(e, 'Failed to upload mapping'))
    } finally {
      setUploadingId(null)
    }
  }

  const columns: DataListColumn<AppVersion>[] = [
    { key: 'version', title: 'Version', render: (r) => <strong className="map-version">{r.version_name || r.version_code}</strong> },
    { key: 'code', title: 'Version code', width: 108, align: 'right', optional: true, render: (r) => <span className="bnn-mono map-faint">{r.version_code}</span> },
    { key: 'created', title: 'Created', width: 84, align: 'right', optional: true, render: (r) => <span className="map-faint">{shortDate(r.created_at)}</span> },
    {
      key: 'status',
      title: 'Mapping',
      width: 120,
      render: (r) => (r.has_mapping ? <Status tone="positive">Available</Status> : <Status tone="warning">Missing</Status>),
    },
    {
      key: 'actions',
      title: <span className="bnn-visually-hidden">Actions</span>,
      width: 192,
      align: 'right',
      render: (r) => (
        <span className="map-actions">
          {r.has_mapping && (
            <Button
              variant="ghost"
              aria-label={`Download mapping for ${r.version_name || r.version_code}`}
              onClick={() => window.open(getMappingDownloadUrl(appId!, r.id), '_blank')}
            >
              Download
            </Button>
          )}
          {role === 'admin' && (
            <FileButton
              accept={MAPPING_ACCEPT}
              aria-label={`${r.has_mapping ? 'Replace' : 'Upload'} mapping for ${r.version_name || r.version_code}`}
              loading={uploadingId === r.id}
              onFile={(file) => void upload(r, file)}
            >
              {r.has_mapping ? 'Replace' : 'Upload'}
            </FileButton>
          )}
        </span>
      ),
    },
  ]

  return (
    <section>
      <PageHeader title="Mappings">
        <p className="map-hint">ProGuard and R8 mappings deobfuscate crash stack traces.</p>
      </PageHeader>
      <Loaded state={state} emptyText="No versions yet">
        {(versions) => <DataList label="Mappings" columns={columns} data={versions} rowKey={(r) => r.id} />}
      </Loaded>
    </section>
  )
}
