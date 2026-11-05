package com.bananalytics.mcp

import com.bananalytics.config.AppConfig
import com.bananalytics.config.AppPermissions
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.dbIO
import com.bananalytics.repositories.ApiKeyRepository
import com.bananalytics.repositories.UploadKind
import com.bananalytics.repositories.UploadTokenRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.ApiKeyService
import com.bananalytics.services.AppService
import com.bananalytics.services.VersionService
import io.ktor.http.HttpHeaders
import io.modelcontextprotocol.kotlin.sdk.server.Server
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

private const val DEFAULT_LINK_HOURS = 24

@Serializable
private data class McpCreatedApp(
    val id: String,
    val name: String,
    @SerialName("package_name") val packageName: String,
    /** The SDK key of the app's first key, readable only in this response. */
    @SerialName("sdk_api_key") val sdkApiKey: String?
)

@Serializable
private data class McpRenamedApp(
    val id: String,
    val name: String,
    @SerialName("package_name") val packageName: String
)

@Serializable
private data class McpCreatedKey(
    val id: String,
    val name: String,
    val scope: String,
    @SerialName("api_key") val apiKey: String
)

@Serializable
private data class McpDownloadLink(
    @SerialName("download_url") val downloadUrl: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
private data class McpUpload(
    val url: String,
    val method: String,
    /** The body is the file itself. */
    val headers: Map<String, String>,
    @SerialName("expires_at") val expiresAt: String,
    val example: String
)

/**
 * Setting apps up and shipping builds: what a person does in the web UI when
 * they add an app or a release. Offered to tokens allowed to write; everything
 * past creating an app requires the admin role in it. Nothing here deletes data
 * or sends email.
 *
 * [canManage] widens create_api_key to CI upload keys.
 */
internal fun Server.setupTools(userId: UUID, canManage: Boolean) {
    tool(
        name = "create_app",
        description = "Registers a new Android app; you become its admin. Returns its app_id and the SDK API key " +
            "the app sends crashes and events with — shown only in this response, so put it into the app's " +
            "Bananalytics configuration right away.",
        schema = schema {
            string("name", "Display name, e.g. the app's launcher label.", required = true)
            string("package_name", "The applicationId, e.g. com.example.app. Must be unique on this server.", required = true)
        },
        annotations = ADDITIVE_WRITE
    ) { args ->
        val app = dbIO { AppService.create(userId, args.requiredString("name"), args.requiredString("package_name")) }
        toolResult(McpCreatedApp(app.id, app.name, app.packageName, app.apiKey))
    }

    tool(
        name = "rename_app",
        description = "Changes an app's display name. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            string("name", "The new display name.", required = true)
        },
        annotations = REVERSIBLE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        AppPermissions.requireAdmin(appId, userId)
        val app = dbIO { AppService.rename(appId, args.requiredString("name")) }
        toolResult(McpRenamedApp(app.id, app.name, app.packageName))
    }

    val keyScopes = if (canManage) ApiKeyRepository.SCOPES else listOf(ApiKeyRepository.SCOPE_SDK)
    tool(
        name = "create_api_key",
        description = "Creates an API key for an app. `sdk` keys go into the app to send crashes and events" +
            (if (canManage) "; `upload` keys let CI publish releases and belong in a CI secret, never in code" else "") +
            ". The value is shown only in this response. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            string("name", "What uses the key, e.g. \"Production build\" or \"GitHub Actions\".", required = true)
            string("scope", "Defaults to sdk.", enum = keyScopes)
        },
        annotations = ADDITIVE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val scope = args.choice("scope", keyScopes) ?: ApiKeyRepository.SCOPE_SDK
        AppPermissions.requireAdmin(appId, userId)
        val created = dbIO { ApiKeyService.create(appId, args.requiredString("name"), scope, userId) }
        toolResult(McpCreatedKey(created.key.id, created.key.name, created.key.scope, created.apiKey))
    }

    tool(
        name = "create_version",
        description = "Adds a version to an app ahead of its first crash, e.g. to attach its R8/ProGuard mapping " +
            "or APK with request_upload. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The build's versionCode.", required = true, minimum = 1)
            string("version_name", "The build's versionName, e.g. 2.4.1.")
        },
        annotations = ADDITIVE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        val versionName = args.string("version_name")
        AppPermissions.requireAdmin(appId, userId)
        val version = dbIO { VersionService.create(appId, versionCode, versionName, mappingFile = null) }
        toolResult(version.toMcpVersion())
    }

    tool(
        name = "update_version",
        description = "Sets a version's release notes and whether testers can see and install it. Omitted fields " +
            "stay as they are. Publishing sends no email; notify_testers does. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The version to change.", required = true)
            string("release_notes", "What changed, shown to testers.")
            boolean("published_for_testers", "True to offer the build to testers, false to hide it.")
        },
        annotations = REVERSIBLE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        val releaseNotes = args.string("release_notes")
        val published = args.boolean("published_for_testers")
        if (releaseNotes == null && published == null) throw BadRequestException("Set release_notes, published_for_testers or both")
        AppPermissions.requireAdmin(appId, userId)
        val versionId = UUID.fromString(requireVersion(appId, versionCode).id)
        dbIO { VersionRepository.update(appId, versionId, releaseNotes = releaseNotes, publishedForTesters = published) }
        val updated = dbIO { VersionRepository.findById(appId, versionId) } ?: throw NotFoundException("Version $versionCode not found")
        toolResult(updated.toMcpVersion())
    }

    tool(
        name = "create_download_link",
        description = "Creates a link anyone can download a version's APK by, without signing in, until it " +
            "expires. Requires the admin role in the app and an uploaded APK.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The version to share.", required = true)
            integer(
                "expires_in_hours", "How long the link works. Defaults to $DEFAULT_LINK_HOURS.",
                minimum = 1, maximum = VersionService.MAX_LINK_HOURS.toLong()
            )
        },
        annotations = ADDITIVE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        val hours = args.int("expires_in_hours", DEFAULT_LINK_HOURS, 1..VersionService.MAX_LINK_HOURS)
        AppPermissions.requireAdmin(appId, userId)
        val versionId = UUID.fromString(requireVersion(appId, versionCode).id)
        val link = dbIO { VersionService.createDownloadLink(appId, versionId, hours) }
        toolResult(McpDownloadLink(VersionService.downloadUrl(link.token), link.expiresAt.toString()))
    }

    tool(
        name = "request_upload",
        description = "Prepares a one-time upload of a version's file: its R8/ProGuard `mapping` " +
            "(mapping.txt, plain or gzipped) or its `apk`. Send the file yourself with the returned command, " +
            "e.g. from the project's build/outputs; it never goes through tool arguments. The token works once, " +
            "for ${UploadTokenRepository.LIFETIME.toMinutes()} minutes. Requires the admin role in the app.",
        schema = schema {
            string("app_id", "App ID from list_apps.", required = true)
            integer("version_code", "The version the file belongs to; create_version adds a missing one.", required = true)
            string("kind", "Which file to upload.", required = true, enum = UploadKind.WIRE)
        },
        annotations = ADDITIVE_WRITE
    ) { args ->
        val appId = args.uuid("app_id")
        val versionCode = args.requiredLong("version_code")
        val kind = args.requiredChoice("kind", UploadKind.WIRE).let { wire -> UploadKind.entries.first { it.wire == wire } }
        AppPermissions.requireAdmin(appId, userId)
        val versionId = UUID.fromString(requireVersion(appId, versionCode).id)
        val upload = dbIO { UploadTokenRepository.create(appId, versionId, kind, userId) }
        val url = "${AppConfig.baseUrl}/api/v1/uploads"
        val authorization = "Bearer ${upload.token}"
        val file = if (kind == UploadKind.APK) "path/to/app.apk" else "path/to/mapping.txt"
        toolResult(
            McpUpload(
                url = url,
                method = "PUT",
                headers = mapOf(HttpHeaders.Authorization to authorization),
                expiresAt = upload.expiresAt.toString(),
                example = "curl --fail-with-body -T $file -H '${HttpHeaders.Authorization}: $authorization' $url"
            )
        )
    }
}
