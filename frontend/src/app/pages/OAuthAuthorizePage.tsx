import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Checkbox, Loading, Notice } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import {
  checkAuthorization,
  decideAuthorization,
  type AuthorizationPrompt,
  type AuthorizationRequest,
} from '@/api/oauth'
import { errorText } from '../async'
import { BRAND_NAME } from '../layout/Brand'
import { AuthFrame } from './AuthFrame'

/** The parameters of an OAuth authorization request; anything else in the URL is ignored. */
const REQUEST_KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'resource',
]

type Stage =
  | { kind: 'checking' }
  | { kind: 'prompt'; prompt: AuthorizationPrompt }
  | { kind: 'invalid'; message: string }
  | { kind: 'returned'; clientName: string | null }

/**
 * Where an agent sends the browser to get access to the signed-in person's
 * data. The backend validates the request; this page only asks the person.
 */
export default function OAuthAuthorizePage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const request = useMemo<AuthorizationRequest>(() => {
    const picked: AuthorizationRequest = {}
    for (const key of REQUEST_KEYS) {
      const value = params.get(key)
      if (value !== null) picked[key] = value
    }
    return picked
  }, [params])

  const [stage, setStage] = useState<Stage>({ kind: 'checking' })
  const [allowWrite, setAllowWrite] = useState(false)
  const [deciding, setDeciding] = useState<'allow' | 'deny' | null>(null)

  /* Leaving for a custom scheme (a desktop app) keeps this tab open, so say what happened. */
  const handBack = (url: string, clientName: string | null) => {
    setStage({ kind: 'returned', clientName })
    window.location.assign(url)
  }

  useEffect(() => {
    let alive = true
    checkAuthorization(request)
      .then((check) => {
        if (!alive) return
        if (check.redirect_to) handBack(check.redirect_to, null)
        else if (check.prompt) setStage({ kind: 'prompt', prompt: check.prompt })
      })
      .catch((e) => alive && setStage({ kind: 'invalid', message: errorText(e, 'The request could not be read') }))
    return () => {
      alive = false
    }
  }, [request])

  const decide = async (approve: boolean, prompt: AuthorizationPrompt) => {
    setDeciding(approve ? 'allow' : 'deny')
    try {
      handBack(await decideAuthorization(request, approve, allowWrite), prompt.client_name)
    } catch (e) {
      setDeciding(null)
      setStage({ kind: 'invalid', message: errorText(e, 'The request could not be completed') })
    }
  }

  if (stage.kind === 'checking') return <Loading />

  if (stage.kind === 'invalid') {
    return (
      <AuthFrame title="Can't connect this app" subtitle="The link that brought you here is not a valid request.">
        <Notice tone="error">{stage.message}</Notice>
        <p className="auth__foot">Start the connection again from the app that sent you here.</p>
      </AuthFrame>
    )
  }

  if (stage.kind === 'returned') {
    return (
      <AuthFrame
        title={stage.clientName ? `Returning to ${stage.clientName}` : 'Returning to the app'}
        subtitle="You can close this page once the app has opened."
      />
    )
  }

  const { prompt } = stage
  return (
    <AuthFrame
      title={`Connect ${prompt.client_name}`}
      subtitle={`It is asking for access to your ${BRAND_NAME} account.`}
    >
      <div className="consent">
        <ul className="consent__list">
          <li>Read crashes, analytics and releases of the apps you can open</li>
          <li>Act with your current role in each app, never more</li>
        </ul>
        {prompt.requests_write && (
          <Checkbox checked={allowWrite} onChange={setAllowWrite}>
            Also allow changes: resolve or ignore issues, mute versions
          </Checkbox>
        )}
        {prompt.verified ? (
          <p className="consent__meta">
            Identified by <strong>{hostOf(prompt.client_id)}</strong>. You will return to{' '}
            <strong>{prompt.redirect_host}</strong>.
          </p>
        ) : (
          <Notice tone="warning" title="Unverified app.">
            It registered itself and will receive access at <strong>{prompt.redirect_host}</strong>. Continue only if
            you started this connection.
          </Notice>
        )}
        <div className="consent__actions">
          <Button
            variant="primary"
            size="lg"
            block
            loading={deciding === 'allow'}
            disabled={deciding !== null}
            onClick={() => decide(true, prompt)}
          >
            Allow access
          </Button>
          <Button size="lg" block loading={deciding === 'deny'} disabled={deciding !== null} onClick={() => decide(false, prompt)}>
            Cancel
          </Button>
        </div>
        {user && <p className="auth__foot">Signed in as {user.email}</p>}
      </div>
    </AuthFrame>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
