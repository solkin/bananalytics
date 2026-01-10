package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.UpdateCrashGroupRequest
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.CrashRepository
import com.bananalytics.services.CrashService
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

fun Route.crashRoutes() {
    // Get crash stats for an app (timeline)
    get("/apps/{appId}/crashes/stats") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val fromParam = call.request.queryParameters["from"]
        val toParam = call.request.queryParameters["to"]
        
        val now = java.time.OffsetDateTime.now()
        val toDate = if (toParam != null) {
            java.time.OffsetDateTime.parse(toParam)
        } else {
            now
        }
        val fromDate = if (fromParam != null) {
            java.time.OffsetDateTime.parse(fromParam)
        } else {
            now.minusDays(14)
        }

        val stats = CrashRepository.getCrashStatsByAppId(appId, fromDate, toDate)
        call.respond(stats)
    }

    // Get available version codes for filtering
    get("/apps/{appId}/crashes/versions") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val versions = CrashRepository.getVersionCodes(appId)
        call.respond(versions)
    }

    // Get crash groups for an app
    get("/apps/{appId}/crashes") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val status = call.request.queryParameters["status"]
        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val pageSize = call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 20

        val result = CrashRepository.findGroupsByAppId(appId, status, versionCode, page, pageSize)
        call.respond(result)
    }

    // Get crash stats for a group
    get("/crash-groups/{id}/stats") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val group = CrashRepository.findGroupById(id)
            ?: throw NotFoundException("Crash group not found")

        requireAppAccess(UUID.fromString(group.appId), user)

        val fromParam = call.request.queryParameters["from"]
        val toParam = call.request.queryParameters["to"]
        
        val now = java.time.OffsetDateTime.now()
        val toDate = if (toParam != null) {
            java.time.OffsetDateTime.parse(toParam)
        } else {
            now
        }
        val fromDate = if (fromParam != null) {
            java.time.OffsetDateTime.parse(fromParam)
        } else {
            now.minusDays(30)
        }

        val stats = CrashRepository.getCrashStatsByGroupId(id, fromDate, toDate)
        call.respond(stats)
    }

    // Get crash group details
    get("/crash-groups/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val group = CrashRepository.findGroupById(id)
            ?: throw NotFoundException("Crash group not found")

        requireAppAccess(UUID.fromString(group.appId), user)

        call.respond(group)
    }

    // Update crash group status
    put("/crash-groups/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val group = CrashRepository.findGroupById(id)
            ?: throw NotFoundException("Crash group not found")

        requireAppAccess(UUID.fromString(group.appId), user)

        val request = call.receive<UpdateCrashGroupRequest>()

        if (request.status != null && request.status !in listOf("open", "resolved", "ignored")) {
            throw BadRequestException("Invalid status. Must be: open, resolved, or ignored")
        }

        request.status?.let {
            CrashRepository.updateGroupStatus(id, it)
        }

        val updatedGroup = CrashRepository.findGroupById(id)
            ?: throw NotFoundException("Crash group not found")

        call.respond(updatedGroup)
    }

    // Delete crash group
    delete("/crash-groups/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val group = CrashRepository.findGroupById(id)
            ?: throw NotFoundException("Crash group not found")

        requireAppAdmin(UUID.fromString(group.appId), user)

        val deleted = CrashRepository.deleteGroup(id)
        if (!deleted) {
            throw NotFoundException("Crash group not found")
        }

        call.respond(HttpStatusCode.NoContent)
    }

    // Get crashes in a group
    get("/crash-groups/{id}/crashes") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val group = CrashRepository.findGroupById(id)
            ?: throw NotFoundException("Crash group not found")

        requireAppAccess(UUID.fromString(group.appId), user)

        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val pageSize = call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 20

        val result = CrashRepository.findCrashesByGroupId(id, page, pageSize)
        call.respond(result)
    }

    // Get single crash
    get("/crashes/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash ID")

        val crash = CrashRepository.findCrashById(id)
            ?: throw NotFoundException("Crash not found")

        requireAppAccess(UUID.fromString(crash.appId), user)

        call.respond(crash)
    }

    // Retrace a crash
    post("/crashes/{id}/retrace") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash ID")

        val existingCrash = CrashRepository.findCrashById(id)
            ?: throw NotFoundException("Crash not found")

        requireAppAdmin(UUID.fromString(existingCrash.appId), user)

        val crash = CrashService.retraceCrash(id)
        call.respond(crash)
    }
}

private fun String.toUUIDOrNull(): UUID? = try {
    UUID.fromString(this)
} catch (e: IllegalArgumentException) {
    null
}

private fun requireAppAccess(appId: UUID, user: UserResponse) {
    if (!AppAccessRepository.hasAccess(appId, UUID.fromString(user.id))) {
        throw NotFoundException("App not found")
    }
}

private fun requireAppAdmin(appId: UUID, user: UserResponse) {
    if (!AppAccessRepository.isAdmin(appId, UUID.fromString(user.id))) {
        throw ApiException(HttpStatusCode.Forbidden, "forbidden", "Admin access required")
    }
}
