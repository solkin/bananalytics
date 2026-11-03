package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.CrashFreeStatsResponse
import com.bananalytics.models.SessionVersionStats
import com.bananalytics.models.UpdateCrashGroupRequest
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppRepository
import com.bananalytics.repositories.AppSessionRepository
import com.bananalytics.repositories.CrashRepository
import com.bananalytics.services.CrashService
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

fun Route.crashRoutes() {
    // Get crash-free session stats by version
    get("/apps/{appId}/sessions/crash-free") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAnalyticsAccess(appId, user)

        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val (fromDate, toDate) = call.dateRange()

        val stats = dbIO { AppSessionRepository.getCrashFreeStats(appId, fromDate, toDate, versionCode) }
            .map { CrashFreeStatsResponse(it.date, it.totalSessions, it.crashFreeSessions, it.crashFreeRate) }
        call.cacheStatsFor()
        call.respond(stats)
    }

    // Get crash-free stats by version for chart
    get("/apps/{appId}/sessions/crash-free-by-version") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAnalyticsAccess(appId, user)

        val fromParam = call.request.queryParameters["from"]
        val toParam = call.request.queryParameters["to"]
        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        
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

        val stats = dbIO { AppSessionRepository.getCrashFreeStatsByVersion(appId, fromDate, toDate, versionCode) }
            .map { SessionVersionStats(it.date, it.versionCode, it.versionName, it.count) }
        call.cacheStatsFor()
        call.respond(stats)
    }

    // Get crash stats for an app (timeline)
    get("/apps/{appId}/crashes/stats") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAnalyticsAccess(appId, user)

        val fromParam = call.request.queryParameters["from"]
        val toParam = call.request.queryParameters["to"]
        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        
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

        val stats = dbIO { CrashRepository.getCrashStatsByAppId(appId, fromDate, toDate, versionCode) }
        call.cacheStatsFor()
        call.respond(stats)
    }

    // Get available version codes for filtering
    get("/apps/{appId}/crashes/versions") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAnalyticsAccess(appId, user)

        val versions = dbIO { CrashRepository.getVersionCodes(appId) }
        call.respond(versions)
    }

    // Get crash groups for an app
    get("/apps/{appId}/crashes") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAnalyticsAccess(appId, user)

        val status = call.request.queryParameters["status"]
        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val days = call.request.queryParameters["days"]?.toIntOrNull() ?: 28
        val sortBy = call.request.queryParameters["sortBy"]
        val sortOrder = call.request.queryParameters["sortOrder"]
        val page = (call.request.queryParameters["page"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
        val pageSize = (call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 20).coerceIn(1, 100)

        val fromDate = java.time.OffsetDateTime.now().minusDays(days.toLong())
        val result = dbIO { CrashRepository.findGroupsByAppId(appId, status, versionCode, fromDate, sortBy, sortOrder, page, pageSize) }
        call.respond(result)
    }

    // Get crash stats for a group
    get("/crash-groups/{id}/stats") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val appId = dbIO { CrashRepository.findGroupAppId(id) }
            ?: throw NotFoundException("Crash group not found")

        call.requireAnalyticsAccess(appId, user)

        val fromParam = call.request.queryParameters["from"]
        val toParam = call.request.queryParameters["to"]
        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        
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

        val stats = dbIO { CrashRepository.getCrashStatsByGroupId(id, fromDate, toDate, versionCode) }
        call.respond(stats)
    }

    get("/crash-groups/{id}/distributions") {
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")
        val appId = dbIO { CrashRepository.findGroupAppId(id) }
            ?: throw NotFoundException("Crash group not found")
        call.requireAnalyticsAccess(appId)
        val (from, to) = call.dateRange()
        val version = call.request.queryParameters["version"]?.toLongOrNull()
        call.respond(dbIO { CrashRepository.getDistributions(id, from, to, version) })
    }

    // Get crash group details
    get("/crash-groups/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val group = dbIO { CrashRepository.findGroupById(id) }
            ?: throw NotFoundException("Crash group not found")

        call.requireAnalyticsAccess(UUID.fromString(group.appId), user)

        call.respond(group)
    }

    // Get version codes for a crash group
    get("/crash-groups/{id}/versions") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val appId = dbIO { CrashRepository.findGroupAppId(id) }
            ?: throw NotFoundException("Crash group not found")

        call.requireAnalyticsAccess(appId, user)

        val versions = dbIO { CrashRepository.getVersionCodesByGroup(appId, id) }
        call.respond(versions)
    }

    // Update crash group status
    put("/crash-groups/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val appId = dbIO { CrashRepository.findGroupAppId(id) }
            ?: throw NotFoundException("Crash group not found")

        call.requireAppAdmin(appId, user)

        val request = call.receive<UpdateCrashGroupRequest>()

        if (request.status != null && request.status !in listOf("open", "resolved", "ignored")) {
            throw BadRequestException("Invalid status. Must be: open, resolved, or ignored")
        }

        request.status?.let {
            dbIO { CrashRepository.updateGroupStatus(id, it) }
        }

        val updatedGroup = dbIO { CrashRepository.findGroupById(id) }
            ?: throw NotFoundException("Crash group not found")

        call.respond(updatedGroup)
    }

    // Delete crash group
    delete("/crash-groups/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash group ID")

        val appId = dbIO { CrashRepository.findGroupAppId(id) }
            ?: throw NotFoundException("Crash group not found")

        call.requireAppAdmin(appId, user)

        val deleted = dbIO { CrashRepository.deleteGroup(id) }
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

        val appId = dbIO { CrashRepository.findGroupAppId(id) }
            ?: throw NotFoundException("Crash group not found")

        call.requireAnalyticsAccess(appId, user)

        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val days = call.request.queryParameters["days"]?.toIntOrNull()
        val page = (call.request.queryParameters["page"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
        val pageSize = (call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 20).coerceIn(1, 100)

        val fromDate = if (days != null) java.time.OffsetDateTime.now().minusDays(days.toLong()) else null
        val result = dbIO { CrashRepository.findCrashesByGroupId(id, versionCode, fromDate, page, pageSize) }
        call.respond(result)
    }

    // Get single crash
    get("/crashes/{id}") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash ID")

        val crash = dbIO { CrashRepository.findCrashById(id) }
            ?: throw NotFoundException("Crash not found")

        call.requireAnalyticsAccess(UUID.fromString(crash.appId), user)

        call.respond(crash)
    }

    // Retrace a crash
    post("/crashes/{id}/retrace") {
        val user = call.getUser()
        val id = call.parameters["id"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid crash ID")

        val existingCrash = dbIO { CrashRepository.findCrashById(id) }
            ?: throw NotFoundException("Crash not found")

        call.requireAppAdmin(UUID.fromString(existingCrash.appId), user)

        val crash = dbIO { CrashService.retraceCrash(id) }
        call.respond(crash)
    }

    // Migrate crash groups to use normalized fingerprints
    post("/apps/{appId}/maintenance/migrate-fingerprints") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAppAdmin(appId, user)

        val result = dbIO { CrashRepository.migrateToNormalizedFingerprints(appId) }
        call.respond(result)
    }

    // Delete orphaned crashes (crashes from deleted versions)
    post("/apps/{appId}/maintenance/cleanup-orphaned-crashes") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        call.requireAppAdmin(appId, user)

        val result = dbIO { CrashRepository.deleteOrphanedCrashes(appId) }
        call.respond(result)
    }
}
