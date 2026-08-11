export interface App {
  id: string
  name: string
  package_name: string
  created_at: string
  /** Where to read the uploaded icon, absent when the app has none. The URL
   *  changes whenever the icon does, so it is safe to cache. */
  icon_url?: string | null
  /** Only present in the response that created the app — keys are stored
   *  hashed and can never be read back. */
  api_key?: string | null
}

/** `sdk` submits crashes and events, `upload` publishes releases from CI. */
export type ApiKeyScope = 'sdk' | 'upload'

export interface ApiKey {
  id: string
  app_id: string
  name: string
  scope: ApiKeyScope
  key_prefix: string
  created_by: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface CreatedApiKey {
  key: ApiKey
  api_key: string
}

export interface AppVersion {
  id: string
  app_id: string
  version_code: number
  version_name: string | null
  has_mapping: boolean
  has_apk: boolean
  apk_size: number | null
  apk_filename: string | null
  apk_uploaded_at: string | null
  release_notes: string | null
  published_for_testers: boolean
  mute_crashes: boolean
  mute_events: boolean
  created_at: string
}

export interface DownloadToken {
  token: string
  download_url: string
  expires_at: string
}

export interface CrashGroup {
  id: string
  app_id: string
  exception_class: string | null
  exception_message: string | null
  first_seen: string
  last_seen: string
  occurrences: number
  affected_devices: number
  status: 'open' | 'resolved' | 'ignored'
}

export interface Breadcrumb {
  timestamp: number
  message: string
  category: string
}

export interface DeviceInfo {
  device_id: string
  os_version: number
  manufacturer: string
  model: string
  country: string
  language: string
}

export interface Crash {
  id: string
  app_id: string
  group_id: string | null
  version_code: number | null
  stacktrace_raw: string
  stacktrace_decoded: string | null
  decoded_at: string | null
  decode_error: string | null
  thread: string | null
  is_fatal: boolean
  context: Record<string, string> | null
  breadcrumbs: Breadcrumb[] | null
  device_info: DeviceInfo | null
  created_at: string
}

export interface Event {
  id: number
  app_id: string
  version_code: number | null
  name: string
  tags: Record<string, string> | null
  fields: Record<string, number> | null
  device_info: DeviceInfo | null
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
