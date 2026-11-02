import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Form, Input, Loading, Password, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { getInviteInfo } from '@/api/auth'
import { errorText } from '../async'
import { AuthFrame } from './AuthFrame'

const MIN_PASSWORD = 6

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
    let alive = true
    getInviteInfo(inviteToken).then(
      (info) => {
        if (!alive) return
        setInviteEmail(info.email)
        setEmail(info.email)
        setInviteState('idle')
      },
      () => {
        if (alive) setInviteState('error')
      },
    )
    return () => {
      alive = false
    }
  }, [inviteToken])

  useEffect(() => {
    if (config && !config.registration_enabled && !inviteToken) navigate('/login')
  }, [config, inviteToken, navigate])

  const submit = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) return toast.error('Enter a valid email address')
    if (password.length < MIN_PASSWORD) return toast.error(`Password must be at least ${MIN_PASSWORD} characters`)
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
    return <AuthFrame title="Checking your invitation"><Loading /></AuthFrame>
  }

  if (inviteState === 'error') {
    return (
      <AuthFrame
        title="Invalid invitation"
        subtitle="This invitation link is invalid or has expired. Ask the person who invited you to send a new one."
      >
        <p className="auth__foot"><Link to="/login">Go to sign in</Link></p>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame
      title={inviteToken ? 'Accept your invitation' : 'Create your account'}
      subtitle={inviteToken ? 'Complete registration to get access to the app.' : undefined}
    >
      <Form onSubmit={submit}>
        <Field label="Name" aside="Optional">
          <Input size="lg" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            size="lg"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            disabled={!!inviteEmail}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" help={`At least ${MIN_PASSWORD} characters.`}>
          <Password size="lg" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" error={confirm && confirm !== password ? 'Passwords do not match' : undefined}>
          <Password size="lg" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button variant="primary" size="lg" block loading={loading} type="submit">
          {inviteToken ? 'Accept invitation' : 'Sign up'}
        </Button>
      </Form>
      <p className="auth__foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthFrame>
  )
}
