import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Dropdown, Form, FormItem, Icons, Input, Password, Text, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { changePassword } from '@/api/auth'
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

  const accountName = user?.name || user?.email || 'Account'

  return (
    <div className="home">
      <header className="home-top">
        <Link to="/" className="home-brand">
          <img src="/banana.svg" width={22} height={22} alt="" />
          <span>Bananalytics</span>
        </Link>
        <div className="home-top__right">
          <Link className="home-docs" to="/docs">
            <Icons.IconBook size={15} />
            <span>Go to docs</span>
          </Link>
          <button className="home-iconbtn" type="button" aria-label="Help">
            <Icons.IconHelp size={17} />
          </button>
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} />, onClick: () => navigate('/account') },
              { key: 'logout', label: 'Sign out', icon: <Icons.IconLogout size={15} />, danger: true, onClick: () => logout().then(() => navigate('/login')) },
            ]}
          >
            <span className="home-user">
              <Avatar size={26}><Icons.IconUser size={14} /></Avatar>
              <Text size="sm">{accountName}</Text>
              <Icons.IconChevronDown size={14} />
            </span>
          </Dropdown>
        </div>
      </header>

      <main className="acct">
        <Link to="/" className="acct-back">
          <Icons.IconChevronLeft size={15} />
          <span>All apps</span>
        </Link>
        <h1 className="acct-title">Account</h1>

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
