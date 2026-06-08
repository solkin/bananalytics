import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Button, Dropdown, Icons, Input, Tag, Text, Title } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { getApps } from '@/api/apps'
import { useAsync, Loaded } from '../async'
import { accentFor } from '../colors'
import './appshome.css'

export default function AppsHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const state = useAsync(() => getApps(), [])
  const accountName = user?.name || user?.email || 'Account'

  return (
    <div className="home">
      <header className="home-top">
        <Link to="/next" className="home-brand">
          <img src="/banana.svg" width={22} height={22} alt="" />
          <span>Bananalytics</span>
        </Link>
        <div className="home-top__right">
          <Link className="home-docs" to="/next/docs">
            <Icons.IconBook size={15} />
            <span>Go to docs</span>
          </Link>
          <button className="home-iconbtn" type="button" aria-label="Help">
            <Icons.IconHelp size={17} />
          </button>
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} />, onClick: () => navigate('/next/account') },
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
            <Button variant="primary" icon={<Icons.IconPlus size={15} />}>Add new app</Button>
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
                    <Link key={a.id} to={`/next/apps/${a.id}`} className="home-card">
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
    </div>
  )
}
