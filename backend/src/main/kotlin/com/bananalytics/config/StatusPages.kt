package com.bananalytics.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable

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

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<ApiException> { call, cause ->
            call.respond(cause.statusCode, ErrorResponse(cause.error, cause.message))
        }
        exception<Throwable> { call, cause ->
            call.application.environment.log.error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse("internal_error", "An unexpected error occurred")
            )
        }
    }
}
