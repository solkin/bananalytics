package com.bananalytics.routes

import com.bananalytics.config.BadRequestException
import com.bananalytics.config.NotFoundException
import com.bananalytics.config.dbIO
import com.bananalytics.repositories.UserRepository
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.*

/** The URL carries the upload time, so what a browser caches cannot go stale. */
private const val AVATAR_CACHE_CONTROL = "private, max-age=86400"

fun Route.userRoutes() {
    route("/users") {
        /**
         * Serve a person's avatar. Everyone signed in sees the people they
         * share an app with, so any authenticated user may read any avatar —
         * the image is the only thing this endpoint discloses.
         */
        get("/{id}/avatar") {
            val userId = call.parameters["id"]?.toUUIDOrNull()
                ?: throw BadRequestException("Invalid user ID")

            val avatar = dbIO { UserRepository.getAvatar(userId) }
                ?: throw NotFoundException("Avatar not found")

            call.response.header(HttpHeaders.CacheControl, AVATAR_CACHE_CONTROL)
            // The content type was taken from the bytes at upload, so there is
            // nothing left for a browser to sniff its way into.
            call.response.header("X-Content-Type-Options", "nosniff")
            call.respondBytes(avatar.bytes, ContentType.parse(avatar.contentType))
        }
    }
}

private fun String.toUUIDOrNull(): UUID? = try {
    UUID.fromString(this)
} catch (e: IllegalArgumentException) {
    null
}
