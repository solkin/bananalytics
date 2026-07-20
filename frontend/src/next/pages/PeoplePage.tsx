import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Divider,
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
import { cap, fmtDateTime, shortDate } from '../format'
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

function MemberModal({
  appId,
  access,
  isAdmin,
  isSelf,
  smtpConfigured,
  onClose,
  onChanged,
}: {
  appId: string
  access: AppAccess
  isAdmin: boolean
  isSelf: boolean
  smtpConfigured: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [role, setRole] = useState<string | number>(access.role)
  const [working, setWorking] = useState<'save' | 'remove' | 'copy' | 'resend' | null>(null)
  const canManage = isAdmin && !isSelf
  const invited = access.status === 'invited'
  const displayName = access.user_name || access.user_email

  const save = async () => {
    setWorking('save')
    try {
      await updateAccess(appId, access.id, String(role))
      toast.success('Role updated')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(errorText(e, 'Failed to update role'))
    } finally {
      setWorking(null)
    }
  }

  const remove = async () => {
    setWorking('remove')
    try {
      await revokeAccess(appId, access.id)
      toast.success(invited ? 'Invitation cancelled' : 'Access revoked')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(errorText(e, invited ? 'Failed to cancel invitation' : 'Failed to revoke access'))
    } finally {
      setWorking(null)
    }
  }

  const copyLink = async () => {
    setWorking('copy')
    try {
      const url = await getInvitationLink(appId, access.id)
      await navigator.clipboard?.writeText(url)
      toast.success('Invitation link copied')
    } catch (e) {
      toast.error(errorText(e, 'Failed to copy link'))
    } finally {
      setWorking(null)
    }
  }

  const resend = async () => {
    setWorking('resend')
    try {
      await resendInvitation(appId, access.id)
      toast.success('Invitation email sent')
    } catch (e) {
      toast.error(errorText(e, 'Failed to resend invitation'))
    } finally {
      setWorking(null)
    }
  }

  return (
    <Modal
      open
      onClose={working ? undefined : onClose}
      title={invited ? 'Invitation details' : 'Member details'}
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={working != null}>Close</Button>
          {canManage && (
            <Button
              variant="primary"
              loading={working === 'save'}
              disabled={role === access.role || working != null}
              onClick={save}
            >
              Save changes
            </Button>
          )}
        </>
      }
    >
      <div className="people-detail">
        <div className="people-detail__identity">
          <Avatar size={44}>{displayName.charAt(0).toUpperCase()}</Avatar>
          <div>
            <div className="people-detail__name">{displayName}</div>
            {access.user_name && <Text type="secondary">{access.user_email}</Text>}
          </div>
          <Tag tone={invited ? 'warning' : 'success'}>{invited ? 'Invited' : 'Active'}</Tag>
        </div>

        <Descriptions
          column={1}
          size="sm"
          items={[
            { label: 'Email', value: access.user_email },
            { label: invited ? 'Invited' : 'Added', value: fmtDateTime(access.created_at) },
          ]}
        />

        <Divider>Permissions</Divider>
        {canManage ? (
          <FormItem label="Role" help="Controls which areas and actions are available to this person.">
            <Select options={ROLE_OPTIONS} value={role} onChange={setRole} />
          </FormItem>
        ) : (
          <Descriptions
            column={1}
            size="sm"
            items={[{ label: 'Role', value: <Tag tone={ROLE_TONE[access.role] ?? 'neutral'}>{cap(access.role)}</Tag> }]}
          />
        )}

        {canManage && invited && (
          <>
            <Divider>Invitation</Divider>
            <div className="people-detail__actions">
              <Button icon={<Icons.IconCopy size={14} />} loading={working === 'copy'} onClick={copyLink}>
                Copy invitation link
              </Button>
              {smtpConfigured && (
                <Button icon={<Icons.IconSend size={14} />} loading={working === 'resend'} onClick={resend}>
                  Resend email
                </Button>
              )}
            </div>
          </>
        )}

        {canManage && (
          <>
            <Divider>Danger zone</Divider>
            <div className="people-detail__danger">
              <div>
                <Text strong>{invited ? 'Cancel invitation' : 'Revoke access'}</Text>
                <div>
                  <Text type="tertiary" size="sm">
                    {invited ? 'The invitation link will stop working.' : 'This person will immediately lose access to the application.'}
                  </Text>
                </div>
              </div>
              <Popconfirm
                title={invited ? 'Cancel this invitation?' : 'Revoke access?'}
                okText={invited ? 'Cancel invitation' : 'Revoke'}
                okDanger
                onConfirm={remove}
              >
                <Button variant="danger" icon={<Icons.IconTrash size={14} />} loading={working === 'remove'}>
                  {invited ? 'Cancel' : 'Revoke'}
                </Button>
              </Popconfirm>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function PeoplePage() {
  const { appId } = useParams()
  const { user, config } = useAuth()
  const state = useAsync(() => getAppAccess(appId!), [appId])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selected, setSelected] = useState<AppAccess | null>(null)

  const me = (state.data ?? []).find((a) => a.user_id === user?.id)
  const isAdmin = me?.role === 'admin'

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
            {r.user_name && <Text type="tertiary" size="sm">{r.user_email}</Text>}
          </div>
        </div>
      ),
    },
    {
      key: 'role', title: 'Role', width: 140,
      render: (r) => <Tag tone={ROLE_TONE[r.role] ?? 'neutral'}>{cap(r.role)}</Tag>,
    },
    { key: 'added', title: 'Added', align: 'right', render: (r) => <Text type="secondary">{shortDate(r.created_at)}</Text> },
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
          {(members) => (
            <Table<AppAccess>
              columns={columns}
              data={members}
              rowKey={(r) => r.id}
              emptyText="No members yet"
              onRowClick={setSelected}
            />
          )}
        </Loaded>
      </Card>

      <InviteModal
        appId={appId!}
        smtpConfigured={!!config?.smtp_configured}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={state.reload}
      />
      {selected && (
        <MemberModal
          key={selected.id}
          appId={appId!}
          access={selected}
          isAdmin={isAdmin}
          isSelf={selected.user_id === user?.id}
          smtpConfigured={!!config?.smtp_configured}
          onClose={() => setSelected(null)}
          onChanged={state.reload}
        />
      )}
    </div>
  )
}
