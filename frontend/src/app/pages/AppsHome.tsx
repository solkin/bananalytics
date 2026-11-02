import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Dialog, EmptyState, Field, Form, Icons, Input, Notice, toast } from '@/ui'
import { createApp, getApps } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { AppIcon } from '../AppIcon'
import { KeyReveal } from '../KeyReveal'
import { TopHeader } from '../layout/TopHeader'
import './appshome.css'

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i
const CREATE_FORM_ID = 'create-app'

function CreateAppDialog({ onClose }: { onClose: () => void }) {
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
      setCreated({ id: app.id, apiKey: app.api_key ?? null })
    } catch (e) {
      toast.error(errorText(e, 'Failed to create app'))
    } finally {
      setCreating(false)
    }
  }

  /* Leaving the dialog lands on the setup guide and hands the key over, so the
     snippet there is ready to copy. */
  const done = () => {
    onClose()
    if (created) navigate(`/apps/${created.id}/getting-started`, { state: { apiKey: created.apiKey } })
  }

  return (
    <Dialog
      open
      onClose={creating ? undefined : done}
      title={created ? 'App created' : 'Add new app'}
      footer={
        created ? (
          <Button variant="primary" onClick={done}>Continue to setup</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={creating}>Cancel</Button>
            <Button variant="primary" loading={creating} type="submit" form={CREATE_FORM_ID}>Add new app</Button>
          </>
        )
      }
    >
      {created ? (
        created.apiKey ? (
          <div className="apps-reveal">
            <p className="apps-reveal__text">Copy this API key now. It is stored hashed and will never be shown again.</p>
            <KeyReveal value={created.apiKey} />
          </div>
        ) : (
          <Notice tone="warning">No key came back with the app. Create one under Settings, API keys.</Notice>
        )
      ) : (
        <Form id={CREATE_FORM_ID} onSubmit={create}>
          <Field label="App name" required>
            <Input placeholder="My Android App" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Package name"
            required
            error={pkgInvalid ? 'Lowercase segments separated by dots, e.g. com.example.app' : undefined}
            help="Immutable after creation. Must match the applicationId of your app."
          >
            <Input placeholder="com.example.app" value={pkg} onChange={(e) => setPkg(e.target.value)} />
          </Field>
        </Form>
      )}
    </Dialog>
  )
}

export default function AppsHome() {
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const state = useAsync(() => getApps(), [])
  const addButton = (
    <Button variant="primary" onClick={() => setCreateOpen(true)}>Add new app</Button>
  )

  return (
    <div className="apps">
      <TopHeader />
      <main className="apps__main">
        <div className="apps__head">
          <h1 className="apps__title">Apps</h1>
          <span className="apps__search">
            <Input
              size="sm"
              aria-label="Search apps"
              placeholder="Search apps"
              allowClear
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
            />
          </span>
          {addButton}
        </div>
        <Loaded state={state} empty={<EmptyState title="No apps yet" description="Add your first app to start collecting crashes and events.">{addButton}</EmptyState>}>
          {(apps) => {
            const list = apps.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()))
            return (
              <ul className="apps__list">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link to={`/apps/${a.id}`} className="apps__row">
                      <AppIcon name={a.name} iconUrl={a.icon_url} size={32} />
                      <span className="apps__meta">
                        <span className="apps__name">{a.name}</span>
                        <span className="apps__package bnn-mono">{a.package_name}</span>
                      </span>
                      <span className="apps__platform">Android</span>
                      <Icons.IconChevronRight size={12} className="apps__arrow" />
                    </Link>
                  </li>
                ))}
                {list.length === 0 && <li><EmptyState title="No apps match this search" /></li>}
              </ul>
            )
          }}
        </Loaded>
      </main>
      {createOpen && <CreateAppDialog onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
