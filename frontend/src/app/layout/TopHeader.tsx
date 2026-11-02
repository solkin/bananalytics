import { Link, useLocation } from 'react-router-dom'
import { Avatar } from '@/ui'
import { useAuth } from '@/context/AuthContext'
import { Brand } from './Brand'
import './topheader.css'

/** The header of the pages outside an app: the list of apps, docs, account. */
export function TopHeader() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const accountName = user?.name || user?.email || ''
  return (
    <header className="top-header">
      <Link to="/" className="top-header__brand"><Brand /></Link>
      <span className="top-header__links">
        {pathname !== '/docs' && <Link to="/docs" className="top-header__link">Docs</Link>}
        {pathname !== '/account' && (
          <Link to="/account" className="top-header__link" aria-label={`Account, ${accountName}`}>
            <Avatar name={accountName} src={user?.avatar_url} />
            <span className="top-header__account">{accountName}</span>
          </Link>
        )}
      </span>
    </header>
  )
}
