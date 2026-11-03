import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Loading, ToastViewport } from '@/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CommandsProvider } from './app/commands'
import AppShell, { IndexRedirect, useShell } from './app/layout/AppShell'
import AccountPage from './app/pages/AccountPage'
import ApiKeysPage from './app/pages/ApiKeysPage'
import AppsHome from './app/pages/AppsHome'
import DevicesPage from './app/pages/DevicesPage'
import DocsPage from './app/pages/DocsPage'
import EventDetailPage from './app/pages/EventDetailPage'
import EventsPage from './app/pages/EventsPage'
import GettingStarted from './app/pages/GettingStarted'
import InstallPage from './app/pages/InstallPage'
import IssueDetailPage from './app/pages/IssueDetailPage'
import IssuesPage from './app/pages/IssuesPage'
import LoginPage from './app/pages/LoginPage'
import MappingsPage from './app/pages/MappingsPage'
import NotFoundPage from './app/pages/NotFoundPage'
import OAuthAuthorizePage from './app/pages/OAuthAuthorizePage'
import OverviewPage from './app/pages/OverviewPage'
import PeoplePage from './app/pages/PeoplePage'
import RegisterPage from './app/pages/RegisterPage'
import ReleaseDetailPage from './app/pages/ReleaseDetailPage'
import ReleasesPage from './app/pages/ReleasesPage'
import SettingsPage from './app/pages/SettingsPage'
import UiKitPage from './app/pages/UiKitPage'
import { redirectTarget } from './app/redirect'

function ReleasesRoute() {
  const { role } = useShell()
  return role === 'tester' ? <InstallPage /> : <ReleasesPage />
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  /* Links from email land here logged out; remember where they were headed. */
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (user) return <Navigate to={redirectTarget(location)} replace />
  return <>{children}</>
}

function AppRoutes() {
  const { pathname, hash } = useLocation()
  const navigation = useNavigationType()
  const { loading } = useAuth()
  const previousRoute = useRef<{ pathname: string; hash: string } | null>(null)
  useLayoutEffect(() => {
    if (loading) return
    const previous = previousRoute.current
    previousRoute.current = { pathname, hash }
    if (previous?.pathname === pathname && previous.hash === hash) return
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else if (navigation !== 'POP') window.scrollTo(0, 0)
  }, [pathname, hash, navigation, loading])
  return (
    <Routes>
      <Route path="/ui-kit" element={<UiKitPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><AppsHome /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
      <Route path="/oauth/authorize" element={<ProtectedRoute><OAuthAuthorizePage /></ProtectedRoute>} />
      <Route path="/apps/:appId" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<IndexRedirect />} />
        <Route path="getting-started" element={<GettingStarted />} />
        <Route path="analytics/overview" element={<OverviewPage />} />
        <Route path="analytics/events" element={<EventsPage />} />
        <Route path="analytics/events/:name" element={<EventDetailPage />} />
        <Route path="analytics/devices" element={<DevicesPage />} />
        <Route path="diagnostics/issues" element={<IssuesPage />}>
          <Route path=":issueId" element={<IssueDetailPage />} />
        </Route>
        <Route path="diagnostics/mappings" element={<MappingsPage />} />
        <Route path="distribution/releases" element={<ReleasesRoute />}>
          <Route path=":versionId" element={<ReleaseDetailPage />} />
        </Route>
        <Route path="settings/general" element={<SettingsPage />} />
        <Route path="settings/api-keys" element={<ApiKeysPage />} />
        <Route path="settings/people" element={<PeoplePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CommandsProvider>
        <AppRoutes />
      </CommandsProvider>
      <ToastViewport />
    </AuthProvider>
  )
}
