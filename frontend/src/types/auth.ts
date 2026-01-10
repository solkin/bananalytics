export interface User {
  id: string
  email: string
  name: string | null
  created_at: string
}

export interface AuthResponse {
  user: User
}

export interface ConfigResponse {
  registration_enabled: boolean
}

export interface AppAccess {
  id: string
  app_id: string
  user_id: string
  user_email: string
  user_name: string | null
  role: 'admin' | 'viewer'
  created_at: string
}
