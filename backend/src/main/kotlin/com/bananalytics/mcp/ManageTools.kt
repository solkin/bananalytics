package com.bananalytics.mcp

import com.bananalytics.config.AppPermissions
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.dbIO
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.CrashRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.AccessService
import com.bananalytics.services.ApiKeyService
import com.bananalytics.services.EmailService
import com.bananalytics.services.VersionService
import io.modelcontextprotocol.kotlin.sdk.server.Server
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
private data class McpInvited(
    @SerialName("member_id") val memberId: String,
    val email: String,
    val role: String,
    /** `active` when the person already had an account, `invited` otherwise. */
    val status: String
)

@Serializable
private data class McpNotified(val sent: Int)

@Serializable
private data class McpDone(val done: Boolean = true)

/**
 * What reaches people or cannot be undone: access, email, deletions. Offered
 * only to tokens the person allowed to manage, and each tool still requires the
 * admin role in the app. Agents read crash data written by anyone, so these
 * tools describe their effect plainly for the client to confirm.
 */
internal fun Server.manageTools(userId: UUID) {
    tool(
        name = "invite_member",
        description = "Gives a person access to an app with a role: admin (everything), viewer (crashes and " +
            "analytics), tester (installs builds). Someone without an account gets an invitation, " +
            "emailed when the server has email set up. " +
            "Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            string("email", "The person's email address.", required = true)
            string("role", "The role to give.", required = true, enum = AccessService.ROLES)
        },
        annotations = SENDS_EMAIL
    ) { args ->
        val appId = args.uuid("app_id")
        val email = args.requiredString("email")
        val role = args.requiredChoice("role", AccessService.ROLES)
        AppPermissions.requireAdmin(appId, userId)
        val member = dbIO { AccessService.grant(appId, email, role, userId) }
        toolResult(McpInvited(member.id, member.userEmail, member.role, member.status))
    }

    tool(
        name = "update_member_role",
        description = "Changes a member's role, or the role a pending invitation will give. An app always keeps " +
            "at least one admin. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            string("member_id", "Member ID from list_members.", required = true)
            string("role", "The new role.", required = true, enum = AccessService.ROLES)
        },
        annotations = REVERSIBLE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val memberId = args.uuid("member_id")
        val role = args.requiredChoice("role", AccessService.ROLES)
        AppPermissions.requireAdmin(appId, userId)
        dbIO { AccessService.updateRole(appId, memberId, role) }
        toolResult(McpDone())
    }

    tool(
        name = "remove_member",
        description = "Takes a member's access to an app away, or withdraws a pending invitation. The last " +
            "admin cannot be removed. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            string("member_id", "Member ID from list_members.", required = true)
        },
        annotations = DESTRUCTIVE
    ) { args ->
        val appId = args.uuid("app_id")
        val memberId = args.uuid("member_id")
        AppPermissions.requireAdmin(appId, userId)
        dbIO { AccessService.remove(appId, memberId) }
        toolResult(McpDone())
    }

    tool(
        name = "notify_testers",
        description = "Emails the app's admins and testers that a version is ready to install. The version needs " +
            "an uploaded APK and must be published for testers (update_version). Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The version to announce.", required = true)
        },
        annotations = SENDS_EMAIL
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        AppPermissions.requireAdmin(appId, userId)
        if (!EmailService.isConfigured) throw BadRequestException("Email is not configured on this server")
        val version = requireVersion(appId, versionCode)
        if (!version.hasApk) throw BadRequestException("Version $versionCode has no APK to install; upload one with request_upload first")
        if (!version.publishedForTesters) {
            throw BadRequestException("Version $versionCode is not published for testers; publish it with update_version first")
        }
        val app = dbIO { AppRepository.findById(appId) } ?: throw NotFoundException("App not found")
        toolResult(McpNotified(VersionService.notifyTeam(appId, app, version)))
    }

    tool(
        name = "revoke_api_key",
        description = "Revokes an API key at once: an app build or CI job still using it is refused from then " +
            "on. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            string("key_id", "Key ID from list_api_keys.", required = true)
        },
        annotations = DESTRUCTIVE
    ) { args ->
        val appId = args.uuid("app_id")
        val keyId = args.uuid("key_id")
        AppPermissions.requireAdmin(appId, userId)
        dbIO { ApiKeyService.revoke(appId, keyId) }
        toolResult(McpDone())
    }

    tool(
        name = "delete_version",
        description = "Deletes a version with everything collected from it: crashes, events, sessions, its " +
            "mapping and APK. This cannot be undone. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The version to delete.", required = true)
        },
        annotations = DESTRUCTIVE
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        AppPermissions.requireAdmin(appId, userId)
        val version = requireVersion(appId, versionCode)
        if (!dbIO { VersionRepository.delete(appId, UUID.fromString(version.id)) }) {
            throw NotFoundException("Version $versionCode not found")
        }
        toolResult(McpDone())
    }

    tool(
        name = "delete_crash_group",
        description = "Deletes a crash group with all its crashes. This cannot be undone; to hide noise, prefer " +
            "update_crash_group_status with ignored. Requires the admin role in the app.",
        schema = schema { string("group_id", "Crash group ID from list_crash_groups.", required = true) },
        annotations = DESTRUCTIVE
    ) { args ->
        val groupId = args.uuid("group_id")
        val appId = dbIO { CrashRepository.findGroupAppId(groupId) } ?: throw NotFoundException("Crash group not found")
        AppPermissions.requireAdmin(appId, userId)
        if (!dbIO { CrashRepository.deleteGroup(groupId) }) throw NotFoundException("Crash group not found")
        toolResult(McpDone())
    }
}
