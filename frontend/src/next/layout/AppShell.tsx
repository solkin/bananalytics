import { useState } from 'react'
import { Navigate, Outlet, NavLink, Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Breadcrumb, Drawer, IconButton, Icons, Spin, TopBarSeparator, cn } from '@/ui'
import type { BreadcrumbItem } from '@/ui'
import type { App } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { getApp } from '@/api/apps'
import { getMyRole } from '@/api/auth'
import { useAsync } from '../async'
import { AppIcon } from '../AppIcon'
import { findActive, navForRole, type NavGroup, type NavLeaf } from '../nav'
import { AppTopBar } from './AppTopBar'
import './appshell.css'

export interface ShellContext {
  setDetail: (label: string | null) => void
  role: string | null
  app: App | null
  /** Refetches the app so the sidebar follows a rename or a new icon. */
  reloadApp: () => void
}

/* Lands on the right start page for the viewer's role. */
export function IndexRedirect() {
  const { role } = useOutletContext<ShellContext>()
  if (!role) return <Spin tip="Loading…" />
  return <Navigate to={role === 'tester' ? 'distribution/releases' : 'analytics/overview'} replace />
}

function SidebarContent({
  base,
  appName,
  iconUrl,
  top,
  groups,
  hideApp,
  onNavigate,
}: {
  base: string
  appName: string
  iconUrl: string | null
  top: NavLeaf[]
  groups: NavGroup[]
  hideApp?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      {!hideApp && (
        <Link to={base} className="ac-app" onClick={onNavigate}>
          <AppIcon name={appName} iconUrl={iconUrl} size="sm" />
          <div className="ac-app__meta">
            <div className="ac-app__name">{appName}</div>
            <div className="ac-app__platform">Android</div>
          </div>
        </Link>
      )}
      <nav className="ac-nav">
        <div className="ac-nav__top">
          {top.map((leaf) => (
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
        {groups.map((group) => (
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
  const { user } = useAuth()
  const [detail, setDetail] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  const appState = useAsync(
    () => Promise.all([getApp(appId!), getMyRole(appId!).catch(() => 'viewer')]),
    [appId],
  )
  const app = appState.data?.[0] ?? null
  const role = appState.data?.[1] ?? null
  const appName = app?.name ?? '…'
  const { top, groups } = navForRole(role)

  const base = `/apps/${appId}`
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

  const sidebar = { base, appName, iconUrl: app?.icon_url ?? null, top, groups }

  return (
    <div className="ac">
      <AppTopBar
        leading={
          <IconButton className="ac-burger" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <Icons.IconMenu size={18} />
          </IconButton>
        }
      >
        <span className="ac-crumbs">
          <TopBarSeparator />
          <Breadcrumb items={crumbs} truncate />
        </span>
      </AppTopBar>

      <div className="ac-body">
        <aside className="ac-side">
          <SidebarContent {...sidebar} />
        </aside>
        <main className="ac-main">
          <Outlet context={{ setDetail, role, app, reloadApp: appState.reload } satisfies ShellContext} />
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
