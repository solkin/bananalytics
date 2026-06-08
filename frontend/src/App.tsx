import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import UiKitPage from './pages/UiKitPage'
import AppShell from './next/layout/AppShell'
import OverviewPage from './next/pages/OverviewPage'
import NextEvents from './next/pages/EventsPage'
import NextEventDetail from './next/pages/EventDetailPage'
import NextIssues from './next/pages/IssuesPage'
import NextIssueDetail from './next/pages/IssueDetailPage'
import NextDevices from './next/pages/DevicesPage'
import NextMappings from './next/pages/MappingsPage'
import NextReleases from './next/pages/ReleasesPage'
import NextSettings from './next/pages/SettingsPage'
import NextPeople from './next/pages/PeoplePage'
import AppsHome from './next/pages/AppsHome'
import GettingStarted from './next/pages/GettingStarted'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppsPage from './pages/AppsPage'
import AppDetailPage from './pages/AppDetailPage'
import CrashesPage from './pages/CrashesPage'
import CrashDetailPage from './pages/CrashDetailPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import VersionsPage from './pages/VersionsPage'
import DistributionPage from './pages/DistributionPage'
import DevicesPage from './pages/DevicesPage'
import AccessPage from './pages/AccessPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/ui-kit" element={<UiKitPage />} />

      {/* New App Center–style UI (mocks, built alongside the old site) */}
      <Route path="/next" element={<ProtectedRoute><AppsHome /></ProtectedRoute>} />
      <Route path="/next/apps/:appId" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="analytics/overview" replace />} />
        <Route path="getting-started" element={<GettingStarted />} />
        <Route path="analytics/overview" element={<OverviewPage />} />
        <Route path="analytics/events" element={<NextEvents />} />
        <Route path="analytics/events/:name" element={<NextEventDetail />} />
        <Route path="analytics/devices" element={<NextDevices />} />
        <Route path="diagnostics/issues" element={<NextIssues />} />
        <Route path="diagnostics/issues/:issueId" element={<NextIssueDetail />} />
        <Route path="diagnostics/mappings" element={<NextMappings />} />
        <Route path="distribution/releases" element={<NextReleases />} />
        <Route path="settings/general" element={<NextSettings />} />
        <Route path="settings/people" element={<NextPeople />} />
      </Route>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<AppsPage />} />
        <Route path="apps/:appId" element={<AppDetailPage />}>
          <Route index element={<Navigate to="crashes" replace />} />
          <Route path="crashes" element={<CrashesPage />} />
          <Route path="crashes/:groupId" element={<CrashDetailPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:eventName" element={<EventDetailPage />} />
          <Route path="versions" element={<VersionsPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="distribution" element={<DistributionPage />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
