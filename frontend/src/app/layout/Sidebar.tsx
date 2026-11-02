import { Link, NavLink } from 'react-router-dom'
import { Avatar, Icons, Kbd, cn } from '@/ui'
import type { App } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { AppIcon } from '../AppIcon'
import { useCommandPalette } from '../commands'
import { navForRole } from '../nav'
import { shortcutLabel } from '../shortcut'
import './sidebar.css'

const APP_NAME_PLACEHOLDER = '…'
const ISSUES_PATH = 'diagnostics/issues'

export function Sidebar({
  base,
  app,
  role,
  openIssues,
  onNavigate,
}: {
  base: string
  app: App | null
  role: string | null
  openIssues?: number
  onNavigate?: () => void
}) {
  const { user } = useAuth()
  const openPalette = useCommandPalette()
  const accountName = user?.name || user?.email || ''

  return (
    <div className="sidebar">
      <Link to="/" className="sidebar__app" onClick={onNavigate} aria-label={`Switch app, current app ${app?.name ?? ''}`}>
        <AppIcon name={app?.name ?? APP_NAME_PLACEHOLDER} iconUrl={app?.icon_url} />
        <span className="sidebar__name">{app?.name ?? APP_NAME_PLACEHOLDER}</span>
        <Icons.IconChevronDown size={12} className="sidebar__chevron" />
      </Link>

      <button
        type="button"
        className="sidebar__search"
        onClick={() => {
          onNavigate?.()
          openPalette()
        }}
      >
        <Icons.IconSearch size={14} />
        <span className="sidebar__name">Search or command</span>
        <Kbd>{shortcutLabel()}</Kbd>
      </button>

      <nav className="sidebar__nav" aria-label="Application">
        {navForRole(role).map((group) => (
          <div className="sidebar__group" key={group.label ?? 'top'}>
            {group.label && <div className="sidebar__group-label">{group.label}</div>}
            {group.items.map((leaf) => (
              <NavLink
                key={leaf.path}
                to={`${base}/${leaf.path}`}
                onClick={onNavigate}
                className={({ isActive }) => cn('sidebar__link', isActive && 'is-active')}
              >
                {leaf.icon}
                <span className="sidebar__name">{leaf.label}</span>
                {leaf.path === ISSUES_PATH && openIssues != null && openIssues > 0 && (
                  <span className="sidebar__count" aria-label={`${openIssues} open`}>{openIssues}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        <Link to="/account" className="sidebar__account" onClick={onNavigate} aria-label={`Account, ${accountName}`}>
          <Avatar name={accountName} src={user?.avatar_url} />
          <span className="sidebar__name">{accountName}</span>
        </Link>
        <Link to="/docs" className="sidebar__docs" onClick={onNavigate} aria-label="Documentation">
          <Icons.IconHelp size={15} />
        </Link>
      </div>
    </div>
  )
}
