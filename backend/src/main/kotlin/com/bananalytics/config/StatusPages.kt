package com.bananalytics.config

import com.bananalytics.models.OAuthErrorResponse
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

/** An error of the OAuth endpoints, answered in the RFC 6749 shape. */
class OAuthException(
    val error: String,
    val description: String,
    val statusCode: HttpStatusCode = if (error == "invalid_client") HttpStatusCode.Unauthorized else HttpStatusCode.BadRequest
) : RuntimeException(description)

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
        // Ktor's own: a body that is not the JSON a route expects.
        exception<io.ktor.server.plugins.BadRequestException> { call, _ ->
            call.respondError(HttpStatusCode.BadRequest, ErrorResponse("bad_request", "Malformed request body"))
        }
        exception<OAuthException> { call, cause ->
            call.respondText(
                Json.encodeToString(OAuthErrorResponse(cause.error, cause.description)),
                ContentType.Application.Json,
                cause.statusCode
            )
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
