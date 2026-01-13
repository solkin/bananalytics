package com.bananalytics.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ============ SDK Request DTOs ============

@Serializable
data class EnvironmentData(
    @SerialName("package_name") val packageName: String,
    @SerialName("app_version") val appVersion: Long,
    @SerialName("app_version_name") val appVersionName: String? = null,
    @SerialName("device_id") val deviceId: String,
    @SerialName("os_version") val osVersion: Int,
    val manufacturer: String,
    val model: String,
    val country: String,
    val language: String
)

@Serializable
data class DeviceInfo(
    @SerialName("device_id") val deviceId: String,
    @SerialName("os_version") val osVersion: Int,
    val manufacturer: String,
    val model: String,
    val country: String,
    val language: String
)

@Serializable
data class EventData(
    val name: String,
    val tags: Map<String, String> = emptyMap(),
    val fields: Map<String, Double> = emptyMap(),
    val time: Long
)

@Serializable
data class EventsSubmitRequest(
    @SerialName("session_id") val sessionId: String? = null,
    val environment: EnvironmentData,
    val events: List<EventData>
)

@Serializable
data class BreadcrumbData(
    val timestamp: Long,
    val message: String,
    val category: String
)

@Serializable
data class CrashData(
    val timestamp: Long,
    val thread: String,
    val stacktrace: String,
    @SerialName("is_fatal") val isFatal: Boolean = true,
    val context: Map<String, String> = emptyMap(),
    val breadcrumbs: List<BreadcrumbData> = emptyList()
)

@Serializable
data class CrashesSubmitRequest(
    @SerialName("session_id") val sessionId: String? = null,
    val environment: EnvironmentData,
    val crashes: List<CrashData>
)

@Serializable
data class SubmitResponse(val status: Int = 200)

// ============ Admin API DTOs ============

@Serializable
data class AppResponse(
    val id: String,
    val name: String,
    @SerialName("package_name") val packageName: String,
    @SerialName("api_key") val apiKey: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class CreateAppRequest(
    val name: String,
    @SerialName("package_name") val packageName: String
)

@Serializable
data class UpdateAppRequest(
    val name: String? = null
)

@Serializable
data class AppVersionResponse(
    val id: String,
    @SerialName("app_id") val appId: String,
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String?,
    @SerialName("has_mapping") val hasMapping: Boolean,
    @SerialName("has_apk") val hasApk: Boolean,
    @SerialName("apk_size") val apkSize: Long?,
    @SerialName("apk_filename") val apkFilename: String?,
    @SerialName("apk_uploaded_at") val apkUploadedAt: String?,
    @SerialName("release_notes") val releaseNotes: String?,
    @SerialName("published_for_testers") val publishedForTesters: Boolean = false,
    @SerialName("mute_crashes") val muteCrashes: Boolean = false,
    @SerialName("mute_events") val muteEvents: Boolean = false,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class UpdateVersionRequest(
    @SerialName("release_notes") val releaseNotes: String? = null,
    @SerialName("published_for_testers") val publishedForTesters: Boolean? = null,
    @SerialName("mute_crashes") val muteCrashes: Boolean? = null,
    @SerialName("mute_events") val muteEvents: Boolean? = null
)

@Serializable
data class UpdateVersionMuteRequest(
    @SerialName("mute_crashes") val muteCrashes: Boolean? = null,
    @SerialName("mute_events") val muteEvents: Boolean? = null
)

@Serializable
data class CreateVersionRequest(
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String? = null,
    @SerialName("mapping_content") val mappingContent: String? = null
)

@Serializable
data class CrashGroupResponse(
    val id: String,
    @SerialName("app_id") val appId: String,
    @SerialName("exception_class") val exceptionClass: String?,
    @SerialName("exception_message") val exceptionMessage: String?,
    @SerialName("first_seen") val firstSeen: String,
    @SerialName("last_seen") val lastSeen: String,
    val occurrences: Int,
    val status: String
)

@Serializable
data class CrashResponse(
    val id: String,
    @SerialName("app_id") val appId: String,
    @SerialName("group_id") val groupId: String?,
    @SerialName("version_code") val versionCode: Long?,
    @SerialName("stacktrace_raw") val stacktraceRaw: String,
    @SerialName("stacktrace_decoded") val stacktraceDecoded: String?,
    @SerialName("decoded_at") val decodedAt: String?,
    @SerialName("decode_error") val decodeError: String?,
    val thread: String?,
    @SerialName("is_fatal") val isFatal: Boolean,
    val context: Map<String, String>?,
    val breadcrumbs: List<BreadcrumbData>?,
    @SerialName("device_info") val deviceInfo: DeviceInfo?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class EventResponse(
    val id: Long,
    @SerialName("app_id") val appId: String,
    @SerialName("version_code") val versionCode: Long?,
    val name: String,
    val tags: Map<String, String>?,
    val fields: Map<String, Double>?,
    @SerialName("device_info") val deviceInfo: DeviceInfo?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class PaginatedResponse<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val pageSize: Int
)

// ============ Event Summary DTOs ============

@Serializable
data class EventSummaryResponse(
    val name: String,
    val total: Long,
    @SerialName("this_month") val thisMonth: Long,
    val today: Long
)

@Serializable
data class EventVersionStats(
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String? = null,
    val count: Long
)

@Serializable
data class VersionInfo(
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String? = null
)

@Serializable
data class DailyStat(
    val date: String,
    val count: Long
)

@Serializable
data class UpdateCrashGroupRequest(
    val status: String? = null
)

@Serializable
data class RetraceRequest(
    @SerialName("crash_id") val crashId: String
)

// ============ Session Stats DTOs ============

@Serializable
data class CrashFreeStatsResponse(
    val date: String,
    @SerialName("total_sessions") val totalSessions: Long,
    @SerialName("crash_free_sessions") val crashFreeSessions: Long,
    @SerialName("crash_free_rate") val crashFreeRate: Double
)

@Serializable
data class SessionVersionStats(
    val date: String,
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String?,
    val count: Long
)

// ============ Download Token DTOs ============

@Serializable
data class DownloadTokenResponse(
    val token: String,
    @SerialName("download_url") val downloadUrl: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class CreateDownloadTokenRequest(
    @SerialName("expires_in_hours") val expiresInHours: Int = 24
)

// ============ Notify Testers DTOs ============

@Serializable
data class NotifyTestersRequest(
    val emails: List<String>
)

@Serializable
data class NotifyTestersResponse(
    val sent: Int,
    val failed: Int
)

@Serializable
data class AppMemberResponse(
    val email: String,
    val name: String?,
    val role: String
)

// ============ Maintenance DTOs ============

@Serializable
data class MigrationResult(
    @SerialName("groups_processed") val groupsProcessed: Int,
    @SerialName("groups_merged") val groupsMerged: Int,
    @SerialName("crashes_reassigned") val crashesReassigned: Int
)
