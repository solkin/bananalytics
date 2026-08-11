import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Dropdown, Icons, TopBar } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { UserAvatar } from '../UserAvatar'
import { Brand } from './Brand'

/** The application header, identical on every page: brand, whatever context
 *  the page adds after it, and the account menu. */
export function AppTopBar({
  leading,
  children,
}: {
  /** Rendered before the brand — the mobile menu button on the app shell. */
  leading?: ReactNode
  /** Page context after the brand, e.g. the breadcrumb. */
  children?: ReactNode
}) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const onDocs = useLocation().pathname.startsWith('/docs')

  return (
    <TopBar
      left={
        <>
          {leading}
          <Brand />
          {children}
        </>
      }
      right={
        <>
          {/* No point offering the docs while you are reading them. */}
          {!onDocs && (
            <Link className="bnn-topbar__link" to="/docs">
              <Icons.IconBook size={15} />
              <span>Go to docs</span>
            </Link>
          )}
          <Dropdown
            items={[
              { key: 'profile', label: 'Profile', icon: <Icons.IconUser size={15} />, onClick: () => navigate('/account') },
              {
                key: 'logout',
                label: 'Sign out',
                icon: <Icons.IconLogout size={15} />,
                danger: true,
                onClick: () => void logout().then(() => navigate('/login')),
              },
            ]}
          >
            <span className="bnn-topbar__user">
              <UserAvatar size={26} name={user?.name || user?.email || '?'} avatarUrl={user?.avatar_url} />
              <Icons.IconChevronDown size={14} />
            </span>
          </Dropdown>
        </>
      }
    />
  )
}
