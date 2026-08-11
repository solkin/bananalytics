export interface User {
  id: string
  email: string
  name: string | null
  /** `null` until an avatar is uploaded — see `@/next/UserAvatar`. */
  avatar_url: string | null
  created_at: string
}

export interface AuthResponse {
  user: User
}

export interface ConfigResponse {
  registration_enabled: boolean
  smtp_configured: boolean
}

export interface CheckEmailResponse {
  exists: boolean
  smtp_configured: boolean
}

export interface AppAccess {
  id: string
  app_id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  user_avatar_url: string | null
  role: 'admin' | 'viewer' | 'tester'
  status: 'active' | 'invited'
  created_at: string
}
