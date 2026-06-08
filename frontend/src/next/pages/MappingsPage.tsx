import { useParams } from 'react-router-dom'
import { Card, Table, Tag, Text, type Column } from '@/ui'
import type { AppVersion } from '@/types'
import { getVersions } from '@/api/apps'
import { useAsync, Loaded } from '../async'
import { shortDate } from '../format'
import './pages.css'

export default function MappingsPage() {
  const { appId } = useParams()
  const state = useAsync(() => getVersions(appId!), [appId])

  const columns: Column<AppVersion>[] = [
    { key: 'version', title: 'Version', render: (r) => <Text strong>{r.version_name || r.version_code}</Text> },
    { key: 'code', title: 'Version code', align: 'right', render: (r) => <Text mono>{r.version_code}</Text> },
    { key: 'created', title: 'Created', align: 'right', render: (r) => <Text type="secondary">{shortDate(r.created_at)}</Text> },
    { key: 'status', title: 'Mapping', align: 'right', render: (r) => <Tag tone={r.has_mapping ? 'success' : 'warning'}>{r.has_mapping ? 'Available' : 'Missing'}</Tag> },
  ]

  return (
    <div className="pg">
      <Card title="Mapping files" subtitle="ProGuard / R8 mappings deobfuscate crash stack traces." padded={false}>
        <Loaded state={state}>
          {(versions) => <Table<AppVersion> columns={columns} data={versions} rowKey={(r) => r.id} emptyText="No versions yet" />}
        </Loaded>
      </Card>
    </div>
  )
}
