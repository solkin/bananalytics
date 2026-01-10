import api from './client'
import type { App, AppVersion } from '@/types'

export async function getApps(): Promise<App[]> {
  const response = await api.get<App[]>('/apps')
  return response.data
}

export async function getApp(id: string): Promise<App> {
  const response = await api.get<App>(`/apps/${id}`)
  return response.data
}

export async function createApp(name: string, packageName: string): Promise<App> {
  const response = await api.post<App>('/apps', {
    name,
    package_name: packageName,
  })
  return response.data
}

export async function updateApp(id: string, name: string): Promise<App> {
  const response = await api.put<App>(`/apps/${id}`, { name })
  return response.data
}

export async function deleteApp(id: string): Promise<void> {
  await api.delete(`/apps/${id}`)
}

export async function regenerateApiKey(id: string): Promise<string> {
  const response = await api.post<{ api_key: string }>(`/apps/${id}/regenerate-key`)
  return response.data.api_key
}

// Versions
export async function getVersions(appId: string): Promise<AppVersion[]> {
  const response = await api.get<AppVersion[]>(`/apps/${appId}/versions`)
  return response.data
}

export async function createVersion(
  appId: string,
  versionCode: number,
  versionName?: string,
  mappingFile?: File
): Promise<AppVersion> {
  const formData = new FormData()
  formData.append('version_code', versionCode.toString())
  if (versionName) {
    formData.append('version_name', versionName)
  }
  if (mappingFile) {
    formData.append('mapping', mappingFile)
  }

  const response = await api.post<AppVersion>(`/apps/${appId}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function uploadMapping(
  appId: string,
  versionId: string,
  mappingFile: File
): Promise<AppVersion> {
  const formData = new FormData()
  formData.append('mapping', mappingFile)

  const response = await api.put<AppVersion>(
    `/apps/${appId}/versions/${versionId}/mapping`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return response.data
}

export async function updateVersionMute(
  appId: string,
  versionId: string,
  muteCrashes?: boolean,
  muteEvents?: boolean
): Promise<AppVersion> {
  const response = await api.put<AppVersion>(
    `/apps/${appId}/versions/${versionId}/mute`,
    {
      mute_crashes: muteCrashes,
      mute_events: muteEvents,
    }
  )
  return response.data
}
