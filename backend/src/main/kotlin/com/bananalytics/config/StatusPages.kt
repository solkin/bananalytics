package com.bananalytics.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ErrorResponse(
    val error: String,
    val message: String
)

open class ApiException(
    val statusCode: HttpStatusCode,
    val error: String,
    override val message: String
) : RuntimeException(message)

class UnauthorizedException(message: String = "Invalid or missing API key") 
    : ApiException(HttpStatusCode.Unauthorized, "unauthorized", message)

class NotFoundException(message: String) 
    : ApiException(HttpStatusCode.NotFound, "not_found", message)

class BadRequestException(message: String)
    : ApiException(HttpStatusCode.BadRequest, "bad_request", message)

class PayloadTooLargeException(message: String)
    : ApiException(HttpStatusCode.PayloadTooLarge, "payload_too_large", message)

/**
 * Errors are encoded here rather than through content negotiation: that is
 * installed per route (see configureSerialization), and these handlers run on
 * the application, outside any route.
 */
private suspend fun ApplicationCall.respondError(status: HttpStatusCode, error: ErrorResponse) =
    respondText(Json.encodeToString(error), ContentType.Application.Json, status)

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<ApiException> { call, cause ->
            call.respondError(cause.statusCode, ErrorResponse(cause.error, cause.message))
        }
        exception<Throwable> { call, cause ->
            call.application.environment.log.error("Unhandled exception", cause)
            call.respondError(
                HttpStatusCode.InternalServerError,
                ErrorResponse("internal_error", "An unexpected error occurred")
            )
        }
    }
}
