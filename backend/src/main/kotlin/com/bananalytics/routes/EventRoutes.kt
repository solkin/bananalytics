package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.EventRepository
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.*

fun Route.eventRoutes() {
    // Get events for an app
    get("/apps/{appId}/events") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val eventName = call.request.queryParameters["name"]
        val fromTime = call.request.queryParameters["from"]?.toOffsetDateTimeOrNull()
        val toTime = call.request.queryParameters["to"]?.toOffsetDateTimeOrNull()
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val pageSize = call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 50

        val result = EventRepository.findByAppId(
            appId = appId,
            eventName = eventName,
            fromTime = fromTime,
            toTime = toTime,
            page = page,
            pageSize = pageSize
        )

        call.respond(result)
    }

    // Get distinct event names for an app
    get("/apps/{appId}/events/names") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val names = EventRepository.getEventNames(appId)
        call.respond(names)
    }

    // Get event count for an app
    get("/apps/{appId}/events/count") {
        val user = call.getUser()
        val appId = call.parameters["appId"]?.toUUIDOrNull()
            ?: throw BadRequestException("Invalid app ID")

        requireAppAccess(appId, user)

        val count = EventRepository.countByAppId(appId)
        call.respond(mapOf("count" to count))
    }
}

private fun String.toUUIDOrNull(): UUID? = try {
    UUID.fromString(this)
} catch (e: IllegalArgumentException) {
    null
}

private fun String.toOffsetDateTimeOrNull(): OffsetDateTime? = try {
    OffsetDateTime.parse(this)
} catch (e: DateTimeParseException) {
    null
}

private fun requireAppAccess(appId: UUID, user: UserResponse) {
    if (!AppAccessRepository.hasAccess(appId, UUID.fromString(user.id))) {
        throw NotFoundException("App not found")
    }
}
