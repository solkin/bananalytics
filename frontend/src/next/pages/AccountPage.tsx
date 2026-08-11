import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Form, FormItem, Icons, Input, Password, Text, Title, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { changePassword } from '@/api/auth'
import { AppTopBar } from '../layout/AppTopBar'
import './appshome.css'
import './account.css'

function errMsg(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  return m || fallback
}

export default function AccountPage() {
  const { user, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [conf, setConf] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const saveName = async () => {
    setSavingName(true)
    try {
      await updateProfile(name.trim())
      toast.success('Profile updated')
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update profile'))
    } finally {
      setSavingName(false)
    }
  }

  const savePw = async () => {
    if (nw.length < 6) return toast.error('Password must be at least 6 characters')
    if (nw !== conf) return toast.error('Passwords do not match')
    setSavingPw(true)
    try {
      await changePassword(cur, nw)
      toast.success('Password changed')
      setCur(''); setNw(''); setConf('')
    } catch (e) {
      toast.error(errMsg(e, 'Failed to change password'))
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="home">
      <AppTopBar />

      <main className="acct">
        <Link to="/" className="acct-back">
          <Icons.IconChevronLeft size={15} />
          <span>All apps</span>
        </Link>
        <Title level={2}>Account</Title>

        <Card title="Profile">
          <Form>
            <FormItem label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </FormItem>
            <FormItem label="Email" help="Email can't be changed.">
              <Input value={user?.email ?? ''} disabled />
            </FormItem>
            <div><Button variant="primary" loading={savingName} onClick={saveName}>Save profile</Button></div>
          </Form>
        </Card>

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
            <div><Button variant="primary" loading={savingPw} onClick={savePw}>Change password</Button></div>
          </Form>
        </Card>

        <Card title="Session">
          <div className="acct-signout">
            <Text type="secondary">Signed in as {user?.email}</Text>
            <Button variant="danger" icon={<Icons.IconLogout size={15} />} onClick={() => logout().then(() => navigate('/login'))}>Sign out</Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
