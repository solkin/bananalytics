import { useParams } from 'react-router-dom'
import { Button, Card, Icons, Table, Tag, Text, type Column } from '@/ui'
import type { AppVersion } from '@/types'
import { getApkDownloadUrl, getVersions } from '@/api/apps'
import { useAsync, Loaded } from '../async'
import { shortDate } from '../format'
import './pages.css'

const fmtBytes = (b: number | null) =>
  b == null ? '—' : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`

export default function ReleasesPage() {
  const { appId } = useParams()
  const state = useAsync(() => getVersions(appId!), [appId])

  const columns: Column<AppVersion>[] = [
    {
      key: 'release', title: 'Release',
      render: (r) => (
        <div className="pg-titlecell">
          <span className="pg-titlecell__main">{r.version_name || '—'} ({r.version_code})</span>
          <span className="pg-titlecell__sub">{r.release_notes || 'No release notes'}</span>
        </div>
      ),
    },
    { key: 'date', title: 'Created', align: 'right', render: (r) => <Text type="secondary">{shortDate(r.created_at)}</Text> },
    { key: 'size', title: 'APK size', align: 'right', render: (r) => <Text type="secondary">{fmtBytes(r.apk_size)}</Text> },
    { key: 'status', title: 'Status', align: 'right', render: (r) => <Tag tone={r.published_for_testers ? 'warning' : 'success'}>{r.published_for_testers ? 'Testing' : 'Released'}</Tag> },
    {
      key: 'apk', title: '', align: 'right',
      render: (r) => r.has_apk
        ? <Button size="sm" icon={<Icons.IconDownload size={14} />} onClick={() => window.open(getApkDownloadUrl(appId!, r.id), '_blank')}>APK</Button>
        : null,
    },
  ]

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <Button variant="primary" icon={<Icons.IconUpload size={15} />}>New release</Button>
      </div>
      <Card title="Releases" padded={false}>
        <Loaded state={state}>
          {(versions) => <Table<AppVersion> columns={columns} data={versions} rowKey={(r) => r.id} emptyText="No releases yet" />}
        </Loaded>
      </Card>
    </div>
  )
}
