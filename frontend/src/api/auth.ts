import api from './client'
import type { AuthResponse, ConfigResponse, User, AppAccess, CheckEmailResponse } from '@/types/auth'

export async function getConfig(): Promise<ConfigResponse> {
  const response = await api.get<ConfigResponse>('/auth/config')
  return response.data
}

export async function checkEmail(email: string): Promise<CheckEmailResponse> {
  const response = await api.post<CheckEmailResponse>('/auth/check-email', { email })
  return response.data
}

export async function getInviteInfo(token: string): Promise<{ email: string }> {
  const response = await api.get<{ email: string }>(`/auth/invite/${token}`)
  return response.data
}

export async function register(
  email: string,
  password: string,
  name?: string,
  inviteToken?: string
): Promise<User> {
  const response = await api.post<AuthResponse>('/auth/register', {
    email,
    password,
    name,
    invite_token: inviteToken,
  })
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

export async function updateAccess(appId: string, accessId: string, role: string): Promise<void> {
  await api.put(`/apps/${appId}/access/${accessId}`, { role })
}

export async function revokeAccess(appId: string, accessId: string): Promise<void> {
  await api.delete(`/apps/${appId}/access/${accessId}`)
}

export async function getMyRole(appId: string): Promise<string> {
  const response = await api.get<{ role: string }>(`/apps/${appId}/my-role`)
  return response.data.role
}

export async function getInvitationLink(appId: string, invitationId: string): Promise<string> {
  const response = await api.get<{ url: string }>(`/apps/${appId}/access/${invitationId}/link`)
  return response.data.url
}

export async function resendInvitation(appId: string, invitationId: string): Promise<void> {
  await api.post(`/apps/${appId}/access/${invitationId}/resend`)
}
