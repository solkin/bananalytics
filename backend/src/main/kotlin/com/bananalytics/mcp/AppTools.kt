package com.bananalytics.mcp

import com.bananalytics.config.AppPermissions
import com.bananalytics.config.dbIO
import com.bananalytics.models.AppVersionResponse
import com.bananalytics.repositories.ApiKeyRepository
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.AccessService
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
internal data class McpVersion(
    @SerialName("version_code") val versionCode: Long,
    @SerialName("version_name") val versionName: String?,
    @SerialName("has_mapping") val hasMapping: Boolean,
    @SerialName("has_apk") val hasApk: Boolean,
    @SerialName("release_notes") val releaseNotes: String?,
    /** Testers see and install only published versions. */
    @SerialName("published_for_testers") val publishedForTesters: Boolean,
    @SerialName("mute_crashes") val muteCrashes: Boolean,
    @SerialName("mute_events") val muteEvents: Boolean,
    @SerialName("created_at") val createdAt: String
)

internal fun AppVersionResponse.toMcpVersion(): McpVersion = McpVersion(
    versionCode, versionName, hasMapping, hasApk, releaseNotes, publishedForTesters, muteCrashes, muteEvents, createdAt
)

@Serializable
private data class McpMember(
    /** Addresses the member in update_member_role and remove_member. */
    val id: String,
    val email: String,
    val name: String?,
    val role: String,
    /** `active`, or `invited` while the person has not signed up yet. */
    val status: String
)

@Serializable
private data class McpApiKey(
    val id: String,
    val name: String,
    val scope: String,
    @SerialName("key_prefix") val keyPrefix: String,
    @SerialName("last_used_at") val lastUsedAt: String?,
    @SerialName("revoked_at") val revokedAt: String?,
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
        val versions = dbIO { VersionRepository.findByAppId(appId) }.map { it.toMcpVersion() }
        toolResult(versions)
    }

    tool(
        name = "list_members",
        description = "Lists who has access to an app and with which role (admin, viewer, tester), " +
            "including invitations not accepted yet.",
        schema = schema { string("app_id", "App ID from list_apps.", required = true) },
        annotations = READ_ONLY
    ) { args ->
        val appId = args.uuid("app_id")
        AppPermissions.requireAnalytics(appId, userId)
        val members = dbIO { AccessService.list(appId) }.map {
            McpMember(it.id, it.userEmail, it.userName, it.role, it.status)
        }
        toolResult(members)
    }

    tool(
        name = "list_api_keys",
        description = "Lists an app's API keys: `sdk` keys the app sends crashes and events with, `upload` keys " +
            "CI publishes releases with. Only a prefix of each key is known. Requires the admin role in the app.",
        schema = schema { string("app_id", "App ID from list_apps.", required = true) },
        annotations = READ_ONLY
    ) { args ->
        val appId = args.uuid("app_id")
        AppPermissions.requireAdmin(appId, userId)
        val keys = dbIO { ApiKeyRepository.findByAppId(appId) }.map {
            McpApiKey(it.id, it.name, it.scope, it.keyPrefix, it.lastUsedAt, it.revokedAt, it.createdAt)
        }
        toolResult(keys)
    }
}
