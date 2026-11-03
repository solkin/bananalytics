package com.bananalytics.config

import com.bananalytics.models.UserResponse
import com.bananalytics.services.AuthService
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.routing.RouteSelectorEvaluation
import io.ktor.server.routing.RouteSelector
import io.ktor.server.routing.RoutingResolveContext
import io.ktor.util.*
import java.net.URI
import java.util.*

object AppConfig {
    val registrationEnabled: Boolean by lazy {
        System.getenv("REGISTRATION_ENABLED")?.lowercase() != "false"
    }

    /** Public origin used for links handed out to people and to CI. */
    val baseUrl: String by lazy {
        // Deployments often leave BASE_URL declared but empty; treat that as unset.
        (System.getenv("BASE_URL")?.takeIf { it.isNotBlank() } ?: "http://localhost:5173")
            .trimEnd('/')
    }

    /**
     * Canonical address of the MCP endpoint, or null when [baseUrl] cannot be
     * one. OAuth clients bind their tokens to this exact URL, so it must be
     * public HTTPS; plain HTTP is accepted only on a loopback host, for
     * development.
     */
    val mcpResourceUrl: String? by lazy {
        val uri = runCatching { URI(baseUrl) }.getOrNull() ?: return@lazy null
        val host = uri.host?.lowercase() ?: return@lazy null
        val secure = uri.scheme == "https" || (uri.scheme == "http" && host in LOOPBACK_HOSTS)
        if (secure && uri.query == null && uri.fragment == null) "$baseUrl/mcp" else null
    }

    private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "[::1]")

    /** Ceiling for a single uploaded APK. */
    val maxApkBytes: Long by lazy {
        val megabytes = System.getenv("MAX_APK_SIZE_MB")?.toLongOrNull()?.takeIf { it in 1..10_000 }
        (megabytes ?: 200L) * 1024 * 1024
    }
}

private val UserKey = AttributeKey<UserResponse>("user")
private const val SESSION_COOKIE = "session"

fun ApplicationCall.getSessionId(): UUID? {
    return request.cookies[SESSION_COOKIE]?.let {
        try {
            UUID.fromString(it)
        } catch (e: IllegalArgumentException) {
            null
        }
    }
}

fun ApplicationCall.setSessionCookie(sessionId: UUID) {
    response.cookies.append(
        Cookie(
            name = SESSION_COOKIE,
            value = sessionId.toString(),
            maxAge = 30 * 24 * 60 * 60, // 30 days
            path = "/",
            httpOnly = true,
            secure = false, // Set to true in production with HTTPS
            extensions = mapOf("SameSite" to "Lax")
        )
    )
}

fun ApplicationCall.clearSessionCookie() {
    response.cookies.append(
        Cookie(
            name = SESSION_COOKIE,
            value = "",
            maxAge = 0,
            path = "/"
        )
    )
}

fun ApplicationCall.setUser(user: UserResponse) {
    attributes.put(UserKey, user)
}

fun ApplicationCall.getUser(): UserResponse {
    return attributes.getOrNull(UserKey)
        ?: throw UnauthorizedException("Not authenticated")
}

fun ApplicationCall.getUserOrNull(): UserResponse? {
    return attributes.getOrNull(UserKey)
}

/** Resolves the session cookie to a user before any handler below it runs. */
private val SessionAuthentication = createRouteScopedPlugin("SessionAuthentication") {
    onCall { call ->
        val sessionId = call.getSessionId() ?: throw UnauthorizedException("Not authenticated")

        val user = dbIO { AuthService.getUserBySession(sessionId) }
        if (user == null) {
            call.clearSessionCookie()
            throw UnauthorizedException("Session expired")
        }

        call.setUser(user)
        // Extend session on activity
        dbIO { AuthService.extendSession(sessionId) }
    }
}

fun Route.authenticated(build: Route.() -> Unit): Route {
    // Create a child route for authenticated endpoints
    val authenticatedRoute = createChild(object : RouteSelector() {
        override suspend fun evaluate(context: RoutingResolveContext, segmentIndex: Int): RouteSelectorEvaluation {
            return RouteSelectorEvaluation.Transparent
        }
    })

    authenticatedRoute.install(SessionAuthentication)
    authenticatedRoute.build()
    return authenticatedRoute
}
