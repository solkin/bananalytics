import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
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
