import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Button, Dropdown, Form, FormItem, Icons, Input, Modal, Tag, Text, Title, toast } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { createApp, getApps } from '@/api/apps'
import { useAsync, Loaded, errorText } from '../async'
import { accentFor } from '../colors'
import { Brand } from '../layout/Brand'
import './appshome.css'

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i

function CreateAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pkg, setPkg] = useState('')
  const [creating, setCreating] = useState(false)
  const pkgInvalid = pkg.trim() !== '' && !PACKAGE_RE.test(pkg.trim())

  const create = async () => {
    if (!name.trim()) return toast.error('Enter an app name')
    if (!PACKAGE_RE.test(pkg.trim())) return toast.error('Enter a valid package name, e.g. com.example.app')
    setCreating(true)
    try {
      const app = await createApp(name.trim(), pkg.trim())
      toast.success('App created')
      onClose()
      // The default key comes back exactly once — hand it to Getting Started
      // so the setup snippet is ready to copy.
      navigate(`/apps/${app.id}/getting-started`, { state: { apiKey: app.api_key } })
    } catch (e) {
      toast.error(errorText(e, 'Failed to create app'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add new app" width={480} okText="Add new app" onOk={create} confirmLoading={creating}>
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
    </Modal>
  )
}

export default function AppsHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const state = useAsync(() => getApps(), [])
  const accountName = user?.name || user?.email || 'Account'

  return (
    <div className="home">
      <header className="home-top">
        <Brand />
        <div className="home-top__right">
          <Link className="home-docs" to="/docs">
            <Icons.IconBook size={15} />
            <span>Go to docs</span>
          </Link>
          <button className="home-iconbtn" type="button" aria-label="Help">
            <Icons.IconHelp size={17} />
          </button>
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} />, onClick: () => navigate('/account') },
              { key: 'logout', label: 'Sign out', icon: <Icons.IconLogout size={15} />, danger: true, onClick: () => void logout() },
            ]}
          >
            <span className="home-user">
              <Avatar size={26}>
                <Icons.IconUser size={14} />
              </Avatar>
              <Text size="sm">{accountName}</Text>
              <Icons.IconChevronDown size={14} />
            </span>
          </Dropdown>
        </div>
      </header>

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
                  <Avatar size={22}>
                    <Icons.IconUser size={12} />
                  </Avatar>
                  <Text strong>{accountName}</Text>
                  <Text type="tertiary" size="sm">{list.length} {list.length === 1 ? 'app' : 'apps'}</Text>
                </div>
                <div className="home-grid">
                  {list.map((a) => (
                    <Link key={a.id} to={`/apps/${a.id}`} className="home-card">
                      <span className="home-card__icon" style={{ background: accentFor(a.name) }}>
                        {a.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="home-card__meta">
                        <div className="home-card__name">{a.name}</div>
                        <div className="home-card__sub">
                          <Tag tone="success">Android</Tag>
                          <Text type="tertiary" size="sm">{a.package_name}</Text>
                        </div>
                      </div>
                      <Icons.IconChevronRight size={16} className="home-card__arrow" />
                    </Link>
                  ))}
                </div>
              </>
            )
          }}
        </Loaded>
      </main>

      <CreateAppModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
