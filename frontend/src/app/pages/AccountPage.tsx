import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  ConfirmDialog,
  FileButton,
  Input,
  Password,
  SettingsGroup,
  SettingsRow,
  toast,
} from '@/ui'
import { changePassword } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'
import { errorText } from '../async'
import { IMAGE_ACCEPT, squarePng } from '../image'
import { TopHeader } from '../layout/TopHeader'
import './account.css'
import './settings.css'

const MIN_PASSWORD = 6
const AVATAR_SIZE = 32

function Profile() {
  const { user, updateProfile, updateAvatar, removeAvatar } = useAuth()
  const nameId = useId()
  const savedName = user?.name ?? ''
  const [name, setName] = useState(savedName)
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const displayName = user?.name || user?.email || ''

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

  const upload = async (file: File) => {
    setAvatarBusy(true)
    try {
      await updateAvatar(await squarePng(file))
      toast.success('Avatar updated')
    } catch (e) {
      toast.error(errorText(e, 'Failed to upload the avatar'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const remove = async () => {
    setAvatarBusy(true)
    try {
      await removeAvatar()
      toast.success('Avatar removed')
      setConfirmRemove(false)
    } catch (e) {
      toast.error(errorText(e, 'Failed to remove the avatar'))
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <SettingsGroup
      title="Profile"
      footer={
        <Button variant="primary" loading={saving} disabled={name.trim() === savedName} onClick={() => void save()}>Save profile</Button>
      }
    >
      <SettingsRow label="Avatar" hint="PNG, JPEG or WebP, scaled down to 256×256.">
        <Avatar name={displayName} src={user?.avatar_url} size={AVATAR_SIZE} />
        {user?.avatar_url && <Button variant="ghost" disabled={avatarBusy} onClick={() => setConfirmRemove(true)}>Remove</Button>}
        <FileButton accept={IMAGE_ACCEPT} aria-label={user?.avatar_url ? 'Replace avatar' : 'Upload avatar'} loading={avatarBusy} onFile={(file) => void upload(file)}>
          {user?.avatar_url ? 'Replace' : 'Upload'}
        </FileButton>
      </SettingsRow>
      <SettingsRow label="Name" htmlFor={nameId} stretch>
        <Input id={nameId} autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      </SettingsRow>
      <SettingsRow label="Email" hint="Email can't be changed." stretch>
        {user?.email}
      </SettingsRow>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove the avatar?"
        description="You fall back to the initials generated from your name."
        confirmLabel="Remove"
        loading={avatarBusy}
        onConfirm={() => void remove()}
        onClose={() => setConfirmRemove(false)}
      />
    </SettingsGroup>
  )
}

function PasswordSection() {
  const currentId = useId()
  const nextId = useId()
  const confirmId = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const mismatch = confirm !== '' && confirm !== next

  const save = async () => {
    setSaving(true)
    try {
      await changePassword(current, next)
      toast.success('Password changed')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (e) {
      toast.error(errorText(e, 'Failed to change password'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsGroup
      title="Password"
      footer={
        <Button variant="primary" loading={saving} disabled={!current || next.length < MIN_PASSWORD || next !== confirm} onClick={() => void save()}>
          Change password
        </Button>
      }
    >
      <SettingsRow label="Current password" htmlFor={currentId} stretch>
        <Password id={currentId} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </SettingsRow>
      <SettingsRow label="New password" hint={`At least ${MIN_PASSWORD} characters.`} htmlFor={nextId} stretch>
        <Password id={nextId} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </SettingsRow>
      <SettingsRow
        label="Confirm new password"
        hint={mismatch ? <span className="acct-error">Passwords do not match</span> : undefined}
        htmlFor={confirmId}
        stretch
      >
        <Password id={confirmId} autoComplete="new-password" aria-invalid={mismatch || undefined} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </SettingsRow>
    </SettingsGroup>
  )
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="acct">
      <TopHeader />
      <main className="set-page">
        <Link to="/" className="acct-back">All apps</Link>
        <h1 className="set-page__title">Account</h1>
        <div className="set-page__groups">
          <Profile />
          <PasswordSection />
          <SettingsGroup title="Session">
            <SettingsRow label="Sign out" hint={`Signed in as ${user?.email ?? ''}`}>
              <Button variant="danger" onClick={() => void logout().then(() => navigate('/login'))}>Sign out</Button>
            </SettingsRow>
          </SettingsGroup>
        </div>
      </main>
    </div>
  )
}
