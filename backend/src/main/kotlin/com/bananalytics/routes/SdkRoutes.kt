package com.bananalytics.routes

import com.bananalytics.config.dbIO
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.models.CrashesSubmitRequest
import com.bananalytics.models.EventsSubmitRequest
import com.bananalytics.models.SubmitResponse
import com.bananalytics.repositories.ApiKeyRepository
import com.bananalytics.services.CrashService
import com.bananalytics.services.EventService
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory
import java.util.*

private val logger = LoggerFactory.getLogger("SdkRoutes")
private val CONTROL_CHARACTERS = Regex("\\p{Cntrl}")
private const val MAX_LOGGED_PACKAGE_LENGTH = 255

fun Route.sdkRoutes() {
    route("/events") {
        post("/submit") {
            val app = call.authenticateByApiKey()
            val request = call.receive<EventsSubmitRequest>()
            requireMatchingPackage(request.environment.packageName, app)

            val appId = UUID.fromString(app.id)
            
            dbIO { EventService.processEvents(
                appId = appId,
                environment = request.environment,
                events = request.events,
                sessionId = request.sessionId
            ) }

            call.respond(SubmitResponse(status = 200))
        }
    }

    route("/crashes") {
        post("/submit") {
            val app = call.authenticateByApiKey()
            val request = call.receive<CrashesSubmitRequest>()
            requireMatchingPackage(request.environment.packageName, app)

            val appId = UUID.fromString(app.id)
            
            dbIO { CrashService.processCrashes(
                appId = appId,
                environment = request.environment,
                crashes = request.crashes,
                sessionId = request.sessionId
            ) }

            call.respond(SubmitResponse(status = 200))
        }
    }
}

private fun requireMatchingPackage(received: String, app: com.bananalytics.models.AppResponse) {
    if (received == app.packageName) return
    /* The client supplies this value, so it stays on one short log line. */
    val shown = received.take(MAX_LOGGED_PACKAGE_LENGTH).replace(CONTROL_CHARACTERS, "?")
    logger.warn("Rejected SDK submission for ${app.packageName}: client package is $shown")
    throw BadRequestException("Package name mismatch")
}

private suspend fun io.ktor.server.application.ApplicationCall.authenticateByApiKey(): com.bananalytics.models.AppResponse {
    val apiKey = request.header("X-API-Key")
        ?: throw UnauthorizedException("Missing X-API-Key header")

    return dbIO { ApiKeyRepository.authenticate(apiKey) }
        ?: throw UnauthorizedException("Invalid API key")
}
