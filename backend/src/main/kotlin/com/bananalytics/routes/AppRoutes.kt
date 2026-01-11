package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.*
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.DownloadTokenRepository
import com.bananalytics.repositories.InvitationRepository
import com.bananalytics.repositories.UserRepository
import com.bananalytics.repositories.VersionRepository
import com.bananalytics.services.EmailService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

fun Route.appRoutes() {
    route("/apps") {
        // List apps user has access to
        get {
            val user = call.getUser()
            val apps = AppAccessRepository.findUserApps(UUID.fromString(user.id))
            call.respond(apps)
        }

        // Create new app
        post {
            val user = call.getUser()
            val request = call.receive<CreateAppRequest>()

            if (request.name.isBlank()) {
                throw BadRequestException("Name is required")
            }
            if (request.packageName.isBlank()) {
                throw BadRequestException("Package name is required")
            }

            val existing = AppRepository.findByPackageName(request.packageName)
            if (existing != null) {
                throw BadRequestException("Package name already exists")
            }

            val app = AppRepository.create(request.name, request.packageName)
            
            // Grant admin access to creator
            AppAccessRepository.grantAccess(
                appId = UUID.fromString(app.id),
                userId = UUID.fromString(user.id),
                role = "admin"
            )

            call.respond(HttpStatusCode.Created, app)
        }

        // Get app details
        get("/{id}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAccess(appId, user)

            val app = AppRepository.findById(appId)
                ?: throw NotFoundException("App not found")

            call.respond(app)
        }

        // Update app
        put("/{id}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<UpdateAppRequest>()

            val updated = AppRepository.update(appId, request.name)
            if (!updated) {
                throw NotFoundException("App not found")
            }

            val app = AppRepository.findById(appId)!!
            call.respond(app)
        }

        // Delete app
        delete("/{id}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            val deleted = AppRepository.delete(appId)
            if (!deleted) {
                throw NotFoundException("App not found")
            }

            call.respond(HttpStatusCode.NoContent)
        }

        // Regenerate API key
        post("/{id}/regenerate-key") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            val newKey = AppRepository.regenerateApiKey(appId)
                ?: throw NotFoundException("App not found")

            call.respond(mapOf("api_key" to newKey))
        }

        // --- Access management ---

        // List users with access (including pending invitations)
        get("/{id}/access") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAccess(appId, user)

            // Get active access
            val accessList = AppAccessRepository.findByAppId(appId).map { access ->
                AccessListItemResponse(
                    id = access.id,
                    appId = access.appId,
                    userId = access.userId,
                    userEmail = access.userEmail,
                    userName = access.userName,
                    role = access.role,
                    status = "active",
                    createdAt = access.createdAt
                )
            }

            // Get pending invitations
            val invitations = InvitationRepository.findByAppId(appId).map { invitation ->
                AccessListItemResponse(
                    id = invitation.id,
                    appId = invitation.appId,
                    userId = null,
                    userEmail = invitation.email,
                    userName = null,
                    role = invitation.role,
                    status = "invited",
                    createdAt = invitation.createdAt
                )
            }

            call.respond(accessList + invitations)
        }

        // Grant access to user (or create invitation for unknown emails)
        post("/{id}/access") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<GrantAccessRequest>()

            if (request.role !in listOf("admin", "viewer", "tester")) {
                throw BadRequestException("Role must be 'admin', 'viewer', or 'tester'")
            }

            val targetUser = UserRepository.findByEmail(request.email)
            
            if (targetUser != null) {
                // User exists - grant access directly
                val existingRole = AppAccessRepository.getUserRole(appId, UUID.fromString(targetUser.id))
                if (existingRole != null) {
                    throw BadRequestException("User already has access")
                }

                val access = AppAccessRepository.grantAccess(
                    appId = appId,
                    userId = UUID.fromString(targetUser.id),
                    role = request.role
                )

                call.respond(HttpStatusCode.Created, access)
            } else {
                // User doesn't exist - create invitation
                val existingInvitation = InvitationRepository.findByEmailAndApp(request.email, appId)
                if (existingInvitation != null) {
                    throw BadRequestException("Invitation already sent to this email")
                }

                val app = AppRepository.findById(appId)
                    ?: throw NotFoundException("App not found")

                val invitation = InvitationRepository.create(
                    email = request.email,
                    appId = appId,
                    role = request.role,
                    invitedBy = UUID.fromString(user.id)
                )

                // Send invitation email if SMTP is configured
                if (EmailService.isConfigured) {
                    EmailService.sendInvitationEmail(
                        toEmail = request.email,
                        appName = app.name,
                        role = request.role,
                        inviteToken = invitation.token
                    )
                }

                // Return invitation response (mimics access response format for UI consistency)
                call.respond(HttpStatusCode.Created, InvitationResponse(
                    id = invitation.id.toString(),
                    email = invitation.email,
                    appId = invitation.appId.toString(),
                    role = invitation.role,
                    createdAt = invitation.expiresAt.toString()
                ))
            }
        }

        // Update user access role (or invitation role)
        put("/{id}/access/{accessId}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val accessId = call.parameters["accessId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid access ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<UpdateAccessRequest>()

            if (request.role !in listOf("admin", "viewer", "tester")) {
                throw BadRequestException("Role must be 'admin', 'viewer', or 'tester'")
            }

            // First try to update invitation
            val invitationUpdated = InvitationRepository.updateRole(accessId, request.role)
            if (invitationUpdated) {
                call.respond(HttpStatusCode.NoContent)
                return@put
            }

            // If not an invitation, update user access role
            // Prevent removing the last admin
            if (request.role != "admin") {
                val currentRole = AppAccessRepository.getUserRole(appId, accessId)
                if (currentRole == "admin" && AppAccessRepository.countAdmins(appId) <= 1) {
                    throw BadRequestException("Cannot remove the last admin")
                }
            }

            val updated = AppAccessRepository.updateRole(appId, accessId, request.role)
            if (!updated) {
                throw NotFoundException("Access not found")
            }

            call.respond(HttpStatusCode.NoContent)
        }

        // Revoke access (or cancel invitation)
        delete("/{id}/access/{accessId}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val accessId = call.parameters["accessId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid access ID")

            call.requireAppAdmin(appId, user)

            // First try to find and delete invitation
            val deletedInvitation = InvitationRepository.delete(accessId)
            if (deletedInvitation) {
                call.respond(HttpStatusCode.NoContent)
                return@delete
            }

            // If not an invitation, try to revoke user access
            // The accessId might be user ID for existing users
            val currentRole = AppAccessRepository.getUserRole(appId, accessId)
            if (currentRole == "admin" && AppAccessRepository.countAdmins(appId) <= 1) {
                throw BadRequestException("Cannot remove the last admin")
            }

            val revoked = AppAccessRepository.revokeAccess(appId, accessId)
            if (!revoked) {
                throw NotFoundException("Access not found")
            }

            call.respond(HttpStatusCode.NoContent)
        }

        // Get invitation link
        get("/{id}/access/{invitationId}/link") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val invitationId = call.parameters["invitationId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid invitation ID")

            call.requireAppAdmin(appId, user)

            val invitation = InvitationRepository.findById(invitationId)
                ?: throw NotFoundException("Invitation not found")

            val baseUrl = System.getenv("BASE_URL") ?: "http://localhost:5173"
            val inviteUrl = "$baseUrl/register?invite=${invitation.token}"

            call.respond(mapOf("url" to inviteUrl))
        }

        // Resend invitation email
        post("/{id}/access/{invitationId}/resend") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val invitationId = call.parameters["invitationId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid invitation ID")

            call.requireAppAdmin(appId, user)

            val invitation = InvitationRepository.findById(invitationId)
                ?: throw NotFoundException("Invitation not found")

            if (!EmailService.isConfigured) {
                throw BadRequestException("SMTP is not configured")
            }

            val app = AppRepository.findById(appId)
                ?: throw NotFoundException("App not found")

            val sent = EmailService.sendInvitationEmail(
                toEmail = invitation.email,
                appName = app.name,
                role = invitation.role,
                inviteToken = invitation.token
            )

            if (!sent) {
                throw BadRequestException("Failed to send email")
            }

            call.respond(mapOf("status" to "sent"))
        }

        // Get current user's role for an app
        get("/{id}/my-role") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAccess(appId, user)

            val role = AppAccessRepository.getUserRole(appId, UUID.fromString(user.id))
                ?: throw NotFoundException("Access not found")

            call.respond(mapOf("role" to role))
        }

        // --- Versions ---

        get("/{id}/versions") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAccess(appId, user)

            val versions = VersionRepository.findByAppId(appId)
            call.respond(versions)
        }

        post("/{id}/versions") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            var versionCode: Long? = null
            var versionName: String? = null
            var mappingContent: String? = null

            val multipart = call.receiveMultipart()
            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FormItem -> {
                        when (part.name) {
                            "version_code" -> versionCode = part.value.toLongOrNull()
                            "version_name" -> versionName = part.value.takeIf { it.isNotBlank() }
                        }
                    }
                    is PartData.FileItem -> {
                        if (part.name == "mapping") {
                            @Suppress("DEPRECATION")
                            mappingContent = part.streamProvider().bufferedReader().readText()
                        }
                    }
                    else -> {}
                }
                part.dispose()
            }

            if (versionCode == null) {
                throw BadRequestException("Version code is required")
            }

            val existing = VersionRepository.findByAppAndVersionCode(appId, versionCode!!)
            if (existing != null) {
                throw BadRequestException("Version $versionCode already exists")
            }

            val version = VersionRepository.create(
                appId = appId,
                versionCode = versionCode!!,
                versionName = versionName,
                mappingContent = mappingContent
            )

            call.respond(HttpStatusCode.Created, version)
        }

        put("/{appId}/versions/{versionId}/mapping") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            var mappingContent: String? = null

            val multipart = call.receiveMultipart()
            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        if (part.name == "mapping") {
                            @Suppress("DEPRECATION")
                            mappingContent = part.streamProvider().bufferedReader().readText()
                        }
                    }
                    else -> {}
                }
                part.dispose()
            }

            if (mappingContent.isNullOrBlank()) {
                throw BadRequestException("Mapping file is required")
            }

            val updated = VersionRepository.updateMapping(versionId, mappingContent!!)
            if (!updated) {
                throw NotFoundException("Version not found")
            }

            val version = VersionRepository.findById(versionId)!!
            call.respond(version)
        }

        // Download mapping file
        get("/{appId}/versions/{versionId}/mapping") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAccess(appId, user)

            val version = VersionRepository.findById(versionId)
                ?: throw NotFoundException("Version not found")

            val mappingContent = VersionRepository.getMappingContent(appId, version.versionCode)
                ?: throw NotFoundException("Mapping not found")

            call.response.header(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Attachment.withParameter(
                    ContentDisposition.Parameters.FileName,
                    "mapping-${version.versionCode}.txt"
                ).toString()
            )
            call.respondText(mappingContent, ContentType.Text.Plain)
        }

        // Update version mute settings (legacy, for backwards compatibility)
        put("/{appId}/versions/{versionId}/mute") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<UpdateVersionMuteRequest>()

            val updated = VersionRepository.updateMuteSettings(
                versionId,
                request.muteCrashes,
                request.muteEvents
            )
            if (!updated) {
                throw NotFoundException("Version not found")
            }

            val version = VersionRepository.findById(versionId)!!
            call.respond(version)
        }

        // Update version (release notes, published, mute settings)
        put("/{appId}/versions/{versionId}") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<UpdateVersionRequest>()

            val updated = VersionRepository.update(
                versionId,
                releaseNotes = request.releaseNotes,
                publishedForTesters = request.publishedForTesters,
                muteCrashes = request.muteCrashes,
                muteEvents = request.muteEvents
            )
            if (!updated) {
                throw NotFoundException("Version not found")
            }

            val version = VersionRepository.findById(versionId)!!
            call.respond(version)
        }

        // Upload APK
        put("/{appId}/versions/{versionId}/apk") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            var apkBytes: ByteArray? = null
            var apkFilename: String? = null

            val multipart = call.receiveMultipart()
            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FileItem -> {
                        if (part.name == "apk") {
                            apkFilename = part.originalFileName ?: "app.apk"
                            @Suppress("DEPRECATION")
                            apkBytes = part.streamProvider().readBytes()
                        }
                    }
                    else -> {}
                }
                part.dispose()
            }

            if (apkBytes == null) {
                throw BadRequestException("APK file is required")
            }

            // Check size limit (200MB)
            if (apkBytes!!.size > 200 * 1024 * 1024) {
                throw BadRequestException("APK file exceeds 200MB limit")
            }

            val updated = VersionRepository.uploadApk(versionId, apkBytes!!, apkFilename!!)
            if (!updated) {
                throw NotFoundException("Version not found")
            }

            val version = VersionRepository.findById(versionId)!!
            call.respond(version)
        }

        // Download APK
        get("/{appId}/versions/{versionId}/apk") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAccess(appId, user)

            val apkInfo = VersionRepository.getApkInfo(versionId)
                ?: throw NotFoundException("Version not found")

            if (apkInfo.first == null) {
                throw NotFoundException("APK not found")
            }

            val apkContent = VersionRepository.getApkContent(versionId)
                ?: throw NotFoundException("APK not found")

            val filename = apkInfo.third ?: "app.apk"

            call.response.header(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Attachment.withParameter(
                    ContentDisposition.Parameters.FileName,
                    filename
                ).toString()
            )
            call.respondBytes(apkContent, ContentType.parse("application/vnd.android.package-archive"))
        }

        // Delete APK
        delete("/{appId}/versions/{versionId}/apk") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            val deleted = VersionRepository.deleteApk(versionId)
            if (!deleted) {
                throw NotFoundException("Version not found")
            }

            call.respond(HttpStatusCode.NoContent)
        }

        // Create download link (temporary public link)
        post("/{appId}/versions/{versionId}/download-link") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            // Check if APK exists
            val apkInfo = VersionRepository.getApkInfo(versionId)
            if (apkInfo?.first == null) {
                throw BadRequestException("No APK uploaded for this version")
            }

            val request = try {
                call.receive<CreateDownloadTokenRequest>()
            } catch (e: Exception) {
                CreateDownloadTokenRequest()
            }

            val tokenInfo = DownloadTokenRepository.create(
                appId = appId,
                versionId = versionId,
                expiresInHours = request.expiresInHours
            )

            call.respond(HttpStatusCode.Created, DownloadTokenResponse(
                token = tokenInfo.token,
                downloadUrl = "/api/v1/download/${tokenInfo.token}",
                expiresAt = tokenInfo.expiresAt.toString()
            ))
        }

        // Get published versions for testers (distribution)
        get("/{appId}/distribution") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAccess(appId, user)

            val versions = VersionRepository.findPublishedForTesters(appId)
            call.respond(versions)
        }

        // Get app members for notification dialog
        get("/{appId}/members") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            val accessList = AppAccessRepository.findByAppId(appId)
            val members = accessList.map { access ->
                AppMemberResponse(
                    email = access.userEmail,
                    name = access.userName,
                    role = access.role
                )
            }
            call.respond(members)
        }

        // Notify testers about new version
        post("/{appId}/versions/{versionId}/notify-testers") {
            val user = call.getUser()
            val appId = call.parameters["appId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val versionId = call.parameters["versionId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid version ID")

            call.requireAppAdmin(appId, user)

            if (!EmailService.isConfigured) {
                throw BadRequestException("SMTP is not configured")
            }

            val request = call.receive<NotifyTestersRequest>()
            if (request.emails.isEmpty()) {
                call.respond(NotifyTestersResponse(sent = 0, failed = 0))
                return@post
            }

            val app = AppRepository.findById(appId)
                ?: throw NotFoundException("App not found")

            val version = VersionRepository.findById(versionId)
                ?: throw NotFoundException("Version not found")

            var sent = 0
            var failed = 0

            for (email in request.emails) {
                val success = EmailService.sendNewVersionEmail(
                    toEmail = email,
                    appName = app.name,
                    versionName = version.versionName,
                    versionCode = version.versionCode,
                    releaseNotes = version.releaseNotes
                )
                if (success) {
                    sent++
                } else {
                    failed++
                }
                // Throttle: wait 500ms between emails to avoid overloading SMTP
                if (request.emails.indexOf(email) < request.emails.size - 1) {
                    Thread.sleep(500)
                }
            }

            call.respond(NotifyTestersResponse(sent = sent, failed = failed))
        }
    }
}

private fun String.toUUIDOrNull(): UUID? = try {
    UUID.fromString(this)
} catch (e: IllegalArgumentException) {
    null
}

private fun io.ktor.server.application.ApplicationCall.requireAppAccess(appId: UUID, user: UserResponse) {
    if (!AppAccessRepository.hasAccess(appId, UUID.fromString(user.id))) {
        throw NotFoundException("App not found")  // Hide existence for security
    }
}

private fun io.ktor.server.application.ApplicationCall.requireAppAdmin(appId: UUID, user: UserResponse) {
    if (!AppAccessRepository.isAdmin(appId, UUID.fromString(user.id))) {
        throw ApiException(HttpStatusCode.Forbidden, "forbidden", "Admin access required")
    }
}
