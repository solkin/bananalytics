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
import java.util.*

object AppConfig {
    val registrationEnabled: Boolean by lazy {
        System.getenv("REGISTRATION_ENABLED")?.lowercase() != "false"
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

fun Route.authenticated(build: Route.() -> Unit): Route {
    // Create a child route for authenticated endpoints
    val authenticatedRoute = createChild(object : RouteSelector() {
        override suspend fun evaluate(context: RoutingResolveContext, segmentIndex: Int): RouteSelectorEvaluation {
            return RouteSelectorEvaluation.Transparent
        }
    })
    
    authenticatedRoute.intercept(ApplicationCallPipeline.Call) {
        val sessionId = call.getSessionId()
        if (sessionId == null) {
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "unauthorized", "message" to "Not authenticated"))
            finish()
            return@intercept
        }

        val user = AuthService.getUserBySession(sessionId)
        if (user == null) {
            call.clearSessionCookie()
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "unauthorized", "message" to "Session expired"))
            finish()
            return@intercept
        }

        call.setUser(user)
        // Extend session on activity
        AuthService.extendSession(sessionId)
    }
    
    authenticatedRoute.build()
    return authenticatedRoute
}
