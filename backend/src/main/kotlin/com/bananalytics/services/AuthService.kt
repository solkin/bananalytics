package com.bananalytics.services

import at.favre.lib.crypto.bcrypt.BCrypt
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.InvitationRepository
import com.bananalytics.repositories.SessionRepository
import com.bananalytics.repositories.UserRepository
import org.slf4j.LoggerFactory
import java.util.*

object AuthService {
    private val logger = LoggerFactory.getLogger(AuthService::class.java)

    private val bcryptHasher = BCrypt.withDefaults()
    private val bcryptVerifier = BCrypt.verifyer()

    fun register(email: String, password: String, name: String?): Pair<UserResponse, UUID> {
        if (email.isBlank() || !email.contains("@")) {
            throw BadRequestException("Invalid email")
        }
        if (password.length < 6) {
            throw BadRequestException("Password must be at least 6 characters")
        }

        val existing = UserRepository.findByEmail(email)
        if (existing != null) {
            throw BadRequestException("Email already registered")
        }

        val passwordHash = bcryptHasher.hashToString(12, password.toCharArray())
        val user = UserRepository.create(email, passwordHash, name)
        val userId = UUID.fromString(user.id)
        val sessionId = SessionRepository.create(userId)

        // Process any pending invitations for this email
        processInvitationsForEmail(email, userId)

        return user to sessionId
    }

    /**
     * Check if there are valid invitations for this email
     * Used to allow registration even when general registration is disabled
     */
    fun hasValidInvitation(email: String): Boolean {
        val invitations = InvitationRepository.findByEmail(email)
        return invitations.isNotEmpty()
    }

    /**
     * Check if invite token is valid
     */
    fun isValidInviteToken(token: String): Boolean {
        return InvitationRepository.isValidToken(token)
    }

    /**
     * Get email from invite token
     */
    fun getEmailFromInviteToken(token: String): String? {
        return InvitationRepository.findByToken(token)?.email
    }

    /**
     * Process all pending invitations for a newly registered user
     */
    private fun processInvitationsForEmail(email: String, userId: UUID) {
        val invitations = InvitationRepository.findByEmail(email)
        
        for (invitation in invitations) {
            try {
                // Grant access to the app
                AppAccessRepository.grantAccess(
                    appId = invitation.appId,
                    userId = userId,
                    role = invitation.role
                )
                logger.info("Granted ${invitation.role} access to app ${invitation.appId} for user $email")
                
                // Delete the invitation
                InvitationRepository.delete(invitation.id)
            } catch (e: Exception) {
                logger.error("Failed to process invitation for $email to app ${invitation.appId}", e)
            }
        }
    }

    fun login(email: String, password: String): Pair<UserResponse, UUID> {
        val passwordHash = UserRepository.getPasswordHash(email)
            ?: throw UnauthorizedException("Invalid email or password")

        val result = bcryptVerifier.verify(password.toCharArray(), passwordHash)
        if (!result.verified) {
            throw UnauthorizedException("Invalid email or password")
        }

        val user = UserRepository.findByEmail(email)
            ?: throw UnauthorizedException("Invalid email or password")

        val sessionId = SessionRepository.create(UUID.fromString(user.id))

        return user to sessionId
    }

    fun logout(sessionId: UUID) {
        SessionRepository.delete(sessionId)
    }

    fun getUserBySession(sessionId: UUID): UserResponse? {
        return SessionRepository.findUserBySessionId(sessionId)
    }

    fun extendSession(sessionId: UUID) {
        SessionRepository.extend(sessionId)
    }
}
