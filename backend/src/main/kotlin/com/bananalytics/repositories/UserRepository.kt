package com.bananalytics.repositories

import com.bananalytics.models.UserResponse
import com.bananalytics.models.Users
import com.bananalytics.services.StorageService
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File
import java.time.OffsetDateTime
import java.util.*

/**
 * Every repository that reads a user row — directly or out of a join — maps it
 * here, so a field added to the response reaches all of them at once.
 */
internal fun ResultRow.toUserResponse() = UserResponse(
    id = this[Users.id].value.toString(),
    email = this[Users.email],
    name = this[Users.name],
    avatarUrl = avatarUrl(this[Users.id].value, this[Users.avatarPath], this[Users.avatarUpdatedAt]),
    createdAt = this[Users.createdAt].toString()
)

/**
 * Avatars are served by an endpoint rather than straight from the bucket, so
 * the URL of a person never changes on its own. The upload time in the query
 * string is what tells a browser cache that a replaced avatar is a different
 * image — in milliseconds, because two uploads can land in the same second.
 */
internal fun avatarUrl(id: UUID, path: String?, updatedAt: OffsetDateTime?): String? =
    if (path == null) null else "/api/v1/users/$id/avatar?v=${updatedAt?.toInstant()?.toEpochMilli() ?: 0}"

object UserRepository {

    fun findById(id: UUID): UserResponse? = transaction {
        Users.selectAll()
            .where { Users.id eq id }
            .singleOrNull()
            ?.toUserResponse()
    }

    fun findByEmail(email: String): UserResponse? = transaction {
        Users.selectAll()
            .where { Users.email eq email.lowercase() }
            .singleOrNull()
            ?.toUserResponse()
    }

    fun getPasswordHash(email: String): String? = transaction {
        Users.select(Users.passwordHash)
            .where { Users.email eq email.lowercase() }
            .singleOrNull()
            ?.get(Users.passwordHash)
    }

    fun create(email: String, passwordHash: String, name: String?): UserResponse = transaction {
        val now = OffsetDateTime.now()

        val id = Users.insertAndGetId {
            it[Users.email] = email.lowercase()
            it[Users.passwordHash] = passwordHash
            it[Users.name] = name
            it[Users.createdAt] = now
        }

        UserResponse(
            id = id.value.toString(),
            email = email.lowercase(),
            name = name,
            createdAt = now.toString()
        )
    }

    fun update(id: UUID, name: String?): Boolean = transaction {
        Users.update({ Users.id eq id }) { row ->
            name?.let { row[Users.name] = it }
        } > 0
    }

    fun updatePassword(id: UUID, passwordHash: String): Boolean = transaction {
        Users.update({ Users.id eq id }) { it[Users.passwordHash] = passwordHash } > 0
    }

    /**
     * Stores an avatar and points the user at it. As with an app icon, the
     * previous object is dropped only once the row points somewhere else: a
     * format change moves the key, and deleting first would leave the user with
     * an avatar nobody can read if the upload failed.
     */
    fun updateAvatar(id: UUID, file: File, contentType: String): Boolean {
        val row = transaction {
            Users.select(Users.avatarPath).where { Users.id eq id }.singleOrNull()
        } ?: return false
        val previousKey = row[Users.avatarPath]

        val key = StorageService.uploadAvatar(id.toString(), file, contentType)

        val updated = transaction {
            Users.update({ Users.id eq id }) {
                it[avatarPath] = key
                it[avatarContentType] = contentType
                it[avatarUpdatedAt] = OffsetDateTime.now()
            } > 0
        }

        if (updated && previousKey != null && previousKey != key) {
            StorageService.deleteFiles(listOf(previousKey))
        }
        return updated
    }

    /**
     * Clears the avatar. Storage goes first: the two cannot be made atomic, and
     * an unreachable bucket must not leave a person carrying an avatar that
     * refuses to be removed.
     */
    fun deleteAvatar(id: UUID): Boolean {
        val key = transaction {
            Users.select(Users.avatarPath).where { Users.id eq id }.singleOrNull()?.get(Users.avatarPath)
        } ?: return false

        StorageService.deleteFiles(listOf(key))

        return transaction {
            Users.update({ Users.id eq id }) {
                it[avatarPath] = null
                it[avatarContentType] = null
                it[avatarUpdatedAt] = null
            } > 0
        }
    }

    fun getAvatar(id: UUID): StoredImage? {
        val row = transaction {
            Users.select(Users.avatarPath, Users.avatarContentType).where { Users.id eq id }.singleOrNull()
        } ?: return null

        val key = row[Users.avatarPath] ?: return null
        val bytes = StorageService.getImage(key) ?: return null

        return StoredImage(bytes, row[Users.avatarContentType] ?: "image/png")
    }
}
