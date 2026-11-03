package com.bananalytics.config

import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import java.util.UUID

/**
 * Who may do what in an app. Shared by the web API and the MCP endpoint, so an
 * agent can never reach further than its owner could in the browser.
 */
object AppPermissions {
    private val ANALYTICS_ROLES = listOf("admin", "viewer")

    /** The person's role; an app they have no access to does not exist for them. */
    suspend fun requireAccess(appId: UUID, userId: UUID): String =
        dbIO { AppAccessRepository.getUserRole(appId, userId) }
            ?: throw NotFoundException("App not found")

    suspend fun requireAnalytics(appId: UUID, userId: UUID) {
        if (requireAccess(appId, userId) !in ANALYTICS_ROLES) {
            throw ApiException(HttpStatusCode.Forbidden, "forbidden", "Analytics access required")
        }
    }

    suspend fun requireAdmin(appId: UUID, userId: UUID) {
        if (!dbIO { AppAccessRepository.isAdmin(appId, userId) }) {
            throw ApiException(HttpStatusCode.Forbidden, "forbidden", "Admin access required")
        }
    }
}

suspend fun ApplicationCall.requireAppAccess(appId: UUID, user: UserResponse = getUser()): String =
    AppPermissions.requireAccess(appId, UUID.fromString(user.id))

suspend fun ApplicationCall.requireAnalyticsAccess(appId: UUID, user: UserResponse = getUser()) =
    AppPermissions.requireAnalytics(appId, UUID.fromString(user.id))

suspend fun ApplicationCall.requireAppAdmin(appId: UUID, user: UserResponse = getUser()) =
    AppPermissions.requireAdmin(appId, UUID.fromString(user.id))
