import { useParams } from 'react-router-dom'
import { Avatar, Button, Card, Icons, Table, Tag, Text, type Column } from '@/ui'
import { getAppMembers, type AppMember } from '@/api/apps'
import { useAsync, Loaded } from '../async'
import { cap } from '../format'
import './pages.css'

const ROLE_TONE: Record<string, 'primary' | 'purple' | 'success' | 'neutral'> = {
  owner: 'primary', admin: 'primary', manager: 'purple', developer: 'success', viewer: 'neutral', tester: 'neutral',
}

export default function PeoplePage() {
  const { appId } = useParams()
  const state = useAsync(() => getAppMembers(appId!), [appId])

  const columns: Column<AppMember>[] = [
    {
      key: 'name', title: 'Member',
      render: (r) => (
        <div className="pg-person">
          <Avatar size={28}>{(r.name || r.email).charAt(0).toUpperCase()}</Avatar>
          <div>
            <div className="pg-person__name">{r.name || r.email}</div>
            <Text type="tertiary" size="sm">{r.email}</Text>
          </div>
        </div>
      ),
    },
    { key: 'role', title: 'Role', render: (r) => <Tag tone={ROLE_TONE[r.role.toLowerCase()] ?? 'neutral'}>{cap(r.role)}</Tag> },
  ]

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <Button variant="primary" icon={<Icons.IconPlus size={15} />}>Invite people</Button>
      </div>
      <Card title="People" padded={false}>
        <Loaded state={state}>
          {(members) => <Table<AppMember> columns={columns} data={members} rowKey={(r) => r.email} emptyText="No members yet" />}
        </Loaded>
      </Card>
    </div>
  )
}
