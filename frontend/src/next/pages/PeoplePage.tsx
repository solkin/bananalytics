import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Dropdown,
  Form,
  FormItem,
  Icons,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Text,
  toast,
  type Column,
} from '@/ui'
import type { AppAccess } from '@/types/auth'
import {
  checkEmail,
  getAppAccess,
  getInvitationLink,
  grantAccess,
  resendInvitation,
  revokeAccess,
  updateAccess,
} from '@/api/auth'
import { useAuth } from '@/context/AuthContext'
import { useAsync, Loaded, errorText } from '../async'
import { cap, shortDate } from '../format'
import './pages.css'

const ROLE_TONE: Record<string, 'primary' | 'purple' | 'success' | 'neutral'> = {
  admin: 'primary', viewer: 'neutral', tester: 'success',
}

const ROLE_OPTIONS = [
  { label: 'Admin — full access including settings', value: 'admin' },
  { label: 'Viewer — can view analytics and crashes', value: 'viewer' },
  { label: 'Tester — can download builds', value: 'tester' },
]

function InviteModal({
  appId,
  smtpConfigured,
  open,
  onClose,
  onInvited,
}: {
  appId: string
  smtpConfigured: boolean
  open: boolean
  onClose: () => void
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | number>('viewer')
  const [known, setKnown] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const valid = /\S+@\S+\.\S+/.test(email)

  const check = async () => {
    if (!valid) return setKnown(null)
    try {
      const result = await checkEmail(email)
      setKnown(result.exists)
    } catch {
      setKnown(null)
    }
  }

  const submit = async () => {
    if (!valid) return toast.error('Enter a valid email address')
    setSending(true)
    try {
      await grantAccess(appId, email.trim(), String(role))
      if (known === false) {
        toast.success(smtpConfigured ? 'Invitation email sent' : 'Invitation created — share the link manually')
      } else {
        toast.success('Access granted')
      }
      onClose()
      onInvited()
    } catch (e) {
      toast.error(errorText(e, 'Failed to grant access'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite people"
      width={480}
      okText={known === false ? 'Send invitation' : 'Grant access'}
      onOk={submit}
      confirmLoading={sending}
    >
      <Form>
        <FormItem label="Email" required>
          <Input
            type="email"
            placeholder="user@example.com"
            prefix={<Icons.IconMail size={15} />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setKnown(null)
            }}
            onBlur={check}
          />
        </FormItem>
        {known === false && (
          <Alert
            type="info"
            message="User is not registered yet"
            description={
              smtpConfigured
                ? 'An invitation email will be sent. After registering, they automatically get access to this app.'
                : 'SMTP is not configured, so no email goes out — copy the invitation link from the list and share it manually.'
            }
          />
        )}
        <FormItem label="Role" required>
          <Select options={ROLE_OPTIONS} value={role} onChange={setRole} />
        </FormItem>
      </Form>
    </Modal>
  )
}

export default function PeoplePage() {
  const { appId } = useParams()
  const { user, config } = useAuth()
  const state = useAsync(() => getAppAccess(appId!), [appId])
  const [inviteOpen, setInviteOpen] = useState(false)

  const me = (state.data ?? []).find((a) => a.user_id === user?.id)
  const isAdmin = me?.role === 'admin'

  const changeRole = async (access: AppAccess, role: string) => {
    try {
      await updateAccess(appId!, access.id, role)
      toast.success('Role updated')
      state.reload()
    } catch (e) {
      toast.error(errorText(e, 'Failed to update role'))
    }
  }

  const revoke = async (access: AppAccess) => {
    try {
      await revokeAccess(appId!, access.id)
      toast.success(access.status === 'invited' ? 'Invitation cancelled' : 'Access revoked')
      state.reload()
    } catch (e) {
      toast.error(errorText(e, 'Failed to revoke access'))
    }
  }

  const copyLink = async (access: AppAccess) => {
    try {
      const url = await getInvitationLink(appId!, access.id)
      await navigator.clipboard?.writeText(url)
      toast.success('Invitation link copied')
    } catch (e) {
      toast.error(errorText(e, 'Failed to copy link'))
    }
  }

  const resend = async (access: AppAccess) => {
    try {
      await resendInvitation(appId!, access.id)
      toast.success('Invitation email sent')
    } catch (e) {
      toast.error(errorText(e, 'Failed to resend invitation'))
    }
  }

  const columns: Column<AppAccess>[] = [
    {
      key: 'name', title: 'Member',
      render: (r) => (
        <div className="pg-person">
          <Avatar size={28}>{(r.user_name || r.user_email).charAt(0).toUpperCase()}</Avatar>
          <div>
            <div className="pg-person__name">
              {r.user_name || r.user_email}
              {r.user_id === user?.id && <Tag className="pg-person__tag">You</Tag>}
              {r.status === 'invited' && <Tag tone="warning" className="pg-person__tag">Invited</Tag>}
            </div>
            <Text type="tertiary" size="sm">{r.user_email}</Text>
          </div>
        </div>
      ),
    },
    {
      key: 'role', title: 'Role', width: 200,
      render: (r) =>
        isAdmin && r.user_id !== user?.id ? (
          <Select
            size="sm"
            style={{ width: 120 }}
            value={r.role}
            onChange={(role) => void changeRole(r, String(role))}
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Viewer', value: 'viewer' },
              { label: 'Tester', value: 'tester' },
            ]}
          />
        ) : (
          <Tag tone={ROLE_TONE[r.role] ?? 'neutral'}>{cap(r.role)}</Tag>
        ),
    },
    { key: 'added', title: 'Added', align: 'right', render: (r) => <Text type="secondary">{shortDate(r.created_at)}</Text> },
    ...(isAdmin
      ? [{
          key: 'actions', title: '', align: 'right' as const, width: 90,
          render: (r: AppAccess) =>
            r.user_id !== user?.id ? (
              <span className="pg-rowactions">
                {r.status === 'invited' && (
                  <Dropdown
                    items={[
                      { key: 'copy', label: 'Copy invitation link', icon: <Icons.IconCopy size={14} />, onClick: () => void copyLink(r) },
                      ...(config?.smtp_configured
                        ? [{ key: 'resend', label: 'Resend invitation email', icon: <Icons.IconSend size={14} />, onClick: () => void resend(r) }]
                        : []),
                    ]}
                  >
                    <Button size="sm" icon={<Icons.IconMail size={14} />} />
                  </Dropdown>
                )}
                <Popconfirm
                  title={r.status === 'invited' ? 'Cancel this invitation?' : 'Revoke access?'}
                  description={r.status === 'invited' ? undefined : `${r.user_email} will lose access to this app.`}
                  okText={r.status === 'invited' ? 'Cancel invitation' : 'Revoke'}
                  okDanger
                  onConfirm={() => void revoke(r)}
                >
                  <Button size="sm" variant="danger" icon={<Icons.IconTrash size={14} />} />
                </Popconfirm>
              </span>
            ) : null,
        }]
      : []),
  ]

  return (
    <div className="pg">
      {isAdmin && (
        <div className="pg-toolbar">
          <Button variant="primary" icon={<Icons.IconPlus size={15} />} onClick={() => setInviteOpen(true)}>
            Invite people
          </Button>
        </div>
      )}
      <Card title="People" padded={false}>
        <Loaded state={state} emptyText="No members yet">
          {(members) => <Table<AppAccess> columns={columns} data={members} rowKey={(r) => r.id} emptyText="No members yet" />}
        </Loaded>
      </Card>

      <InviteModal
        appId={appId!}
        smtpConfigured={!!config?.smtp_configured}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={state.reload}
      />
    </div>
  )
}
