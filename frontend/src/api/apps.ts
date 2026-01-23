import api from './client'
import type { App, AppVersion, DownloadToken } from '@/types'

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

export function getMappingDownloadUrl(appId: string, versionId: string): string {
  return `/api/v1/apps/${appId}/versions/${versionId}/mapping`
}

// Version update
export async function updateVersion(
  appId: string,
  versionId: string,
  data: {
    release_notes?: string
    published_for_testers?: boolean
    mute_crashes?: boolean
    mute_events?: boolean
  }
): Promise<AppVersion> {
  const response = await api.put<AppVersion>(
    `/apps/${appId}/versions/${versionId}`,
    data
  )
  return response.data
}

// APK handling
export async function uploadApk(
  appId: string,
  versionId: string,
  apkFile: File
): Promise<AppVersion> {
  const formData = new FormData()
  formData.append('apk', apkFile)

  const response = await api.put<AppVersion>(
    `/apps/${appId}/versions/${versionId}/apk`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return response.data
}

export function getApkDownloadUrl(appId: string, versionId: string): string {
  return `/api/v1/apps/${appId}/versions/${versionId}/apk`
}

export async function deleteApk(appId: string, versionId: string): Promise<void> {
  await api.delete(`/apps/${appId}/versions/${versionId}/apk`)
}

export async function deleteVersion(appId: string, versionId: string): Promise<void> {
  await api.delete(`/apps/${appId}/versions/${versionId}`)
}

// Download tokens (temporary public links)
export async function createDownloadToken(
  appId: string,
  versionId: string,
  expiresInHours: number = 24
): Promise<DownloadToken> {
  const response = await api.post<DownloadToken>(
    `/apps/${appId}/versions/${versionId}/download-link`,
    { expires_in_hours: expiresInHours }
  )
  return response.data
}

// Distribution (for testers)
export async function getDistributionVersions(appId: string): Promise<AppVersion[]> {
  const response = await api.get<AppVersion[]>(`/apps/${appId}/distribution`)
  return response.data
}

// App members (for notification)
export interface AppMember {
  email: string
  name: string | null
  role: string
}

export async function getAppMembers(appId: string): Promise<AppMember[]> {
  const response = await api.get<AppMember[]>(`/apps/${appId}/members`)
  return response.data
}

export interface NotifyTestersResult {
  sent: number
  failed: number
}

export async function notifyTesters(
  appId: string,
  versionId: string,
  emails: string[]
): Promise<NotifyTestersResult> {
  const response = await api.post<NotifyTestersResult>(
    `/apps/${appId}/versions/${versionId}/notify-testers`,
    { emails }
  )
  return response.data
}
