package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.*
import com.bananalytics.repositories.UserRepository
import com.bananalytics.services.AuthService
import com.bananalytics.services.EmailService
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.authRoutes() {
    route("/auth") {
        // Get config (registration enabled, etc.)
        get("/config") {
            call.respond(ConfigResponse(
                registrationEnabled = AppConfig.registrationEnabled,
                smtpConfigured = EmailService.isConfigured
            ))
        }

        // Check if email exists (for invitation flow)
        post("/check-email") {
            val request = call.receive<CheckEmailRequest>()
            val exists = UserRepository.findByEmail(request.email) != null
            call.respond(CheckEmailResponse(
                exists = exists,
                smtpConfigured = EmailService.isConfigured
            ))
        }

        // Get invitation info by token
        get("/invite/{token}") {
            val token = call.parameters["token"]
                ?: throw BadRequestException("Token is required")

            val email = AuthService.getEmailFromInviteToken(token)
                ?: throw NotFoundException("Invalid or expired invitation")

            call.respond(mapOf("email" to email))
        }

        // Register
        post("/register") {
            val request = call.receive<RegisterRequest>()
            
            // Check if registration is allowed
            val hasInvitation = request.inviteToken?.let { 
                AuthService.isValidInviteToken(it) 
            } ?: AuthService.hasValidInvitation(request.email)
            
            if (!AppConfig.registrationEnabled && !hasInvitation) {
                throw BadRequestException("Registration is disabled")
            }

            // If invite token provided, verify email matches
            if (request.inviteToken != null) {
                val inviteEmail = AuthService.getEmailFromInviteToken(request.inviteToken)
                if (inviteEmail != null && inviteEmail.lowercase() != request.email.lowercase()) {
                    throw BadRequestException("Email does not match invitation")
                }
            }

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
