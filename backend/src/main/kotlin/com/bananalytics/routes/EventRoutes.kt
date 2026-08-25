package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.DailyActivityResponse
import com.bananalytics.models.SessionVersionStats
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppSessionRepository
import com.bananalytics.repositories.EventRepository
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

fun Route.eventRoutes() {
    // Get unique sessions by version
    get("/apps/{appId}/sessions/unique") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val (fromDate, toDate) = call.dateRange()

        val stats = dbIO { AppSessionRepository.getUniqueSessionsByVersion(appId, fromDate, toDate) }
            .map { SessionVersionStats(it.date, it.versionCode, it.versionName, it.count) }
        call.cacheStatsFor()
        call.respond(stats)
    }

    // Get daily activity: total sessions vs distinct active users
    get("/apps/{appId}/sessions/activity") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val (fromDate, toDate) = call.dateRange()

        val stats = dbIO { AppSessionRepository.getDailyActivity(appId, fromDate, toDate) }
            .map { DailyActivityResponse(it.date, it.sessions, it.users) }
        call.cacheStatsFor()
        call.respond(stats)
    }

    // Get event summary (aggregated by name)
    get("/apps/{appId}/events/summary") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val (fromDate, toDate) = call.dateRange()
        val summary = dbIO { EventRepository.getEventSummary(appId, versionCode, fromDate, toDate) }
        call.cacheStatsFor()
        call.respond(summary)
    }

    // Get available version codes for filtering
    get("/apps/{appId}/events/versions") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val versions = dbIO { EventRepository.getVersionCodes(appId) }
        call.cacheStatsFor()
        call.respond(versions)
    }

    // Get events by name (detail page)
    get("/apps/{appId}/events/by-name/{eventName}") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")
        val eventName = call.parameters["eventName"]
            ?: throw BadRequestException("Event name is required")

        requireAppAccess(appId, user)

        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val pageSize = call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 50
        val fromTime = call.request.queryParameters["from"]?.toOffsetDateTimeOrNull()
        val toTime = call.request.queryParameters["to"]?.toOffsetDateTimeOrNull()

        val result = dbIO {
            EventRepository.findByAppIdAndName(
                appId = appId,
                eventName = eventName,
                versionCode = versionCode,
                fromTime = fromTime,
                toTime = toTime,
                page = page,
                pageSize = pageSize
            )
        }

        call.respond(result)
    }

    // Get event stats (timeline)
    get("/apps/{appId}/events/by-name/{eventName}/stats") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")
        val eventName = call.parameters["eventName"]
            ?: throw BadRequestException("Event name is required")

        requireAppAccess(appId, user)

        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val (fromDate, toDate) = call.dateRange()

        val stats = dbIO { EventRepository.getEventStatsByName(appId, eventName, fromDate, toDate, versionCode) }
        call.cacheStatsFor()
        call.respond(stats)
    }

    // Get version stats for a specific event
    get("/apps/{appId}/events/by-name/{eventName}/versions") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")
        val eventName = call.parameters["eventName"]
            ?: throw BadRequestException("Event name is required")

        requireAppAccess(appId, user)

        val fromTime = call.request.queryParameters["from"]?.toOffsetDateTimeOrNull()
        val toTime = call.request.queryParameters["to"]?.toOffsetDateTimeOrNull()

        val versions = dbIO { EventRepository.getVersionsForEvent(appId, eventName, fromTime, toTime) }
        call.cacheStatsFor()
        call.respond(versions)
    }

    // Get events for an app (legacy, with filters)
    get("/apps/{appId}/events") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val eventName = call.request.queryParameters["name"]
        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val fromTime = call.request.queryParameters["from"]?.toOffsetDateTimeOrNull()
        val toTime = call.request.queryParameters["to"]?.toOffsetDateTimeOrNull()
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val pageSize = call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 50

        val result = dbIO {
            EventRepository.findByAppId(
                appId = appId,
                eventName = eventName,
                versionCode = versionCode,
                fromTime = fromTime,
                toTime = toTime,
                page = page,
                pageSize = pageSize
            )
        }

        call.respond(result)
    }

    // Get distinct event names for an app
    get("/apps/{appId}/events/names") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val names = dbIO { EventRepository.getEventNames(appId) }
        call.respond(names)
    }

    // Get event count for an app
    get("/apps/{appId}/events/count") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val count = dbIO { EventRepository.countByAppId(appId) }
        call.respond(mapOf("count" to count))
    }

    // Get device stats
    get("/apps/{appId}/devices/stats") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val versionCode = call.request.queryParameters["version"]?.toLongOrNull()
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 10
        val fromTime = call.request.queryParameters["from"]?.toOffsetDateTimeOrNull()
        val toTime = call.request.queryParameters["to"]?.toOffsetDateTimeOrNull()

        val stats = dbIO { EventRepository.getDeviceStats(appId, versionCode, limit, fromTime, toTime) }
        call.cacheStatsFor()
        call.respond(stats)
    }
}

private fun String.toUUIDOrNull(): UUID? = try {
    UUID.fromString(this)
} catch (e: IllegalArgumentException) {
    null
}

private suspend fun requireAppAccess(appId: UUID, user: UserResponse) {
    if (!dbIO { AppAccessRepository.hasAccess(appId, UUID.fromString(user.id)) }) {
        throw NotFoundException("App not found")
    }
}
