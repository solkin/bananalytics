package com.bananalytics.mcp

import com.bananalytics.config.AppPermissions
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.dbIO
import com.bananalytics.repositories.CrashRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.CrashService
import io.modelcontextprotocol.kotlin.sdk.server.Server
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

private val TRIAGE_STATUSES = listOf("open", "resolved", "ignored")

@Serializable
private data class McpRetrace(
    val deobfuscated: Boolean,
    @SerialName("decode_error") val decodeError: String?
)

@Serializable
private data class McpVersionMute(
    @SerialName("version_code") val versionCode: Long,
    @SerialName("mute_crashes") val muteCrashes: Boolean,
    @SerialName("mute_events") val muteEvents: Boolean
)

/**
 * Triage. Like every tool that changes data, offered only to tokens the person
 * allowed to write, and each one still requires the admin role in the app.
 */
internal fun Server.writeTools(userId: UUID) {
    tool(
        name = "update_crash_group_status",
        description = "Sets the triage status of a crash group: resolved once a fix ships, ignored for noise, " +
            "open to reopen it. Requires the admin role in the app.",
        schema = schema {
            string("group_id", "Crash group ID from list_crash_groups.", required = true)
            string("status", "The new status.", required = true, enum = TRIAGE_STATUSES)
        },
        annotations = REVERSIBLE_WRITE
    ) { args ->
        val groupId = args.uuid("group_id")
        val status = args.requiredChoice("status", TRIAGE_STATUSES)
        val appId = dbIO { CrashRepository.findGroupAppId(groupId) } ?: throw NotFoundException("Crash group not found")
        AppPermissions.requireAdmin(appId, userId)
        dbIO { CrashRepository.updateGroupStatus(groupId, status) }
        toolResult(dbIO { CrashRepository.findGroupById(groupId) } ?: throw NotFoundException("Crash group not found"))
    }

    tool(
        name = "retrace_crash",
        description = "Deobfuscates one crash again with the R8/ProGuard mapping now uploaded for its version, " +
            "for crashes that arrived before the mapping did. Requires the admin role in the app.",
        schema = schema { string("crash_id", "Crash ID from list_crashes or get_latest_crash.", required = true) },
        annotations = REVERSIBLE_WRITE
    ) { args ->
        val crashId = args.uuid("crash_id")
        val crash = dbIO { CrashRepository.findCrashById(crashId) } ?: throw NotFoundException("Crash not found")
        AppPermissions.requireAdmin(UUID.fromString(crash.appId), userId)
        val retraced = dbIO { CrashService.retraceCrash(crashId) }
        toolResult(McpRetrace(deobfuscated = retraced.stacktraceDecoded != null, decodeError = retraced.decodeError))
    }

    tool(
        name = "mute_version",
        description = "Stops (or resumes) collecting crashes and/or events from one version, e.g. an old build " +
            "still in use that only adds noise. Omitted flags stay as they are. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The version to change.", required = true)
            boolean("mute_crashes", "True to drop its crash reports, false to collect them again.")
            boolean("mute_events", "True to drop its analytics events, false to collect them again.")
        },
        annotations = REVERSIBLE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        val muteCrashes = args.boolean("mute_crashes")
        val muteEvents = args.boolean("mute_events")
        if (muteCrashes == null && muteEvents == null) throw BadRequestException("Set mute_crashes, mute_events or both")
        AppPermissions.requireAdmin(appId, userId)
        val version = requireVersion(appId, versionCode)
        dbIO { VersionRepository.updateMuteSettings(appId, UUID.fromString(version.id), muteCrashes, muteEvents) }
        val updated = dbIO { VersionRepository.findById(appId, UUID.fromString(version.id)) }
            ?: throw NotFoundException("Version $versionCode not found")
        toolResult(McpVersionMute(updated.versionCode, updated.muteCrashes, updated.muteEvents))
    }
}
