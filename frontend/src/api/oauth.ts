import api from './client'

/** The authorization query an agent sent the browser here with, forwarded as is. */
export type AuthorizationRequest = Record<string, string>

export interface AuthorizationPrompt {
  client_name: string
  client_id: string
  /** The client is identified by a metadata document on its own domain. */
  verified: boolean
  redirect_host: string
  requests_write: boolean
}

export interface AuthorizationCheck {
  prompt?: AuthorizationPrompt
  /** The request is unusable; the client expects the browser back with the error. */
  redirect_to?: string
}

export interface OAuthGrant {
  id: string
  client_name: string
  client_id: string
  verified: boolean
  scope: string
  last_used_at: string | null
  created_at: string
}

export async function checkAuthorization(request: AuthorizationRequest): Promise<AuthorizationCheck> {
  const response = await api.post<AuthorizationCheck>('/oauth/authorize/check', request)
  return response.data
}

/** Records the decision; the returned URL hands the outcome back to the client. */
export async function decideAuthorization(
  request: AuthorizationRequest,
  approve: boolean,
  allowWrite: boolean,
): Promise<string> {
  const response = await api.post<{ redirect_to: string }>('/oauth/authorize', {
    request,
    approve,
    allow_write: allowWrite,
  })
  return response.data.redirect_to
}

export async function getOAuthGrants(): Promise<OAuthGrant[]> {
  const response = await api.get<OAuthGrant[]>('/oauth/grants')
  return response.data
}

export async function deleteOAuthGrant(id: string): Promise<void> {
  await api.delete(`/oauth/grants/${id}`)
}
