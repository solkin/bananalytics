import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Spin, ToastViewport } from '@/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import UiKitPage from './pages/UiKitPage'
import AppShell, { IndexRedirect } from './next/layout/AppShell'
import OverviewPage from './next/pages/OverviewPage'
import EventsPage from './next/pages/EventsPage'
import EventDetailPage from './next/pages/EventDetailPage'
import IssuesPage from './next/pages/IssuesPage'
import IssueDetailPage from './next/pages/IssueDetailPage'
import DevicesPage from './next/pages/DevicesPage'
import MappingsPage from './next/pages/MappingsPage'
import ReleasesPage from './next/pages/ReleasesPage'
import SettingsPage from './next/pages/SettingsPage'
import PeoplePage from './next/pages/PeoplePage'
import AppsHome from './next/pages/AppsHome'
import AccountPage from './next/pages/AccountPage'
import DocsPage from './next/pages/DocsPage'
import GettingStarted from './next/pages/GettingStarted'
import LoginPage from './next/pages/LoginPage'
import RegisterPage from './next/pages/RegisterPage'

function CenteredSpin() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <CenteredSpin />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <CenteredSpin />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

/* Old bookmarks: the UI used to live under /next. */
function NextRedirect() {
  const { pathname, search } = useLocation()
  const target = pathname.replace(/^\/next/, '') || '/'
  return <Navigate to={`${target}${search}`} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/ui-kit" element={<UiKitPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      <Route path="/next/*" element={<NextRedirect />} />

      <Route path="/" element={<ProtectedRoute><AppsHome /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
      <Route path="/apps/:appId" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<IndexRedirect />} />
        <Route path="getting-started" element={<GettingStarted />} />
        <Route path="analytics/overview" element={<OverviewPage />} />
        <Route path="analytics/events" element={<EventsPage />} />
        <Route path="analytics/events/:name" element={<EventDetailPage />} />
        <Route path="analytics/devices" element={<DevicesPage />} />
        <Route path="diagnostics/issues" element={<IssuesPage />} />
        <Route path="diagnostics/issues/:issueId" element={<IssueDetailPage />} />
        <Route path="diagnostics/mappings" element={<MappingsPage />} />
        <Route path="distribution/releases" element={<ReleasesPage />} />
        <Route path="settings/general" element={<SettingsPage />} />
        <Route path="settings/people" element={<PeoplePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <ToastViewport />
    </AuthProvider>
  )
}
