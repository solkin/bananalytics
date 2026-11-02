import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Loading, ToastViewport } from '@/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CommandsProvider } from './app/commands'
import AppShell, { IndexRedirect } from './app/layout/AppShell'
import AppsHome from './app/pages/AppsHome'
import LoginPage from './app/pages/LoginPage'
import NotFoundPage from './app/pages/NotFoundPage'
import RegisterPage from './app/pages/RegisterPage'
import UiKitPage from './app/pages/UiKitPage'
import { redirectTarget } from './app/redirect'

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
      <Route path="/apps/:appId" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<IndexRedirect />} />
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
