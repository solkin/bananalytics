package com.bananalytics.services

import at.favre.lib.crypto.bcrypt.BCrypt
import com.bananalytics.config.AppConfig
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.InvitationRepository
import com.bananalytics.repositories.SessionRepository
import com.bananalytics.repositories.UserRepository
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

object AuthService {
    private val bcryptHasher = BCrypt.withDefaults()
    private val bcryptVerifier = BCrypt.verifyer()

    fun register(email: String, password: String, name: String?, inviteToken: String? = null): Pair<UserResponse, UUID> {
        if (email.isBlank() || !email.contains("@")) throw BadRequestException("Invalid email")
        if (password.length < 6) throw BadRequestException("Password must be at least 6 characters")
        if (inviteToken == null && !AppConfig.registrationEnabled) {
            throw BadRequestException("Registration is disabled")
        }
        val passwordHash = bcryptHasher.hashToString(12, password.toCharArray())
        return transaction {
            val invitation = inviteToken?.let {
                InvitationRepository.findValidByToken(it, lock = true)
                    ?: throw BadRequestException("Invalid or expired invitation")
            }
            if (invitation != null && !invitation.email.equals(email, ignoreCase = true)) {
                throw BadRequestException("Email does not match invitation")
            }
            if (UserRepository.findByEmail(email) != null) throw BadRequestException("Email already registered")
            val user = UserRepository.create(email, passwordHash, name)
            val userId = UUID.fromString(user.id)
            if (invitation != null) {
                AppAccessRepository.grantAccess(invitation.appId, userId, invitation.role)
                InvitationRepository.delete(invitation.id)
            }
            user to SessionRepository.create(userId)
        }
    }

    fun getEmailFromInviteToken(token: String): String? =
        InvitationRepository.findValidByToken(token)?.email

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

    fun updateProfile(userId: UUID, name: String?): UserResponse {
        UserRepository.update(userId, name?.trim())
        return UserRepository.findById(userId)
            ?: throw UnauthorizedException("User not found")
    }

    fun changePassword(userId: UUID, email: String, currentPassword: String, newPassword: String) {
        if (newPassword.length < 6) {
            throw BadRequestException("Password must be at least 6 characters")
        }
        val hash = UserRepository.getPasswordHash(email)
            ?: throw UnauthorizedException("User not found")
        if (!bcryptVerifier.verify(currentPassword.toCharArray(), hash).verified) {
            throw BadRequestException("Current password is incorrect")
        }
        UserRepository.updatePassword(userId, bcryptHasher.hashToString(12, newPassword.toCharArray()))
    }
}
