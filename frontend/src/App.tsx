import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastViewport } from '@/ui'
import { AuthProvider } from './context/AuthContext'
import UiKitPage from './pages/UiKitPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/ui-kit" element={<UiKitPage />} />
        <Route path="*" element={<Navigate to="/ui-kit" replace />} />
      </Routes>
      <ToastViewport />
    </AuthProvider>
  )
}
