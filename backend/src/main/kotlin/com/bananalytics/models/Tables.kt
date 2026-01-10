package com.bananalytics.models

import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone
import kotlinx.serialization.json.Json

object Apps : UUIDTable("apps") {
    val name = varchar("name", 255)
    val packageName = varchar("package_name", 255).uniqueIndex()
    val apiKey = varchar("api_key", 64).uniqueIndex()
    val createdAt = timestampWithTimeZone("created_at")
}

object AppVersions : UUIDTable("app_versions") {
    val appId = reference("app_id", Apps)
    val versionCode = long("version_code")
    val versionName = varchar("version_name", 50).nullable()
    val mappingPath = varchar("mapping_path", 512).nullable()
    val apkPath = varchar("apk_path", 512).nullable()
    val apkSize = long("apk_size").nullable()
    val apkFilename = varchar("apk_filename", 255).nullable()
    val apkUploadedAt = timestampWithTimeZone("apk_uploaded_at").nullable()
    val releaseNotes = text("release_notes").nullable()
    val publishedForTesters = bool("published_for_testers").default(false)
    val muteCrashes = bool("mute_crashes").default(false)
    val muteEvents = bool("mute_events").default(false)
    val createdAt = timestampWithTimeZone("created_at")

    init {
        uniqueIndex(appId, versionCode)
    }
}

object CrashGroups : UUIDTable("crash_groups") {
    val appId = reference("app_id", Apps)
    val fingerprint = varchar("fingerprint", 64)
    val exceptionClass = varchar("exception_class", 512).nullable()
    val exceptionMessage = text("exception_message").nullable()
    val firstSeen = timestampWithTimeZone("first_seen")
    val lastSeen = timestampWithTimeZone("last_seen")
    val occurrences = integer("occurrences").default(1)
    val status = varchar("status", 20).default("open")

    init {
        uniqueIndex(appId, fingerprint)
    }
}

private val jsonSerializer = Json { ignoreUnknownKeys = true }

object Crashes : UUIDTable("crashes") {
    val appId = reference("app_id", Apps)
    val versionId = reference("version_id", AppVersions).nullable()
    val groupId = reference("group_id", CrashGroups).nullable()
    val versionCode = long("version_code").nullable()
    val stacktraceRaw = text("stacktrace_raw")
    val stacktraceDecoded = text("stacktrace_decoded").nullable()
    val decodedAt = timestampWithTimeZone("decoded_at").nullable()
    val decodeError = text("decode_error").nullable()
    val thread = varchar("thread", 100).nullable()
    val isFatal = bool("is_fatal").default(true)
    val context = jsonb<Map<String, String>>("context", jsonSerializer).nullable()
    val breadcrumbs = jsonb<List<BreadcrumbData>>("breadcrumbs", jsonSerializer).nullable()
    val deviceInfo = jsonb<DeviceInfo>("device_info", jsonSerializer).nullable()
    val createdAt = timestampWithTimeZone("created_at")
}

object Events : Table("events") {
    val id = long("id").autoIncrement()
    val appId = uuid("app_id")
    val versionCode = long("version_code").nullable()
    val name = varchar("name", 255)
    val tags = jsonb<Map<String, String>>("tags", jsonSerializer).nullable()
    val eventFields = jsonb<Map<String, Double>>("fields", jsonSerializer).nullable()
    val deviceInfo = jsonb<DeviceInfo>("device_info", jsonSerializer).nullable()
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id, createdAt)
}

object AppSessions : UUIDTable("app_sessions") {
    val appId = reference("app_id", Apps)
    val sessionId = uuid("session_id")
    val versionCode = long("version_code")
    val deviceId = varchar("device_id", 64).nullable()
    val hasCrash = bool("has_crash").default(false)
    val hasEvent = bool("has_event").default(false)
    val firstSeen = timestampWithTimeZone("first_seen")
    val lastSeen = timestampWithTimeZone("last_seen")

    init {
        uniqueIndex(appId, sessionId)
    }
}

object DownloadTokens : UUIDTable("download_tokens") {
    val appId = reference("app_id", Apps)
    val versionId = reference("version_id", AppVersions)
    val token = varchar("token", 64).uniqueIndex()
    val expiresAt = timestampWithTimeZone("expires_at")
    val createdAt = timestampWithTimeZone("created_at")
}
