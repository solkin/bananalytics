import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  ConfirmDialog,
  DataList,
  DetailPanel,
  Dialog,
  Field,
  Form,
  Input,
  Notice,
  PageHeader,
  Properties,
  Select,
  SplitView,
  Status,
  toast,
  type DataListColumn,
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
import { copyText } from '../clipboard'
import { useRegisterCommands } from '../commands'
import { cap, fmtDateTime, shortDate } from '../format'
import './settings.css'

const ROLE_OPTIONS = [
  { label: 'Admin, full access including settings', value: 'admin' },
  { label: 'Viewer, can view analytics and crashes', value: 'viewer' },
  { label: 'Tester, can download builds', value: 'tester' },
]
const INVITE_FORM = 'invite-person'
const AVATAR_ROW = 28
const AVATAR_PANEL = 40

function InviteDialog({
  appId,
  smtpConfigured,
  onClose,
  onInvited,
}: {
  appId: string
  smtpConfigured: boolean
  onClose: () => void
  onInvited: (access: AppAccess) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | number>('viewer')
  const [known, setKnown] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const valid = /\S+@\S+\.\S+/.test(email)

  const latestEmail = useRef(email)
  latestEmail.current = email

  const check = () => {
    if (!valid) return setKnown(null)
    const checked = email
    checkEmail(checked).then(
      /* Ignored if the address changed while the request was on its way. */
      (result) => {
        if (latestEmail.current === checked) setKnown(result.exists)
      },
      /* The check only decides which hint to show; granting still works. */
      () => setKnown(null),
    )
  }

  const submit = async () => {
    if (!valid) return toast.error('Enter a valid email address')
    setSending(true)
    try {
      const access = await grantAccess(appId, email.trim(), String(role))
      /* The hint check runs on blur, so Enter can submit before it answers. */
      if (access.status === 'invited') {
        toast.success(smtpConfigured ? 'Invitation email sent' : 'Invitation created. Copy the link and share it manually.')
      } else {
        toast.success('Access granted')
      }
      onInvited(access)
    } catch (e) {
      toast.error(errorText(e, 'Failed to grant access'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={sending ? undefined : onClose}
      title="Invite people"
      footer={
        <>
          <Button onClick={onClose} disabled={sending}>Cancel</Button>
          <Button variant="primary" loading={sending} type="submit" form={INVITE_FORM}>
            {known === false ? 'Send invitation' : 'Grant access'}
          </Button>
        </>
      }
    >
      <Form id={INVITE_FORM} onSubmit={submit}>
        <Field label="Email" required>
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setKnown(null)
            }}
            onBlur={check}
          />
        </Field>
        {known === false && (
          <Notice title="This person is not registered yet.">
            {smtpConfigured
              ? 'An invitation email will be sent, and they get access after registering.'
              : 'No email goes out because SMTP is not configured. Copy the invitation link and share it manually.'}
          </Notice>
        )}
        <Field label="Role" required>
          <Select options={ROLE_OPTIONS} value={role} onChange={setRole} />
        </Field>
      </Form>
    </Dialog>
  )
}

function MemberPanel({
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
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const canManage = isAdmin && !isSelf
  const invited = access.status === 'invited'
  const displayName = access.user_name || access.user_email

  const save = async () => {
    setSaving(true)
    try {
      await updateAccess(appId, access.id, String(role))
      toast.success('Role updated')
      onChanged()
    } catch (e) {
      toast.error(errorText(e, 'Failed to update role'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setRemoving(true)
    try {
      await revokeAccess(appId, access.id)
      toast.success(invited ? 'Invitation cancelled' : 'Access revoked')
      onClose()
      onChanged()
    } catch (e) {
      toast.error(errorText(e, invited ? 'Failed to cancel invitation' : 'Failed to revoke access'))
      setRemoving(false)
    }
  }

  const copyLink = async () => {
    try {
      await copyText(await getInvitationLink(appId, access.id), 'Invitation link copied')
    } catch (e) {
      toast.error(errorText(e, 'Failed to copy link'))
    }
  }

  const resend = async () => {
    try {
      await resendInvitation(appId, access.id)
      toast.success('Invitation email sent')
    } catch (e) {
      toast.error(errorText(e, 'Failed to resend invitation'))
    }
  }

  return (
    <DetailPanel
      label={invited ? 'Invitation details' : 'Member details'}
      title={invited ? 'Invitation' : 'Member'}
      onClose={onClose}
      actions={canManage && (
        <Button variant="primary" loading={saving} disabled={role === access.role} onClick={() => void save()}>Save changes</Button>
      )}
    >
      <div className="set-panel">
        <div className="set-identity">
          <Avatar name={displayName} src={access.user_avatar_url} size={AVATAR_PANEL} />
          <div className="set-truncate">
            <div className="set-identity__name set-truncate">{displayName}</div>
            {access.user_name && <div className="set-muted set-truncate">{access.user_email}</div>}
          </div>
        </div>
        <Properties
          items={[
            { label: 'Status', value: invited ? <Status tone="warning">Invited</Status> : <Status tone="positive">Active</Status> },
            { label: invited ? 'Invited' : 'Added', value: fmtDateTime(access.created_at) },
            ...(canManage ? [] : [{ label: 'Role', value: cap(access.role) }]),
          ]}
        />
        {canManage && (
          <Field label="Role" help="Controls which areas and actions are available to this person.">
            <Select options={ROLE_OPTIONS} value={role} onChange={setRole} />
          </Field>
        )}
        {canManage && invited && (
          <div className="set-actions">
            <Button onClick={() => void copyLink()}>Copy invitation link</Button>
            {smtpConfigured && <Button onClick={() => void resend()}>Resend email</Button>}
          </div>
        )}
        {canManage && (
          <div className="set-danger">
            <div className="set-danger__text">
              <div className="set-strong">{invited ? 'Cancel invitation' : 'Revoke access'}</div>
              <div className="set-muted set-caption">
                {invited ? 'The invitation link will stop working.' : 'This person immediately loses access to the application.'}
              </div>
            </div>
            <Button variant="danger" onClick={() => setConfirming(true)}>{invited ? 'Cancel' : 'Revoke'}</Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title={invited ? 'Cancel this invitation?' : `Revoke access for ${displayName}?`}
        description={invited ? 'The invitation link will stop working.' : 'They will immediately lose access to this application.'}
        confirmLabel={invited ? 'Cancel invitation' : 'Revoke'}
        loading={removing}
        onConfirm={() => void remove()}
        onClose={() => setConfirming(false)}
      />
    </DetailPanel>
  )
}

export default function PeoplePage() {
  const { appId } = useParams()
  const { user, config } = useAuth()
  const state = useAsync(() => getAppAccess(appId!), [appId], { key: `people:${appId}` })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const members = state.data ?? []
  const selected = members.find((m) => m.id === selectedId) ?? null
  const isAdmin = members.find((m) => m.user_id === user?.id)?.role === 'admin'
  const smtpConfigured = !!config?.smtp_configured

  useRegisterCommands(
    () => (isAdmin ? [{ id: 'person-invite', group: 'People', label: 'Invite people', keys: ['C'], run: () => setInviteOpen(true) }] : []),
    [isAdmin],
  )

  const columns: DataListColumn<AppAccess>[] = [
    {
      key: 'name',
      title: 'Member',
      render: (r) => (
        <span className="set-person">
          <Avatar name={r.user_name || r.user_email} src={r.user_avatar_url} size={AVATAR_ROW} />
          <span className="set-two-lines">
            <span className="set-two-lines__main">
              <span className="set-truncate set-strong">{r.user_name || r.user_email}</span>
              {r.user_id === user?.id && <span className="set-muted set-caption">You</span>}
              {r.status === 'invited' && <Status tone="warning" className="set-caption">Invited</Status>}
            </span>
            {r.user_name && <span className="set-two-lines__sub set-caption">{r.user_email}</span>}
          </span>
        </span>
      ),
    },
    { key: 'role', title: 'Role', width: 84, render: (r) => cap(r.role) },
    { key: 'added', title: 'Added', width: 84, align: 'right', optional: true, render: (r) => <span className="set-faint">{shortDate(r.created_at)}</span> },
  ]

  return (
    <>
      <SplitView
        detailWidth={420}
        list={
          <section aria-label="People">
            <PageHeader title="People" className="set-header">
              {isAdmin && <Button variant="primary" onClick={() => setInviteOpen(true)}>Invite people</Button>}
            </PageHeader>
            <Loaded state={state} emptyText="No members yet">
              {(rows) => (
                <DataList
                  label="People"
                  columns={columns}
                  data={rows}
                  rowKey={(r) => r.id}
                  selectedKey={selectedId}
                  onRowClick={(r) => setSelectedId(r.id)}
                />
              )}
            </Loaded>
          </section>
        }
        detail={
          selected ? (
            <MemberPanel
              key={selected.id}
              appId={appId!}
              access={selected}
              isAdmin={isAdmin}
              isSelf={selected.user_id === user?.id}
              smtpConfigured={smtpConfigured}
              onClose={() => setSelectedId(null)}
              onChanged={state.reload}
            />
          ) : undefined
        }
      />
      {inviteOpen && (
        <InviteDialog
          appId={appId!}
          smtpConfigured={smtpConfigured}
          onClose={() => setInviteOpen(false)}
          onInvited={(access) => {
            setInviteOpen(false)
            state.reload()
            setSelectedId(access.id)
          }}
        />
      )}
    </>
  )
}
