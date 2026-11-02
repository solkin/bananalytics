import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Button,
  ConfirmDialog,
  DataList,
  DetailPanel,
  Dialog,
  Field,
  Form,
  Input,
  Notice,
  PageHeader,
  Properties,
  RadioCards,
  SplitView,
  Status,
  toast,
  type DataListColumn,
} from '@/ui'
import type { ApiKey, ApiKeyScope } from '@/types'
import { createApiKey, deleteApiKey, getApiKeys, renameApiKey, revokeApiKey } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { useRegisterCommands } from '../commands'
import { fmtDateTime, relTime } from '../format'
import { KeyReveal } from '../KeyReveal'
import './settings.css'

const SCOPE_LABEL: Record<ApiKeyScope, string> = { sdk: 'SDK', upload: 'CI upload' }
const NAME_LIMIT = 100
const CREATE_FORM = 'create-key'

/** Creates a key and shows it the only time it can be read. Callers that make
 *  sense for one kind of key only pass `scope`, which hides the choice. */
export function CreateKeyDialog({
  appId,
  defaultName = '',
  scope: fixedScope,
  onClose,
  onCreated,
}: {
  appId: string
  defaultName?: string
  scope?: ApiKeyScope
  onClose: () => void
  onCreated?: (key: string) => void
}) {
  const [name, setName] = useState(defaultName)
  const [scope, setScope] = useState<ApiKeyScope>(fixedScope ?? 'sdk')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a key name')
    setCreating(true)
    try {
      const result = await createApiKey(appId, name.trim(), scope)
      setCreated(result.api_key)
      onCreated?.(result.api_key)
    } catch (e) {
      toast.error(errorText(e, 'Failed to create API key'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open
      onClose={creating ? undefined : onClose}
      title={created ? 'Copy this key now' : 'Create API key'}
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={creating}>Cancel</Button>
            <Button variant="primary" loading={creating} type="submit" form={CREATE_FORM}>Create key</Button>
          </>
        )
      }
    >
      {created ? (
        <div className="set-reveal">
          <p className="set-muted">It is stored hashed and will never be shown again. If you lose it, create a new key.</p>
          <KeyReveal value={created} />
          <p className="set-muted set-caption">
            {scope === 'upload'
              ? 'Pass it as the X-API-Key header when publishing a release from CI.'
              : 'Put it into BananalyticsConfig.apiKey in your app.'}
          </p>
        </div>
      ) : (
        <Form id={CREATE_FORM} onSubmit={submit}>
          <Field label="Key name" required help="Name it after where it is used: CI, production build, staging.">
            <Input placeholder="Production build" value={name} maxLength={NAME_LIMIT} onChange={(e) => setName(e.target.value)} />
          </Field>
          {fixedScope == null && (
            <Field label="Used for">
              <RadioCards
                value={scope}
                onChange={(value) => setScope(value as ApiKeyScope)}
                options={[
                  { label: SCOPE_LABEL.sdk, hint: 'Submits crashes and events. Goes into the app.', value: 'sdk' },
                  { label: SCOPE_LABEL.upload, hint: 'Publishes releases. Keep it in your CI secrets.', value: 'upload' },
                ]}
              />
            </Field>
          )}
        </Form>
      )}
    </Dialog>
  )
}

function KeyPanel({
  appId,
  apiKey,
  onClose,
  onChanged,
}: {
  appId: string
  apiKey: ApiKey
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState(apiKey.name)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const revoked = apiKey.revoked_at != null

  const save = async () => {
    if (!name.trim()) return toast.error('Enter a key name')
    setSaving(true)
    try {
      await renameApiKey(appId, apiKey.id, name.trim())
      toast.success('Key renamed')
      onChanged()
    } catch (e) {
      toast.error(errorText(e, 'Failed to rename key'))
    } finally {
      setSaving(false)
    }
  }

  const act = async () => {
    setWorking(true)
    try {
      if (revoked) {
        await deleteApiKey(appId, apiKey.id)
        toast.success('Key deleted')
        onClose()
      } else {
        await revokeApiKey(appId, apiKey.id)
        toast.success('Key revoked')
      }
      setConfirming(false)
      onChanged()
    } catch (e) {
      toast.error(errorText(e, revoked ? 'Failed to delete key' : 'Failed to revoke key'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <DetailPanel
      label="Key details"
      title={apiKey.name}
      onClose={onClose}
      actions={<Button variant="primary" loading={saving} disabled={!name.trim() || name.trim() === apiKey.name} onClick={() => void save()}>Save changes</Button>}
    >
      <div className="set-panel">
        <Field label="Key name">
          <Input value={name} maxLength={NAME_LIMIT} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Properties
          items={[
            { label: 'Key', value: <code className="bnn-mono">{apiKey.key_prefix}…</code> },
            { label: 'Used for', value: SCOPE_LABEL[apiKey.scope] },
            { label: 'Status', value: revoked ? <Status tone="danger">Revoked</Status> : <Status tone="positive">Active</Status> },
            { label: 'Created', value: fmtDateTime(apiKey.created_at) },
            { label: 'Created by', value: apiKey.created_by ?? '—' },
            { label: 'Last used', value: apiKey.last_used_at ? relTime(apiKey.last_used_at) : 'Never' },
            ...(apiKey.revoked_at ? [{ label: 'Revoked', value: fmtDateTime(apiKey.revoked_at) }] : []),
          ]}
        />
        <div className="set-danger">
          <div className="set-danger__text">
            <div className="set-strong">{revoked ? 'Delete this key' : 'Revoke this key'}</div>
            <div className="set-muted set-caption">
              {revoked
                ? 'Removes the key and its usage history from the list.'
                : apiKey.scope === 'upload'
                  ? 'Publishing releases with this key stops working immediately.'
                  : 'Apps using this key stop submitting data immediately.'}
            </div>
          </div>
          <Button variant="danger" onClick={() => setConfirming(true)}>{revoked ? 'Delete' : 'Revoke'}</Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={revoked ? 'Delete this key?' : `Revoke ${apiKey.name}?`}
        description={
          revoked
            ? 'This removes the record permanently.'
            : apiKey.scope === 'upload'
              ? 'Any CI job still using this key will start failing with 401.'
              : 'Any SDK still using this key will start failing with 401.'
        }
        confirmLabel={revoked ? 'Delete' : 'Revoke'}
        loading={working}
        onConfirm={() => void act()}
        onClose={() => setConfirming(false)}
      />
    </DetailPanel>
  )
}

const COLUMNS: DataListColumn<ApiKey>[] = [
  {
    key: 'name',
    title: 'Name',
    render: (r) => (
      <span className="set-two-lines">
        <span className="set-two-lines__main">
          <span className={r.revoked_at ? 'set-truncate set-strong set-muted' : 'set-truncate set-strong'}>{r.name}</span>
          {r.revoked_at && <Status tone="danger" className="set-caption">Revoked</Status>}
        </span>
        <code className="set-two-lines__sub bnn-mono">{r.key_prefix}…</code>
      </span>
    ),
  },
  { key: 'scope', title: 'Used for', width: 96, render: (r) => SCOPE_LABEL[r.scope] },
  { key: 'last_used', title: 'Last used', width: 128, align: 'right', optional: true, render: (r) => <span className="set-faint">{r.last_used_at ? relTime(r.last_used_at) : 'Never'}</span> },
]

export default function ApiKeysPage() {
  const { appId } = useParams()
  const state = useAsync(() => getApiKeys(appId!), [appId], { key: `api-keys:${appId}` })
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const keys = state.data ?? []
  const selected = keys.find((k) => k.id === selectedId) ?? null
  /* Ingestion is what breaks without a key, and only SDK keys do ingestion. */
  const sdkKeys = keys.filter((k) => k.scope === 'sdk')
  const noActiveKeys = state.data != null && sdkKeys.every((k) => k.revoked_at != null)

  useRegisterCommands(
    () => [{ id: 'key-new', group: 'API keys', label: 'Create API key', keys: ['C'], run: () => setCreateOpen(true) }],
    [],
  )

  return (
    <>
      <SplitView
        detailWidth={420}
        list={
          <section aria-label="API keys">
            <PageHeader title="API keys" className="set-header">
              <Button variant="primary" onClick={() => setCreateOpen(true)}>Create API key</Button>
            </PageHeader>
            <p className="set-intro">Create a separate key per build or integration, so you can revoke one without touching the others.</p>
            {noActiveKeys && (
              <Notice
                className="set-notice"
                tone="warning"
                title={sdkKeys.length === 0 ? 'This app has no SDK API keys.' : 'This app has no active SDK API keys.'}
              >
                Crashes and events are rejected until you create one.
              </Notice>
            )}
            <Loaded state={state} emptyText="No API keys yet">
              {(rows) => (
                <DataList
                  label="API keys"
                  columns={COLUMNS}
                  data={rows}
                  rowKey={(r) => r.id}
                  selectedKey={selectedId}
                  onRowClick={(r) => setSelectedId(r.id)}
                />
              )}
            </Loaded>
          </section>
        }
        detail={
          selected ? (
            <KeyPanel key={selected.id} appId={appId!} apiKey={selected} onClose={() => setSelectedId(null)} onChanged={state.reload} />
          ) : undefined
        }
      />
      {createOpen && <CreateKeyDialog appId={appId!} onClose={() => setCreateOpen(false)} onCreated={state.reload} />}
    </>
  )
}
