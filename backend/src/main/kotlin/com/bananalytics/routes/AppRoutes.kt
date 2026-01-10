package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.*
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.UserRepository
import com.bananalytics.repositories.VersionRepository
import io.ktor.http.*
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

        // List users with access
        get("/{id}/access") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAccess(appId, user)

            val accessList = AppAccessRepository.findByAppId(appId)
            call.respond(accessList)
        }

        // Grant access to user
        post("/{id}/access") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<GrantAccessRequest>()

            if (request.role !in listOf("admin", "viewer")) {
                throw BadRequestException("Role must be 'admin' or 'viewer'")
            }

            val targetUser = UserRepository.findByEmail(request.email)
                ?: throw NotFoundException("User not found with email: ${request.email}")

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
        }

        // Update user access role
        put("/{id}/access/{userId}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val targetUserId = call.parameters["userId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid user ID")

            call.requireAppAdmin(appId, user)

            val request = call.receive<UpdateAccessRequest>()

            if (request.role !in listOf("admin", "viewer")) {
                throw BadRequestException("Role must be 'admin' or 'viewer'")
            }

            // Prevent removing the last admin
            if (request.role == "viewer") {
                val currentRole = AppAccessRepository.getUserRole(appId, targetUserId)
                if (currentRole == "admin" && AppAccessRepository.countAdmins(appId) <= 1) {
                    throw BadRequestException("Cannot remove the last admin")
                }
            }

            val updated = AppAccessRepository.updateRole(appId, targetUserId, request.role)
            if (!updated) {
                throw NotFoundException("Access not found")
            }

            call.respond(HttpStatusCode.NoContent)
        }

        // Revoke access
        delete("/{id}/access/{userId}") {
            val user = call.getUser()
            val appId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid app ID")
            val targetUserId = call.parameters["userId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid user ID")

            call.requireAppAdmin(appId, user)

            // Prevent removing yourself if you're the last admin
            val currentRole = AppAccessRepository.getUserRole(appId, targetUserId)
            if (currentRole == "admin" && AppAccessRepository.countAdmins(appId) <= 1) {
                throw BadRequestException("Cannot remove the last admin")
            }

            val revoked = AppAccessRepository.revokeAccess(appId, targetUserId)
            if (!revoked) {
                throw NotFoundException("Access not found")
            }

            call.respond(HttpStatusCode.NoContent)
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

            val request = call.receive<CreateVersionRequest>()

            val existing = VersionRepository.findByAppAndVersionCode(appId, request.versionCode)
            if (existing != null) {
                throw BadRequestException("Version ${request.versionCode} already exists")
            }

            val version = VersionRepository.create(
                appId = appId,
                versionCode = request.versionCode,
                versionName = request.versionName,
                mappingContent = request.mappingContent
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

            val mappingContent = call.receiveText()
            if (mappingContent.isBlank()) {
                throw BadRequestException("Mapping content is required")
            }

            val updated = VersionRepository.updateMapping(versionId, mappingContent)
            if (!updated) {
                throw NotFoundException("Version not found")
            }

            val version = VersionRepository.findById(versionId)!!
            call.respond(version)
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
