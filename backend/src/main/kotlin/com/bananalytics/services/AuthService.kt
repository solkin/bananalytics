package com.bananalytics.services

import at.favre.lib.crypto.bcrypt.BCrypt
import com.bananalytics.config.BadRequestException
import com.bananalytics.config.UnauthorizedException
import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.SessionRepository
import com.bananalytics.repositories.UserRepository
import java.util.*

object AuthService {

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
        val sessionId = SessionRepository.create(UUID.fromString(user.id))

        return user to sessionId
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
