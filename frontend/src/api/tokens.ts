import api from './client'

/** Each level includes the ones before it. */
export type TokenAccess = 'read' | 'write' | 'manage'

export interface AccessToken {
  id: string
  name: string
  /** Space-separated: `mcp:read`, plus `mcp:write` when changes are allowed, plus `mcp:manage` for full access. */
  scope: string
  token_prefix: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface CreatedAccessToken {
  token: AccessToken
  /** The only readable copy of the token. */
  access_token: string
}

export async function getAccessTokens(): Promise<AccessToken[]> {
  const response = await api.get<AccessToken[]>('/tokens')
  return response.data
}

export async function createAccessToken(
  name: string,
  access: TokenAccess,
  expiresInDays: number | null,
): Promise<CreatedAccessToken> {
  const response = await api.post<CreatedAccessToken>('/tokens', {
    name,
    access,
    expires_in_days: expiresInDays,
  })
  return response.data
}

export async function revokeAccessToken(id: string): Promise<void> {
  await api.post(`/tokens/${id}/revoke`)
}

export async function deleteAccessToken(id: string): Promise<void> {
  await api.delete(`/tokens/${id}`)
}
