import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Form, FormItem, Icons, Input, Modal, Tag, Text, Title, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { createApp, getApps } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { AppIcon } from '../AppIcon'
import { UserAvatar } from '../UserAvatar'
import { KeyReveal } from './ApiKeysPage'
import { AppTopBar } from '../layout/AppTopBar'
import './appshome.css'

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i

function CreateAppModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pkg, setPkg] = useState('')
  const [creating, setCreating] = useState(false)
  /* Once the app exists the dialog stops being a form and becomes the one and
     only chance to read the default key the create response carried. */
  const [created, setCreated] = useState<{ id: string; apiKey: string | null } | null>(null)
  const pkgInvalid = pkg.trim() !== '' && !PACKAGE_RE.test(pkg.trim())

  const create = async () => {
    if (!name.trim()) return toast.error('Enter an app name')
    if (!PACKAGE_RE.test(pkg.trim())) return toast.error('Enter a valid package name, e.g. com.example.app')
    setCreating(true)
    try {
      const app = await createApp(name.trim(), pkg.trim())
      toast.success('App created')
      setCreated({ id: app.id, apiKey: app.api_key ?? null })
    } catch (e) {
      toast.error(errorText(e, 'Failed to create app'))
    } finally {
      setCreating(false)
    }
  }

  /* Leaving the dialog always lands on the setup guide, and hands the key over
     so the snippet there is ready to copy. */
  const done = () => {
    if (!created) return onClose()
    onClose()
    navigate(`/apps/${created.id}/getting-started`, { state: { apiKey: created.apiKey } })
  }

  return (
    <Modal
      open
      onClose={creating ? undefined : done}
      title={created ? 'App created' : 'Add new app'}
      width={480}
      footer={
        created ? (
          <Button variant="primary" onClick={done}>Continue to setup</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={creating}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={create}>Add new app</Button>
          </>
        )
      }
    >
      {created ? (
        <div className="set-keys__reveal">
          <Alert
            type="warning"
            message="Copy this API key now"
            description="It is stored hashed and will never be shown again. If you lose it, create a new key under Settings → API keys."
          />
          {created.apiKey ? (
            <KeyReveal value={created.apiKey} />
          ) : (
            <Text type="tertiary" size="sm">
              No key came back with the app — create one under Settings → API keys.
            </Text>
          )}
          <Text type="tertiary" size="sm">
            Put it into <span className="bnn-mono">BananalyticsConfig.apiKey</span> in your app.
          </Text>
        </div>
      ) : (
        <Form>
          <FormItem label="App name" required>
            <Input placeholder="My Android App" value={name} onChange={(e) => setName(e.target.value)} />
          </FormItem>
          <FormItem
            label="Package name"
            required
            error={pkgInvalid ? 'Lowercase segments separated by dots, e.g. com.example.app' : undefined}
            help={pkgInvalid ? undefined : 'Immutable after creation — must match the applicationId of your app.'}
          >
            <Input placeholder="com.example.app" status={pkgInvalid ? 'error' : undefined} value={pkg} onChange={(e) => setPkg(e.target.value)} />
          </FormItem>
          <FormItem label="Platform">
            <Input value="Android" disabled />
          </FormItem>
        </Form>
      )}
    </Modal>
  )
}

export default function AppsHome() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const state = useAsync(() => getApps(), [])
  const accountName = user?.name || user?.email || 'Account'

  return (
    <div className="home">
      <AppTopBar />

      <main className="home-main">
        <div className="home-head">
          <Title level={2}>Apps</Title>
          <div className="home-head__actions">
            <span className="home-search">
              <Input
                prefix={<Icons.IconSearch size={15} />}
                placeholder="Search apps"
                allowClear
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
              />
            </span>
            <Button variant="primary" icon={<Icons.IconPlus size={15} />} onClick={() => setCreateOpen(true)}>
              Add new app
            </Button>
          </div>
        </div>

        <Loaded state={state} emptyText="No apps yet — create your first app">
          {(apps) => {
            const list = apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
            return (
              <>
                <div className="home-owner">
                  <UserAvatar size={22} name={accountName} avatarUrl={user?.avatar_url} />
                  <Text strong>{accountName}</Text>
                  <Text type="tertiary" size="sm">{list.length} {list.length === 1 ? 'app' : 'apps'}</Text>
                </div>
                <div className="home-grid">
                  {list.map((a) => (
                    /* Kit card for the chrome, link for the whole hit area. */
                    <Card key={a.id} hoverable padded={false}>
                      <Link to={`/apps/${a.id}`} className="home-card">
                        <AppIcon name={a.name} iconUrl={a.icon_url} />
                        <div className="home-card__meta">
                          <div className="home-card__name">{a.name}</div>
                          <div className="home-card__sub">
                            <Tag tone="neutral">Android</Tag>
                            <Text type="tertiary" size="sm">{a.package_name}</Text>
                          </div>
                        </div>
                        <Icons.IconChevronRight size={16} className="home-card__arrow" />
                      </Link>
                    </Card>
                  ))}
                </div>
              </>
            )
          }}
        </Loaded>
      </main>

      {createOpen && <CreateAppModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
