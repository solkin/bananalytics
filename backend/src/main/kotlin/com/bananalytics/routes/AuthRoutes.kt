package com.bananalytics.routes

import com.bananalytics.config.*
import com.bananalytics.models.*
import com.bananalytics.repositories.UserRepository
import com.bananalytics.services.AuthService
import com.bananalytics.services.EmailService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File
import java.util.*

/** An avatar is a small square image; anything bigger arrived by mistake. */
private const val MAX_AVATAR_BYTES = 1L * 1024 * 1024

/**
 * These routes sit outside the authenticated block — login and registration
 * live here too — so the ones that act on the signed-in person resolve the
 * session themselves.
 */
private fun ApplicationCall.requireSessionUser(): UserResponse {
    val sessionId = getSessionId()
        ?: throw UnauthorizedException("Not authenticated")
    return AuthService.getUserBySession(sessionId)
        ?: throw UnauthorizedException("Session expired")
}

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
            call.respond(AuthResponse(user = call.requireSessionUser()))
        }

        // Update current user's profile (name)
        put("/me") {
            val user = call.requireSessionUser()

            val request = call.receive<UpdateProfileRequest>()
            val updated = AuthService.updateProfile(UUID.fromString(user.id), request.name)
            call.respond(AuthResponse(user = updated))
        }

        // Upload or replace the current user's avatar
        put("/me/avatar") {
            val user = call.requireSessionUser()

            var received: Pair<File, String>? = null

            try {
                val multipart = call.receiveMultipart()
                multipart.forEachPart { part ->
                    when (part) {
                        is PartData.FileItem -> {
                            // Only the first avatar part counts; a second one
                            // would otherwise leave its temp file behind.
                            if (part.name == "avatar" && received == null) {
                                received = part.receiveImage(MAX_AVATAR_BYTES, "Avatar")
                            }
                        }
                        else -> {}
                    }
                    part.dispose()
                }

                val (file, contentType) = received
                    ?: throw BadRequestException("Avatar file is required")

                val userId = UUID.fromString(user.id)
                if (!dbIO { UserRepository.updateAvatar(userId, file, contentType) }) {
                    throw UnauthorizedException("User not found")
                }

                call.respond(AuthResponse(user = UserRepository.findById(userId)!!))
            } finally {
                received?.first?.delete()
            }
        }

        // Remove the avatar — the UI falls back to the generated initial
        delete("/me/avatar") {
            val user = call.requireSessionUser()
            val userId = UUID.fromString(user.id)

            if (!dbIO { UserRepository.deleteAvatar(userId) }) {
                throw NotFoundException("Avatar not found")
            }

            call.respond(AuthResponse(user = UserRepository.findById(userId)!!))
        }

        // Change current user's password
        post("/change-password") {
            val user = call.requireSessionUser()

            val request = call.receive<ChangePasswordRequest>()
            AuthService.changePassword(
                UUID.fromString(user.id),
                user.email,
                request.currentPassword,
                request.newPassword,
            )
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
