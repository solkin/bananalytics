import api from './client'
import type { Crash, CrashGroup, PaginatedResponse } from '@/types'

export interface VersionInfo {
  version_code: number
  version_name: string | null
}

export async function getCrashGroups(
  appId: string,
  options?: { status?: string; version?: number; page?: number; pageSize?: number }
): Promise<PaginatedResponse<CrashGroup>> {
  const response = await api.get<PaginatedResponse<CrashGroup>>(`/apps/${appId}/crashes`, {
    params: options,
  })
  return response.data
}

export async function getCrashVersions(appId: string): Promise<VersionInfo[]> {
  const response = await api.get<VersionInfo[]>(`/apps/${appId}/crashes/versions`)
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

export interface DailyStat {
  date: string
  count: number
}

export async function getCrashStats(
  groupId: string,
  options?: { from?: string; to?: string }
): Promise<DailyStat[]> {
  const response = await api.get<DailyStat[]>(`/crash-groups/${groupId}/stats`, {
    params: options,
  })
  return response.data
}

export async function getAppCrashStats(
  appId: string,
  options?: { from?: string; to?: string }
): Promise<DailyStat[]> {
  const response = await api.get<DailyStat[]>(`/apps/${appId}/crashes/stats`, {
    params: options,
  })
  return response.data
}
