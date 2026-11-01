package com.bananalytics.config

import com.bananalytics.models.UserResponse
import com.bananalytics.repositories.AppAccessRepository
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import java.util.UUID

suspend fun ApplicationCall.requireAppAccess(appId: UUID, user: UserResponse = getUser()): String =
    dbIO { AppAccessRepository.getUserRole(appId, UUID.fromString(user.id)) }
        ?: throw NotFoundException("App not found")

suspend fun ApplicationCall.requireAnalyticsAccess(appId: UUID, user: UserResponse = getUser()) {
    if (requireAppAccess(appId, user) !in listOf("admin", "viewer")) {
        throw ApiException(HttpStatusCode.Forbidden, "forbidden", "Analytics access required")
    }
}

suspend fun ApplicationCall.requireAppAdmin(appId: UUID, user: UserResponse = getUser()) {
    if (!dbIO { AppAccessRepository.isAdmin(appId, UUID.fromString(user.id)) }) {
        throw ApiException(HttpStatusCode.Forbidden, "forbidden", "Admin access required")
    }
}
