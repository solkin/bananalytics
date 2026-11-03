package com.bananalytics.routes

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.dbIO
import com.bananalytics.config.getUser
import com.bananalytics.config.toUUIDOrNull
import com.bananalytics.models.CreateAccessTokenRequest
import com.bananalytics.repositories.AccessTokenRepository
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.time.OffsetDateTime
import java.util.*

private const val MAX_TOKEN_LIFETIME_DAYS = 365

/** The signed-in person's own access tokens, used by agents on the MCP endpoint. */
fun Route.tokenRoutes() {
    route("/tokens") {
        get {
            val userId = UUID.fromString(call.getUser().id)
            call.respond(dbIO { AccessTokenRepository.findByUserId(userId) })
        }

        // Create a token — the only time its value is returned
        post {
            val userId = UUID.fromString(call.getUser().id)
            val request = call.receive<CreateAccessTokenRequest>()

            val name = request.name.trim()
            if (name.isBlank()) {
                throw BadRequestException("Name is required")
            }
            if (name.length > 100) {
                throw BadRequestException("Name must be 100 characters or shorter")
            }
            val write = when (request.access) {
                "read" -> false
                "write" -> true
                else -> throw BadRequestException("Access must be 'read' or 'write'")
            }
            val days = request.expiresInDays
            if (days != null && days !in 1..MAX_TOKEN_LIFETIME_DAYS) {
                throw BadRequestException("Lifetime must be between 1 and $MAX_TOKEN_LIFETIME_DAYS days")
            }

            val created = dbIO {
                AccessTokenRepository.create(
                    userId = userId,
                    name = name,
                    scopes = AccessTokenRepository.scopesFor(write),
                    expiresAt = days?.let { OffsetDateTime.now().plusDays(it.toLong()) }
                )
            }
            call.respond(HttpStatusCode.Created, created)
        }

        // Revoke a token — stops working immediately, stays in the list
        post("/{tokenId}/revoke") {
            val userId = UUID.fromString(call.getUser().id)
            val tokenId = call.parameters["tokenId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid token ID")

            if (!dbIO { AccessTokenRepository.revoke(userId, tokenId) }) {
                throw NotFoundException("Active access token not found")
            }
            call.respond(HttpStatusCode.NoContent)
        }

        delete("/{tokenId}") {
            val userId = UUID.fromString(call.getUser().id)
            val tokenId = call.parameters["tokenId"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid token ID")

            if (!dbIO { AccessTokenRepository.delete(userId, tokenId) }) {
                throw NotFoundException("Access token not found")
            }
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
