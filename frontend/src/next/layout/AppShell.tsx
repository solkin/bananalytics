import { useState } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Breadcrumb, Drawer, Dropdown, Icons, cn } from '@/ui'
import type { BreadcrumbItem } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { getApp } from '@/api/apps'
import { useAsync } from '../async'
import { accentFor } from '../colors'
import { NAV, TOP, findActive } from '../nav'
import './appshell.css'

function SidebarContent({
  base,
  appName,
  initial,
  accent,
  hideApp,
  onNavigate,
}: {
  base: string
  appName: string
  initial: string
  accent: string
  hideApp?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      {!hideApp && (
        <Link to={base} className="ac-app" onClick={onNavigate}>
          <span className="ac-app__icon" style={{ background: accent }}>{initial}</span>
          <div className="ac-app__meta">
            <div className="ac-app__name">{appName}</div>
            <div className="ac-app__platform">Android</div>
          </div>
        </Link>
      )}
      <nav className="ac-nav">
        <div className="ac-nav__top">
          {TOP.map((leaf) => (
            <NavLink
              key={leaf.path}
              to={`${base}/${leaf.path}`}
              onClick={onNavigate}
              className={({ isActive }) => cn('ac-nav__solo', isActive && 'is-active')}
            >
              <span className="ac-nav__group-icon">{leaf.icon}</span>
              <span>{leaf.label}</span>
            </NavLink>
          ))}
        </div>
        {NAV.map((group) => (
          <div className="ac-nav__group" key={group.label}>
            <div className="ac-nav__group-head">
              <span className="ac-nav__group-icon">{group.icon}</span>
              <span className="ac-nav__group-label">{group.label}</span>
            </div>
            <div className="ac-nav__items">
              {group.items.map((leaf) => (
                <NavLink
                  key={leaf.path}
                  to={`${base}/${leaf.path}`}
                  onClick={onNavigate}
                  className={({ isActive }) => cn('ac-nav__item', isActive && 'is-active')}
                >
                  {leaf.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  )
}

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { appId } = useParams()
  const { user, logout } = useAuth()
  const [detail, setDetail] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  const appState = useAsync(() => getApp(appId!), [appId])
  const appName = appState.data?.name ?? '…'
  const initial = (appState.data?.name?.charAt(0) ?? '?').toUpperCase()
  const accent = accentFor(appState.data?.name ?? '?')

  const base = `/next/apps/${appId}`
  const accountName = user?.name || user?.email || 'Account'

  const rel = pathname.startsWith(base + '/') ? pathname.slice(base.length + 1) : ''
  const active = findActive(rel)

  const crumbs: BreadcrumbItem[] = [
    { label: accountName },
    { label: appName, onClick: () => navigate(base) },
  ]
  if (active) {
    if (active.group) crumbs.push({ label: active.group })
    crumbs.push(
      detail
        ? { label: active.leaf.label, onClick: () => navigate(`${base}/${active.leaf.path}`) }
        : { label: active.leaf.label },
    )
  }
  if (detail) crumbs.push({ label: detail })

  const sidebar = { base, appName, initial, accent }

  return (
    <div className="ac">
      <header className="ac-top">
        <div className="ac-top__left">
          <button className="ac-burger" type="button" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <Icons.IconMenu size={18} />
          </button>
          <Link to="/next" className="ac-brand">
            <img className="ac-brand__logo" src="/banana.svg" width={22} height={22} alt="" />
            <span className="ac-brand__name">Bananalytics</span>
          </Link>
          <span className="ac-top__sep" />
          <Breadcrumb items={crumbs} />
        </div>
        <div className="ac-top__right">
          <a className="ac-top__docs" href="#" onClick={(e) => e.preventDefault()}>
            <Icons.IconBook size={15} />
            <span>Go to docs</span>
          </a>
          <button className="ac-iconbtn" type="button" aria-label="Help">
            <Icons.IconHelp size={17} />
          </button>
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} />, onClick: () => navigate('/next/account') },
              { key: 'logout', label: 'Sign out', icon: <Icons.IconLogout size={15} />, danger: true, onClick: () => logout().then(() => navigate('/login')) },
            ]}
          >
            <span className="ac-user">
              <Avatar size={26}>
                <Icons.IconUser size={14} />
              </Avatar>
              <Icons.IconChevronDown size={14} />
            </span>
          </Dropdown>
        </div>
      </header>

      <div className="ac-body">
        <aside className="ac-side">
          <SidebarContent {...sidebar} />
        </aside>
        <main className="ac-main">
          <Outlet context={{ setDetail }} />
        </main>
      </div>

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} placement="left" width={264} title={appName}>
        <div className="ac-drawer-nav">
          <SidebarContent {...sidebar} hideApp onNavigate={() => setNavOpen(false)} />
        </div>
      </Drawer>
    </div>
  )
}
