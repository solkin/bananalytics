import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Divider, Form, FormItem, Icons, Input, Password, Popconfirm, Text, Title, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { changePassword } from '@/api/auth'
import { errorText } from '../async'
import { IMAGE_ACCEPT, squarePng } from '../image'
import { UserAvatar } from '../UserAvatar'
import { AppTopBar } from '../layout/AppTopBar'
import './appshome.css'
import './account.css'

function AvatarRow() {
  const { user, updateAvatar, removeAvatar } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  // Which action is running, so the spinner lands on the button that started it.
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const displayName = user?.name || user?.email || '?'

  const upload = async (file?: File) => {
    if (!file) return
    setBusy('upload')
    try {
      await updateAvatar(await squarePng(file))
      toast.success('Avatar updated')
    } catch (e) {
      toast.error(errorText(e, 'Failed to upload the avatar'))
    } finally {
      setBusy(null)
      // Clear the picker, so choosing the same file again still fires onChange.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy('remove')
    try {
      await removeAvatar()
      toast.success('Avatar removed')
    } catch (e) {
      toast.error(errorText(e, 'Failed to remove the avatar'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="acct-avatar">
      <UserAvatar size={72} name={displayName} avatarUrl={user?.avatar_url} />
      <div className="acct-avatar__meta">
        <Text strong>{user?.avatar_url ? 'Custom avatar' : 'Generated from your name'}</Text>
        <div>
          <Text type="secondary" size="sm">
            PNG, JPEG or WebP. Cropped to a square and scaled down to 256×256 before upload.
          </Text>
        </div>
      </div>
      <span className="acct-avatar__actions">
        {user?.avatar_url && (
          <Popconfirm
            title="Remove the avatar?"
            description="You fall back to the letter avatar generated from your name."
            okDanger
            okText="Remove"
            onConfirm={remove}
          >
            <Button
              variant="danger"
              icon={<Icons.IconTrash size={15} />}
              loading={busy === 'remove'}
              disabled={busy !== null}
            >
              Remove
            </Button>
          </Popconfirm>
        )}
        <Button
          icon={<Icons.IconUpload size={15} />}
          loading={busy === 'upload'}
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {user?.avatar_url ? 'Replace' : 'Upload'}
        </Button>
      </span>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </div>
  )
}

function ProfileCard() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile(name.trim())
      toast.success('Profile updated')
    } catch (e) {
      toast.error(errorText(e, 'Failed to update profile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Profile" subtitle="Your name and avatar are what other members of an app see.">
      <AvatarRow />
      <Divider />
      <Form>
        <FormItem label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </FormItem>
        <FormItem label="Email" help="Email can't be changed.">
          <Input value={user?.email ?? ''} disabled />
        </FormItem>
        <div><Button variant="primary" loading={saving} onClick={save}>Save profile</Button></div>
      </Form>
    </Card>
  )
}

function PasswordCard() {
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [conf, setConf] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (nw.length < 6) return toast.error('Password must be at least 6 characters')
    if (nw !== conf) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      await changePassword(cur, nw)
      toast.success('Password changed')
      setCur(''); setNw(''); setConf('')
    } catch (e) {
      toast.error(errorText(e, 'Failed to change password'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Password">
      <Form>
        <FormItem label="Current password">
          <Password value={cur} onChange={(e) => setCur(e.target.value)} placeholder="••••••••" />
        </FormItem>
        <FormItem label="New password" help="At least 6 characters.">
          <Password value={nw} onChange={(e) => setNw(e.target.value)} placeholder="••••••••" />
        </FormItem>
        <FormItem label="Confirm new password">
          <Password value={conf} onChange={(e) => setConf(e.target.value)} placeholder="••••••••" />
        </FormItem>
        <div><Button variant="primary" loading={saving} onClick={save}>Change password</Button></div>
      </Form>
    </Card>
  )
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="home">
      <AppTopBar />

      {/* Same frame as the app list — this is the other top-level page. */}
      <main className="home-main">
        <Link to="/" className="acct-back">
          <Icons.IconChevronLeft size={15} />
          <span>All apps</span>
        </Link>
        <div className="home-head">
          <Title level={2}>Account</Title>
        </div>

        <div className="acct-grid">
          <ProfileCard />
          <div className="acct-col">
            <PasswordCard />
            <Card title="Session">
              <div className="acct-signout">
                <Text type="secondary">Signed in as {user?.email}</Text>
                <Button
                  variant="danger"
                  icon={<Icons.IconLogout size={15} />}
                  onClick={() => logout().then(() => navigate('/login'))}
                >
                  Sign out
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
