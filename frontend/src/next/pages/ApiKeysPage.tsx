import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  FormItem,
  Icons,
  Input,
  Modal,
  Popconfirm,
  Table,
  Tag,
  Text,
  toast,
  type Column,
} from '@/ui'
import type { ApiKey } from '@/types'
import { createApiKey, deleteApiKey, getApiKeys, renameApiKey, revokeApiKey } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { fmtDateTime, relTime } from '../format'
import './pages.css'

/* The one moment a key value is visible — right after it is created. */
export function KeyReveal({ value }: { value: string }) {
  return (
    <div className="pg-apikey">
      <Input value={value} readOnly prefix={<Icons.IconLock size={15} />} />
      <Button
        icon={<Icons.IconCopy size={15} />}
        onClick={() => {
          navigator.clipboard?.writeText(value)
          toast.success('Copied to clipboard')
        }}
      >
        Copy
      </Button>
    </div>
  )
}

export function CreateKeyModal({
  appId,
  defaultName = '',
  onClose,
  onCreated,
}: {
  appId: string
  defaultName?: string
  onClose: () => void
  onCreated?: (key: string) => void
}) {
  const [name, setName] = useState(defaultName)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a key name')
    setCreating(true)
    try {
      const result = await createApiKey(appId, name.trim())
      setCreated(result.api_key)
      onCreated?.(result.api_key)
    } catch (e) {
      toast.error(errorText(e, 'Failed to create API key'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open
      onClose={creating ? undefined : onClose}
      title={created ? 'API key created' : 'Create API key'}
      width={520}
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={creating}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={submit}>Create key</Button>
          </>
        )
      }
    >
      {created ? (
        <div className="set-keys__reveal">
          <Alert
            type="warning"
            message="Copy this key now"
            description="It is stored hashed and will never be shown again. If you lose it, create a new key."
          />
          <KeyReveal value={created} />
          <Text type="tertiary" size="sm">
            Put it into <span className="bnn-mono">BananalyticsConfig.apiKey</span> in your app.
          </Text>
        </div>
      ) : (
        <Form>
          <FormItem label="Key name" required help="Name it after where it is used — CI, production build, staging.">
            <Input
              placeholder="Production build"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </FormItem>
        </Form>
      )}
    </Modal>
  )
}

function KeyModal({
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
  const [working, setWorking] = useState<'save' | 'revoke' | 'delete' | null>(null)
  const revoked = apiKey.revoked_at != null

  const save = async () => {
    if (!name.trim()) return toast.error('Enter a key name')
    setWorking('save')
    try {
      await renameApiKey(appId, apiKey.id, name.trim())
      toast.success('Key renamed')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(errorText(e, 'Failed to rename key'))
    } finally {
      setWorking(null)
    }
  }

  const revoke = async () => {
    setWorking('revoke')
    try {
      await revokeApiKey(appId, apiKey.id)
      toast.success('Key revoked')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(errorText(e, 'Failed to revoke key'))
    } finally {
      setWorking(null)
    }
  }

  const remove = async () => {
    setWorking('delete')
    try {
      await deleteApiKey(appId, apiKey.id)
      toast.success('Key deleted')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(errorText(e, 'Failed to delete key'))
    } finally {
      setWorking(null)
    }
  }

  return (
    <Modal
      open
      onClose={working ? undefined : onClose}
      title="API key"
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={working != null}>Close</Button>
          <Button
            variant="primary"
            loading={working === 'save'}
            disabled={name.trim() === apiKey.name || working != null}
            onClick={save}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="set-keys__detail">
        <FormItem label="Key name">
          <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </FormItem>

        <Descriptions
          column={1}
          size="sm"
          items={[
            { label: 'Key', value: <span className="bnn-mono">{apiKey.key_prefix}…</span> },
            { label: 'Status', value: revoked ? <Tag tone="danger">Revoked</Tag> : <Tag tone="success">Active</Tag> },
            { label: 'Created', value: fmtDateTime(apiKey.created_at) },
            { label: 'Created by', value: apiKey.created_by ?? '—' },
            { label: 'Last used', value: apiKey.last_used_at ? relTime(apiKey.last_used_at) : 'Never' },
            ...(revoked ? [{ label: 'Revoked', value: fmtDateTime(apiKey.revoked_at!) }] : []),
          ]}
        />

        <Divider>Danger zone</Divider>
        <div className="pg-danger__row">
          <div>
            <Text strong>{revoked ? 'Delete this key' : 'Revoke this key'}</Text>
            <div>
              <Text type="tertiary" size="sm">
                {revoked
                  ? 'Removes the key and its usage history from the list.'
                  : 'Apps using this key stop submitting data immediately. The key stays listed as revoked.'}
              </Text>
            </div>
          </div>
          {revoked ? (
            <Popconfirm
              title="Delete this key?"
              description="This removes the record permanently."
              okText="Delete"
              okDanger
              onConfirm={remove}
            >
              <Button variant="danger" icon={<Icons.IconTrash size={14} />} loading={working === 'delete'}>
                Delete
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={`Revoke ${apiKey.name}?`}
              description="Any SDK still using this key will start failing with 401."
              okText="Revoke"
              okDanger
              onConfirm={revoke}
            >
              <Button variant="danger" icon={<Icons.IconLock size={14} />} loading={working === 'revoke'}>
                Revoke
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function ApiKeysPage() {
  const { appId } = useParams()
  const state = useAsync(() => getApiKeys(appId!), [appId])
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<ApiKey | null>(null)

  const keys = state.data ?? []
  const noActiveKeys = state.data != null && keys.every((k) => k.revoked_at != null)

  const columns: Column<ApiKey>[] = [
    {
      key: 'name', title: 'Name',
      render: (r) => (
        <div>
          <div className="set-keys__name">
            {r.name}
            {r.revoked_at && <Tag tone="danger">Revoked</Tag>}
          </div>
          <Text type="tertiary" size="sm"><span className="bnn-mono">{r.key_prefix}…</span></Text>
        </div>
      ),
    },
    {
      key: 'created_by', title: 'Created by', width: 180,
      render: (r) => <Text type="secondary">{r.created_by ?? '—'}</Text>,
    },
    {
      key: 'last_used', title: 'Last used', width: 160,
      render: (r) => <Text type="secondary">{r.last_used_at ? relTime(r.last_used_at) : 'Never'}</Text>,
    },
    {
      key: 'created', title: 'Created', width: 160, align: 'right',
      render: (r) => <Text type="secondary">{fmtDateTime(r.created_at)}</Text>,
    },
  ]

  return (
    <div className="pg">
      <div className="pg-toolbar">
        <Button variant="primary" icon={<Icons.IconPlus size={15} />} onClick={() => setCreateOpen(true)}>
          Create API key
        </Button>
      </div>

      {noActiveKeys && (
        <Alert
          type="warning"
          message={keys.length === 0 ? 'This app has no API keys' : 'This app has no active API keys'}
          description="The SDK authenticates with the X-API-Key header, so crashes and events are rejected until you create one."
        />
      )}

      <Card
        title="API keys"
        subtitle="Used by the SDK to submit crashes and events. Create a separate key per build or integration so you can revoke one without touching the others."
        padded={false}
      >
        <Loaded state={state} emptyText="No API keys yet">
          {(rows) => (
            <Table<ApiKey>
              columns={columns}
              data={rows}
              rowKey={(r) => r.id}
              emptyText="No API keys yet"
              onRowClick={setSelected}
            />
          )}
        </Loaded>
      </Card>

      {createOpen && (
        <CreateKeyModal
          appId={appId!}
          onClose={() => setCreateOpen(false)}
          onCreated={state.reload}
        />
      )}
      {selected && (
        <KeyModal
          key={selected.id}
          appId={appId!}
          apiKey={selected}
          onClose={() => setSelected(null)}
          onChanged={state.reload}
        />
      )}
    </div>
  )
}
