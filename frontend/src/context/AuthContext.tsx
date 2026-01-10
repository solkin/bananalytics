import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User, ConfigResponse } from '@/types/auth'
import { getCurrentUser, login as apiLogin, logout as apiLogout, register as apiRegister, getConfig } from '@/api/auth'

interface AuthContextType {
  user: User | null
  config: ConfigResponse | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [userData, configData] = await Promise.all([
        getCurrentUser().catch(() => null),
        getConfig(),
      ])
      setUser(userData)
      setConfig(configData)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const userData = await apiLogin(email, password)
    setUser(userData)
  }

  const register = async (email: string, password: string, name?: string) => {
    const userData = await apiRegister(email, password, name)
    setUser(userData)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, config, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
