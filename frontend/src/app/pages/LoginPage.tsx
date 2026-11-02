import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Field, Form, Input, Password, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { errorText } from '../async'
import { BRAND_NAME } from '../layout/Brand'
import { redirectTarget } from '../redirect'
import { AuthFrame } from './AuthFrame'

export default function LoginPage() {
  const { login, config } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.trim() || !password) return toast.error('Enter your email and password')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate(redirectTarget(location), { replace: true })
    } catch (e) {
      toast.error(errorText(e, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame title={`Sign in to ${BRAND_NAME}`}>
      <Form onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            size="lg"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <Password
            size="lg"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button variant="primary" size="lg" block loading={loading} type="submit">
          Sign in
        </Button>
      </Form>
      {config?.registration_enabled && (
        <p className="auth__foot">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      )}
    </AuthFrame>
  )
}
