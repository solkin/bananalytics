package com.bananalytics.services

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.models.CreatedApiKeyResponse
import com.bananalytics.repositories.ApiKeyRepository
import java.util.UUID

private const val MAX_NAME_LENGTH = 100

object ApiKeyService {

    /** Creates a key; the response is the only time its value is readable. */
    fun create(appId: UUID, name: String, scope: String, createdBy: UUID): CreatedApiKeyResponse {
        val validName = validName(name)
        if (scope !in ApiKeyRepository.SCOPES) {
            throw BadRequestException("Scope must be 'sdk' or 'upload'")
        }
        return ApiKeyRepository.create(appId, validName, createdBy, scope)
    }

    fun rename(appId: UUID, keyId: UUID, name: String) {
        if (!ApiKeyRepository.rename(appId, keyId, validName(name))) {
            throw NotFoundException("API key not found")
        }
    }

    /** Stops the key working at once; it stays listed with its last use. */
    fun revoke(appId: UUID, keyId: UUID) {
        if (!ApiKeyRepository.revoke(appId, keyId)) {
            throw NotFoundException("Active API key not found")
        }
    }

    private fun validName(name: String): String {
        val trimmed = name.trim()
        if (trimmed.isBlank()) throw BadRequestException("Name is required")
        if (trimmed.length > MAX_NAME_LENGTH) {
            throw BadRequestException("Name must be $MAX_NAME_LENGTH characters or shorter")
        }
        return trimmed
    }
}
