package com.bananalytics.mcp

import com.bananalytics.config.AppPermissions
import com.bananalytics.config.dbIO
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.VersionRepository
import io.modelcontextprotocol.kotlin.sdk.server.Server
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
private data class McpApp(
    val id: String,
    val name: String,
    @SerialName("package_name") val packageName: String,
    val role: String,
    /** Testers only download builds; crashes and analytics are closed to them. */
    @SerialName("analytics_access") val analyticsAccess: Boolean
)

@Serializable
private data class McpVersion(
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String?,
    @SerialName("has_mapping") val hasMapping: Boolean,
    @SerialName("has_apk") val hasApk: Boolean,
    @SerialName("release_notes") val releaseNotes: String?,
    @SerialName("mute_crashes") val muteCrashes: Boolean,
    @SerialName("mute_events") val muteEvents: Boolean,
    @SerialName("created_at") val createdAt: String
)

internal fun Server.appTools(userId: UUID) {
    tool(
        name = "list_apps",
        description = "Lists the Android apps you can access in Bananalytics, with your role in each. " +
            "Start here: every other tool takes an app_id from this list.",
        schema = schema {},
        annotations = READ_ONLY
    ) {
        val apps = dbIO {
            AppAccessRepository.findUserApps(userId).map { app ->
                val role = AppAccessRepository.getUserRole(UUID.fromString(app.id), userId) ?: "none"
                McpApp(app.id, app.name, app.packageName, role, analyticsAccess = role == "admin" || role == "viewer")
            }
        }
        toolResult(apps)
    }

    tool(
        name = "list_versions",
        description = "Lists an app's known versions, newest first: whether an R8/ProGuard mapping is uploaded " +
            "(without one, stacktraces of that version stay obfuscated), whether a build is available, " +
            "release notes and muted collection.",
        schema = schema { string("app_id", "App ID from list_apps.", required = true) },
        annotations = READ_ONLY
    ) { args ->
        val appId = args.uuid("app_id")
        AppPermissions.requireAnalytics(appId, userId)
        val versions = dbIO { VersionRepository.findByAppId(appId) }.map {
            McpVersion(
                it.versionCode, it.versionName, it.hasMapping, it.hasApk, it.releaseNotes,
                it.muteCrashes, it.muteEvents, it.createdAt
            )
        }
        toolResult(versions)
    }
}
