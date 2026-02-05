export interface App {
  id: string
  name: string
  package_name: string
  api_key: string
  created_at: string
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
