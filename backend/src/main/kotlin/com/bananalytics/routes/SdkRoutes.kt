package com.bananalytics.routes

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.models.CrashesSubmitRequest
import com.bananalytics.models.EventsSubmitRequest
import com.bananalytics.models.SubmitResponse
import com.bananalytics.repositories.AppRepository
import com.bananalytics.services.CrashService
import com.bananalytics.services.EventService
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

fun Route.sdkRoutes() {
    route("/events") {
        post("/submit") {
            val app = call.authenticateByApiKey()
            val request = call.receive<EventsSubmitRequest>()

            if (request.environment.packageName != app.packageName) {
                throw BadRequestException("Package name mismatch")
            }

            val count = EventService.processEvents(
                appId = UUID.fromString(app.id),
                environment = request.environment,
                events = request.events
            )

            call.respond(SubmitResponse(status = 200))
        }
    }

    route("/crashes") {
        post("/submit") {
            val app = call.authenticateByApiKey()
            val request = call.receive<CrashesSubmitRequest>()

            if (request.environment.packageName != app.packageName) {
                throw BadRequestException("Package name mismatch")
            }

            val count = CrashService.processCrashes(
                appId = UUID.fromString(app.id),
                environment = request.environment,
                crashes = request.crashes
            )

            call.respond(SubmitResponse(status = 200))
        }
    }
}

private fun io.ktor.server.application.ApplicationCall.authenticateByApiKey(): com.bananalytics.models.AppResponse {
    val apiKey = request.header("X-API-Key")
        ?: throw UnauthorizedException("Missing X-API-Key header")

    return AppRepository.findByApiKey(apiKey)
        ?: throw UnauthorizedException("Invalid API key")
}
