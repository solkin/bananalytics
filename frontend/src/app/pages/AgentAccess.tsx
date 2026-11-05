import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Form,
  Input,
  RadioCards,
  Select,
  SettingsGroup,
  SettingsRow,
  Status,
  toast,
} from '@/ui'
import {
  createAccessToken,
  deleteAccessToken,
  getAccessTokens,
  revokeAccessToken,
  type AccessToken,
  type TokenAccess,
} from '@/api/tokens'
import { deleteOAuthGrant, getOAuthGrants, type OAuthGrant } from '@/api/oauth'
import { Loaded, errorText, useAsync } from '../async'
import { fullDate, hostOf, relTime } from '../format'
import { KeyReveal } from '../KeyReveal'
import { SERVER_URL } from '../server'
import { ACCESS_OPTIONS, accessLabel } from '../tokenAccess'

const NAME_LIMIT = 100
const CREATE_FORM = 'create-token'
const LIFETIMES = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'No expiration', value: 0 },
]

const lastUsed = (iso: string | null) => (iso ? `used ${relTime(iso)}` : 'never used')

function CreateTokenDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [access, setAccess] = useState<TokenAccess>('read')
  const [days, setDays] = useState(90)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a token name')
    setCreating(true)
    try {
      const result = await createAccessToken(name.trim(), access, days || null)
      setCreated(result.access_token)
      onCreated()
    } catch (e) {
      toast.error(errorText(e, 'Failed to create the token'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open
      onClose={creating ? undefined : onClose}
      title={created ? 'Copy this token now' : 'Create access token'}
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={creating}>Cancel</Button>
            <Button variant="primary" loading={creating} type="submit" form={CREATE_FORM}>Create token</Button>
          </>
        )
      }
    >
      {created ? (
        <div className="set-reveal">
          <p className="set-muted">It is stored hashed and will never be shown again. If you lose it, create a new token.</p>
          <KeyReveal value={created} />
          <p className="set-muted set-caption">
            Send it as <code className="bnn-mono">Authorization: Bearer …</code> to <code className="bnn-mono">{SERVER_URL}/mcp</code>.{' '}
            <Link to="/docs#agents">How to connect an agent</Link>
          </p>
        </div>
      ) : (
        <Form id={CREATE_FORM} onSubmit={submit}>
          <Field label="Token name" required help="Name it after the agent or machine that uses it.">
            <Input placeholder="Cursor on my laptop" value={name} maxLength={NAME_LIMIT} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Access" help="Changes need the admin role in the app.">
            <RadioCards stacked value={access} onChange={(value) => setAccess(value as TokenAccess)} options={ACCESS_OPTIONS} />
          </Field>
          <Field label="Expires after">
            <Select options={LIFETIMES} value={days} onChange={(value) => setDays(Number(value))} />
          </Field>
        </Form>
      )}
    </Dialog>
  )
}

function TokenRow({ token, onChanged }: { token: AccessToken; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const expired = token.expires_at != null && new Date(token.expires_at).getTime() <= Date.now()
  /* A token that no longer works can only be cleaned up. */
  const live = token.revoked_at == null && !expired

  const act = async () => {
    setWorking(true)
    try {
      if (live) await revokeAccessToken(token.id)
      else await deleteAccessToken(token.id)
      toast.success(live ? 'Token revoked' : 'Token deleted')
      setConfirming(false)
      onChanged()
    } catch (e) {
      toast.error(errorText(e, live ? 'Failed to revoke the token' : 'Failed to delete the token'))
    } finally {
      setWorking(false)
    }
  }

  const expiry = token.expires_at ? `expires ${fullDate(token.expires_at)}` : 'no expiration'
  return (
    <SettingsRow
      label={
        <span className="acct-token__name">
          <span className="set-truncate">{token.name}</span>
          {token.revoked_at && <Status tone="danger">Revoked</Status>}
          {!token.revoked_at && expired && <Status tone="neutral">Expired</Status>}
        </span>
      }
      hint={
        <>
          <code className="bnn-mono">{token.token_prefix}…</code> · {accessLabel(token.scope)} · {live ? expiry : lastUsed(token.last_used_at)}
          {live && <> · {lastUsed(token.last_used_at)}</>}
        </>
      }
    >
      <Button variant={live ? 'danger' : 'ghost'} onClick={() => setConfirming(true)}>{live ? 'Revoke' : 'Delete'}</Button>
      <ConfirmDialog
        open={confirming}
        title={live ? `Revoke ${token.name}?` : 'Delete this token?'}
        description={live ? 'Any agent still using it will start failing with 401.' : 'This removes the record permanently.'}
        confirmLabel={live ? 'Revoke' : 'Delete'}
        loading={working}
        onConfirm={() => void act()}
        onClose={() => setConfirming(false)}
      />
    </SettingsRow>
  )
}

/** Personal tokens for agents that take a header rather than signing in. */
export function AccessTokensSection() {
  const state = useAsync(getAccessTokens, [], { key: 'access-tokens' })
  const [createOpen, setCreateOpen] = useState(false)
  return (
    <SettingsGroup
      title="Access tokens"
      footer={<Button variant="primary" onClick={() => setCreateOpen(true)}>Create token</Button>}
    >
      <Loaded
        state={state}
        empty={<SettingsRow label="No tokens yet" hint="Agents that sign in through the browser don't need one." />}
      >
        {(rows) => rows.map((token) => <TokenRow key={token.id} token={token} onChanged={state.reload} />)}
      </Loaded>
      {createOpen && <CreateTokenDialog onClose={() => setCreateOpen(false)} onCreated={state.reload} />}
    </SettingsGroup>
  )
}

function GrantRow({ grant, onChanged }: { grant: OAuthGrant; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)

  const disconnect = async () => {
    setWorking(true)
    try {
      await deleteOAuthGrant(grant.id)
      toast.success(`${grant.client_name} disconnected`)
      setConfirming(false)
      onChanged()
    } catch (e) {
      toast.error(errorText(e, 'Failed to disconnect'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <SettingsRow
      label={grant.client_name}
      hint={`${grant.verified ? hostOf(grant.client_id) : 'Unverified'} · ${accessLabel(grant.scope)} · connected ${fullDate(grant.created_at)} · ${lastUsed(grant.last_used_at)}`}
    >
      <Button variant="danger" onClick={() => setConfirming(true)}>Disconnect</Button>
      <ConfirmDialog
        open={confirming}
        title={`Disconnect ${grant.client_name}?`}
        description="Its access ends now. To use it again, connect it from the app once more."
        confirmLabel="Disconnect"
        loading={working}
        onConfirm={() => void disconnect()}
        onClose={() => setConfirming(false)}
      />
    </SettingsRow>
  )
}

/** Agents the person let in through the OAuth consent page. */
export function ConnectedAppsSection() {
  const state = useAsync(getOAuthGrants, [], { key: 'oauth-grants' })
  return (
    <SettingsGroup title="Connected agents">
      <Loaded
        state={state}
        empty={<SettingsRow label="No connected agents" hint="An agent shows up here once you approve its sign-in." />}
      >
        {(rows) => rows.map((grant) => <GrantRow key={grant.id} grant={grant} onChanged={state.reload} />)}
      </Loaded>
    </SettingsGroup>
  )
}
