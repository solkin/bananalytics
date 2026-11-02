import { useLayoutEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Button, Drawer, EmptyState, IconButton, Icons, Loading, type Command } from '@/ui'
import type { App } from '@/types'
import { getApp } from '@/api/apps'
import { getMyRole } from '@/api/auth'
import { getCrashGroups } from '@/api/crashes'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '../async'
import { useRegisterCommands } from '../commands'
import { canOpen, navForRole, startPath } from '../nav'
import { Sidebar } from './Sidebar'
import './appshell.css'

export interface ShellContext {
  role: string | null
  app: App | null
  /** Refetches the app so the sidebar follows a rename or a new icon. */
  reloadApp: () => void
  /** Refetches the open issue count after a status change. */
  reloadIssueCount: () => void
}

export function useShell() {
  return useOutletContext<ShellContext>()
}

/** The same window the Issues list opens on, so the two numbers agree. */
const ISSUE_COUNT_DAYS = 28

/* Lands on the right start page for the viewer's role. */
export function IndexRedirect() {
  const { role } = useShell()
  return <Navigate to={startPath(role)} replace />
}

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { appId } = useParams()
  const { logout } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const appState = useAsync(() => Promise.all([getApp(appId!), getMyRole(appId!)]), [appId])
  const app = appState.data?.[0] ?? null
  const role = appState.data?.[1] ?? null
  const canSeeIssues = role != null && role !== 'tester'
  const issueCount = useAsync(
    () => (canSeeIssues ? getCrashGroups(appId!, { status: 'open', days: ISSUE_COUNT_DAYS, page: 1, pageSize: 1 }) : Promise.resolve(null)),
    [appId, canSeeIssues],
  )

  const base = `/apps/${appId}`
  const rel = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : ''

  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [rel.split('/').slice(0, 2).join('/')])

  useRegisterCommands((): Command[] => [
    ...navForRole(role).flatMap((group) =>
      group.items.map((leaf) => ({
        id: `go-${leaf.path}`,
        group: 'Go to',
        label: leaf.label,
        keys: leaf.keys,
        icon: leaf.icon,
        run: () => navigate(`${base}/${leaf.path}`),
      })),
    ),
    { id: 'switch-app', group: 'General', label: 'Switch app', icon: <Icons.IconReleases size={15} />, run: () => navigate('/') },
    { id: 'docs', group: 'General', label: 'Open documentation', icon: <Icons.IconHelp size={15} />, run: () => navigate('/docs') },
    { id: 'account', group: 'General', label: 'Account', icon: <Icons.IconPeople size={15} />, run: () => navigate('/account') },
    {
      id: 'sign-out',
      group: 'General',
      label: 'Sign out',
      icon: <Icons.IconLogout size={15} />,
      run: () => void logout().then(() => navigate('/login')),
    },
  ], [role, base, navigate, logout])

  const sidebar = { base, app, role, openIssues: issueCount.data?.total }

  return (
    <div className="shell">
      <aside className="shell__side">
        <Sidebar {...sidebar} />
      </aside>
      <div className="shell__bar">
        <IconButton aria-label="Open navigation" onClick={() => setNavOpen(true)}>
          <Icons.IconMenu size={16} />
        </IconButton>
        <span className="shell__bar-title">{app?.name}</span>
      </div>
      <main className="shell__main" ref={mainRef}>
        {appState.loading ? (
          <Loading />
        ) : appState.error ? (
          <EmptyState title="Couldn't load this app" description={appState.error}>
            <Button onClick={appState.reload}>Retry</Button>
          </EmptyState>
        ) : rel && !canOpen(role, rel) ? (
          <Navigate to={`${base}/${startPath(role)}`} replace />
        ) : (
          <Outlet context={{ role, app, reloadApp: appState.reload, reloadIssueCount: issueCount.reload } satisfies ShellContext} />
        )}
      </main>
      <Drawer open={navOpen} onClose={() => setNavOpen(false)} label="Navigation">
        <Sidebar {...sidebar} onNavigate={() => setNavOpen(false)} />
      </Drawer>
    </div>
  )
}
