import api from './client'
import type { Event, PaginatedResponse } from '@/types'

export async function getEvents(
  appId: string,
  options?: {
    name?: string
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
