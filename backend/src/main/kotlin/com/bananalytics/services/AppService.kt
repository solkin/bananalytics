package com.bananalytics.services

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.models.AppResponse
import com.bananalytics.repositories.ApiKeyRepository
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.AppRepository
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.UUID

/** Both columns are varchar(255). */
private const val MAX_LENGTH = 255

/** Setting up an app, the same from the web UI and from an agent. */
object AppService {

    /**
     * Creates an app administered by its creator. Every app starts with one SDK
     * key so the integration snippet works right away; the response is the only
     * place its value ever appears.
     */
    fun create(userId: UUID, name: String, packageName: String): AppResponse {
        requireName(name)
        if (packageName.isBlank()) throw BadRequestException("Package name is required")
        if (packageName.length > MAX_LENGTH) throw BadRequestException("Package name must be $MAX_LENGTH characters or shorter")

        return transaction {
            if (AppRepository.findByPackageName(packageName) != null) {
                throw BadRequestException("Package name already exists")
            }
            val app = AppRepository.create(name, packageName)
            val appId = UUID.fromString(app.id)
            AppAccessRepository.grantAccess(appId = appId, userId = userId, role = "admin")
            val defaultKey = ApiKeyRepository.create(appId = appId, name = "Default", createdBy = userId)
            app.copy(apiKey = defaultKey.apiKey)
        }
    }

    fun rename(appId: UUID, name: String): AppResponse {
        requireName(name)
        if (!AppRepository.update(appId, name)) throw NotFoundException("App not found")
        return AppRepository.findById(appId) ?: throw NotFoundException("App not found")
    }

    private fun requireName(name: String) {
        if (name.isBlank()) throw BadRequestException("Name is required")
        if (name.length > MAX_LENGTH) throw BadRequestException("Name must be $MAX_LENGTH characters or shorter")
    }
}
