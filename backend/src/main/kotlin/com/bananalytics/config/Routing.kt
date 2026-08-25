package com.bananalytics.config

import com.bananalytics.routes.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

/**
 * Run a blocking Exposed transaction off the request coroutine so slow
 * queries don't stall Ktor worker threads.
 */
suspend fun <T> dbIO(block: () -> T): T = withContext(Dispatchers.IO) { block() }

/**
 * Analytics responses tolerate short staleness; let the browser reuse them.
 */
fun ApplicationCall.cacheStatsFor(seconds: Int = 60) {
    response.header(HttpHeaders.CacheControl, "private, max-age=$seconds")
}

fun String.toOffsetDateTimeOrNull(): OffsetDateTime? = try {
    OffsetDateTime.parse(this)
} catch (e: DateTimeParseException) {
    null
}

/**
 * The from/to window every analytics endpoint accepts. Both ends are optional
 * and fall back to the last [defaultDays] days, so a page that filters by
 * period can pass the same range to all of its queries.
 */
fun ApplicationCall.dateRange(defaultDays: Long = 14): Pair<OffsetDateTime, OffsetDateTime> {
    val now = OffsetDateTime.now()
    return (request.queryParameters["from"]?.toOffsetDateTimeOrNull() ?: now.minusDays(defaultDays)) to
        (request.queryParameters["to"]?.toOffsetDateTimeOrNull() ?: now)
}

fun Application.configureRouting() {
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader("X-API-Key")
        allowCredentials = true
        
        // For development
        allowHost("localhost:3177")
        allowHost("localhost:3000")
        allowHost("127.0.0.1:3177")
        allowHost("127.0.0.1:3000")
        
        // For production (behind reverse proxy, same origin)
        anyHost()
    }

    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        route("/api/v1") {
            // Public routes
            authRoutes()
            downloadRoutes()
            
            // SDK routes (authenticated by API key)
            sdkRoutes()

            // Release publishing from CI (authenticated by an upload-scoped API key)
            releaseRoutes()
            
            // Admin routes (authenticated by session)
            authenticated {
                userRoutes()
                appRoutes()
                crashRoutes()
                eventRoutes()
            }
        }
    }
}
