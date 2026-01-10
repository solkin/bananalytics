import api from './client'
import type { Crash, CrashGroup, PaginatedResponse } from '@/types'

export async function getCrashGroups(
  appId: string,
  options?: { status?: string; page?: number; pageSize?: number }
): Promise<PaginatedResponse<CrashGroup>> {
  const response = await api.get<PaginatedResponse<CrashGroup>>(`/apps/${appId}/crashes`, {
    params: options,
  })
  return response.data
}

export async function getCrashGroup(id: string): Promise<CrashGroup> {
  const response = await api.get<CrashGroup>(`/crash-groups/${id}`)
  return response.data
}

export async function updateCrashGroupStatus(
  id: string,
  status: 'open' | 'resolved' | 'ignored'
): Promise<CrashGroup> {
  const response = await api.put<CrashGroup>(`/crash-groups/${id}`, { status })
  return response.data
}

export async function getCrashesInGroup(
  groupId: string,
  options?: { page?: number; pageSize?: number }
): Promise<PaginatedResponse<Crash>> {
  const response = await api.get<PaginatedResponse<Crash>>(`/crash-groups/${groupId}/crashes`, {
    params: options,
  })
  return response.data
}

export async function getCrash(id: string): Promise<Crash> {
  const response = await api.get<Crash>(`/crashes/${id}`)
  return response.data
}

export async function retraceCrash(id: string): Promise<Crash> {
  const response = await api.post<Crash>(`/crashes/${id}/retrace`)
  return response.data
}
