import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Form, FormItem, Icons, Input, Password, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { errorText } from '../async'
import { AuthFrame } from './AuthFrame'

export default function LoginPage() {
  const { login, config } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.trim() || !password) return toast.error('Enter your email and password')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (e) {
      toast.error(errorText(e, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame sub="Sign in to your account">
      <Card>
        <Form className="auth-form" onSubmit={submit}>
          <FormItem label="Email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              prefix={<Icons.IconMail size={15} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormItem>
          <FormItem label="Password">
            <Password
              autoComplete="current-password"
              placeholder="••••••••"
              prefix={<Icons.IconLock size={15} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormItem>
          <Button variant="primary" size="lg" block loading={loading} type="submit">
            Sign in
          </Button>
        </Form>
      </Card>
      {config?.registration_enabled && (
        <div className="auth-foot">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      )}
    </AuthFrame>
  )
}
