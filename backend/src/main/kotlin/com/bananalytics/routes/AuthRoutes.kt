package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.AuthResponse
import com.bananalytics.models.ConfigResponse
import com.bananalytics.models.LoginRequest
import com.bananalytics.models.RegisterRequest
import com.bananalytics.services.AuthService
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.authRoutes() {
    route("/auth") {
        // Get config (registration enabled, etc.)
        get("/config") {
            call.respond(ConfigResponse(registrationEnabled = AppConfig.registrationEnabled))
        }

        // Register
        post("/register") {
            if (!AppConfig.registrationEnabled) {
                throw BadRequestException("Registration is disabled")
            }

            val request = call.receive<RegisterRequest>()
            val (user, sessionId) = AuthService.register(
                email = request.email,
                password = request.password,
                name = request.name
            )

            call.setSessionCookie(sessionId)
            call.respond(HttpStatusCode.Created, AuthResponse(user = user))
        }

        // Login
        post("/login") {
            val request = call.receive<LoginRequest>()
            val (user, sessionId) = AuthService.login(
                email = request.email,
                password = request.password
            )

            call.setSessionCookie(sessionId)
            call.respond(AuthResponse(user = user))
        }

        // Logout
        post("/logout") {
            val sessionId = call.getSessionId()
            if (sessionId != null) {
                AuthService.logout(sessionId)
            }
            call.clearSessionCookie()
            call.respond(HttpStatusCode.NoContent)
        }

        // Get current user
        get("/me") {
            val sessionId = call.getSessionId()
                ?: throw UnauthorizedException("Not authenticated")

            val user = AuthService.getUserBySession(sessionId)
                ?: throw UnauthorizedException("Session expired")

            call.respond(AuthResponse(user = user))
        }
    }
}
