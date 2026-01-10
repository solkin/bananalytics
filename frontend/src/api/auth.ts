import api from './client'
import type { AuthResponse, ConfigResponse, User, AppAccess } from '@/types/auth'

export async function getConfig(): Promise<ConfigResponse> {
  const response = await api.get<ConfigResponse>('/auth/config')
  return response.data
}

export async function register(email: string, password: string, name?: string): Promise<User> {
  const response = await api.post<AuthResponse>('/auth/register', { email, password, name })
  return response.data.user
}

export async function login(email: string, password: string): Promise<User> {
  const response = await api.post<AuthResponse>('/auth/login', { email, password })
  return response.data.user
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<AuthResponse>('/auth/me')
  return response.data.user
}

// App access
export async function getAppAccess(appId: string): Promise<AppAccess[]> {
  const response = await api.get<AppAccess[]>(`/apps/${appId}/access`)
  return response.data
}

export async function grantAccess(appId: string, email: string, role: string): Promise<AppAccess> {
  const response = await api.post<AppAccess>(`/apps/${appId}/access`, { email, role })
  return response.data
}

export async function updateAccess(appId: string, userId: string, role: string): Promise<void> {
  await api.put(`/apps/${appId}/access/${userId}`, { role })
}

export async function revokeAccess(appId: string, userId: string): Promise<void> {
  await api.delete(`/apps/${appId}/access/${userId}`)
}
