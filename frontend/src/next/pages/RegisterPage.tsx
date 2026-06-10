import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Form, FormItem, Icons, Input, Password, Spin, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { getInviteInfo } from '@/api/auth'
import { errorText } from '../async'
import './auth.css'

function AuthFrame({ sub, children }: { sub?: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <img className="auth-head__logo" src="/banana.svg" alt="" />
          <div className="auth-head__name">Bananalytics</div>
          {sub && <div className="auth-head__sub">{sub}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const { register, config } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [inviteEmail, setInviteEmail] = useState<string | null>(null)
  const [inviteState, setInviteState] = useState<'idle' | 'loading' | 'error'>(inviteToken ? 'loading' : 'idle')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!inviteToken) return
    getInviteInfo(inviteToken)
      .then((info) => {
        setInviteEmail(info.email)
        setEmail(info.email)
        setInviteState('idle')
      })
      .catch(() => setInviteState('error'))
  }, [inviteToken])

  useEffect(() => {
    if (config && !config.registration_enabled && !inviteToken) navigate('/login')
  }, [config, inviteToken, navigate])

  const submit = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) return toast.error('Enter a valid email address')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    if (password !== confirm) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      await register(email.trim(), password, name.trim() || undefined, inviteToken || undefined)
      toast.success('Welcome to Bananalytics!')
      navigate('/')
    } catch (e) {
      toast.error(errorText(e, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  if (inviteState === 'loading') {
    return (
      <AuthFrame>
        <Spin tip="Checking invitation…" />
      </AuthFrame>
    )
  }

  if (inviteState === 'error') {
    return (
      <AuthFrame>
        <Alert
          type="error"
          message="Invalid invitation"
          description="This invitation link is invalid or has expired. Ask the person who invited you to send a new one."
        />
        <div className="auth-foot">
          <Link to="/login">Go to sign in</Link>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame sub={inviteToken ? 'Accept your invitation' : 'Create your account'}>
      {inviteToken && (
        <Alert
          type="success"
          message="You've been invited!"
          description="Complete registration to accept the invitation and get access to the project."
        />
      )}
      <Card>
        <Form className="auth-form" onSubmit={submit}>
          <FormItem label="Name" help="Optional">
            <Input
              autoComplete="name"
              placeholder="Your name"
              prefix={<Icons.IconUser size={15} />}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormItem>
          <FormItem label="Email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              prefix={<Icons.IconMail size={15} />}
              value={email}
              disabled={!!inviteEmail}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormItem>
          <FormItem label="Password" help="At least 6 characters.">
            <Password
              autoComplete="new-password"
              placeholder="••••••••"
              prefix={<Icons.IconLock size={15} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormItem>
          <FormItem label="Confirm password" error={confirm && confirm !== password ? 'Passwords do not match' : undefined}>
            <Password
              autoComplete="new-password"
              placeholder="••••••••"
              prefix={<Icons.IconLock size={15} />}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormItem>
          <Button variant="primary" size="lg" block loading={loading} type="submit">
            {inviteToken ? 'Accept invitation' : 'Sign up'}
          </Button>
        </Form>
      </Card>
      <div className="auth-foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthFrame>
  )
}
