import api from './client'
import type { Event, PaginatedResponse } from '@/types'
import type { DailyStat, VersionInfo } from './crashes'

export type { DailyStat, VersionInfo }

export interface EventSummary {
  name: string
  total: number
  this_month: number
  today: number
}

export interface EventVersionStats {
  version_code: number
  version_name: string | null
  count: number
}

export async function getEventSummary(
  appId: string,
  versionCode?: number
): Promise<EventSummary[]> {
  const response = await api.get<EventSummary[]>(`/apps/${appId}/events/summary`, {
    params: versionCode ? { version: versionCode } : undefined,
  })
  return response.data
}

export async function getEventVersions(appId: string): Promise<VersionInfo[]> {
  const response = await api.get<VersionInfo[]>(`/apps/${appId}/events/versions`)
  return response.data
}

export async function getEventsByName(
  appId: string,
  eventName: string,
  options?: {
    version?: number
    page?: number
    pageSize?: number
  }
): Promise<PaginatedResponse<Event>> {
  const response = await api.get<PaginatedResponse<Event>>(
    `/apps/${appId}/events/by-name/${encodeURIComponent(eventName)}`,
    { params: options }
  )
  return response.data
}

export async function getEventVersionStats(
  appId: string,
  eventName: string
): Promise<EventVersionStats[]> {
  const response = await api.get<EventVersionStats[]>(
    `/apps/${appId}/events/by-name/${encodeURIComponent(eventName)}/versions`
  )
  return response.data
}

export async function getEvents(
  appId: string,
  options?: {
    name?: string
    version?: number
    from?: string
    to?: string
    page?: number
    pageSize?: number
  }
): Promise<PaginatedResponse<Event>> {
  const response = await api.get<PaginatedResponse<Event>>(`/apps/${appId}/events`, {
    params: options,
  })
  return response.data
}

export async function getEventNames(appId: string): Promise<string[]> {
  const response = await api.get<string[]>(`/apps/${appId}/events/names`)
  return response.data
}

export async function getEventCount(appId: string): Promise<number> {
  const response = await api.get<{ count: number }>(`/apps/${appId}/events/count`)
  return response.data.count
}

export async function getEventStats(
  appId: string,
  eventName: string,
  options?: { from?: string; to?: string }
): Promise<DailyStat[]> {
  const response = await api.get<DailyStat[]>(
    `/apps/${appId}/events/by-name/${encodeURIComponent(eventName)}/stats`,
    { params: options }
  )
  return response.data
}
