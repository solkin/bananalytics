package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Named API keys, many per app. Only the SHA-256 hash of a key is stored, so
 * the value is readable exactly once — in the response that created it.
 *
 * A plain digest (not bcrypt) is deliberate: keys are 192 bits of randomness,
 * so brute force is not the threat model, and the hash sits on the hot path of
 * every SDK submit.
 */
object ApiKeyRepository {

    /** Ingestion from the SDK: submitting crashes and events. */
    const val SCOPE_SDK = "sdk"

    /** Publishing releases from CI. Never shipped inside an app. */
    const val SCOPE_UPLOAD = "upload"

    val SCOPES = listOf(SCOPE_SDK, SCOPE_UPLOAD)

    private const val PREFIX_LENGTH = 12
    private val secureRandom = SecureRandom()

    /** How stale `last_used_at` may get. Keeps ingestion from writing to the
     *  keys table on every single request. */
    private const val TOUCH_INTERVAL_MS = 5 * 60 * 1000L
    private val touchedAt = ConcurrentHashMap<UUID, Long>()

    fun findByAppId(appId: UUID): List<ApiKeyResponse> = transaction {
        (ApiKeys leftJoin Users)
            .selectAll()
            .where { ApiKeys.appId eq appId }
            .orderBy(ApiKeys.createdAt, SortOrder.DESC)
            .map { it.toApiKeyResponse() }
    }

    /** Returns the stored key plus its plaintext value, which the caller must
     *  hand to the user right away — it cannot be recovered later. */
    fun create(
        appId: UUID,
        name: String,
        createdBy: UUID?,
        scope: String = SCOPE_SDK
    ): CreatedApiKeyResponse = transaction {
        val rawKey = generateKey()
        val now = OffsetDateTime.now()
        val creator = createdBy?.let { UserRepository.findById(it) }

        val id = ApiKeys.insertAndGetId {
            it[ApiKeys.appId] = appId
            it[ApiKeys.name] = name
            it[ApiKeys.scope] = scope
            it[ApiKeys.keyHash] = sha256(rawKey)
            it[ApiKeys.keyPrefix] = rawKey.take(PREFIX_LENGTH)
            it[ApiKeys.createdBy] = createdBy
            it[ApiKeys.createdAt] = now
        }

        CreatedApiKeyResponse(
            key = ApiKeyResponse(
                id = id.value.toString(),
                appId = appId.toString(),
                name = name,
                scope = scope,
                keyPrefix = rawKey.take(PREFIX_LENGTH),
                createdBy = creator?.let { it.name ?: it.email },
                lastUsedAt = null,
                revokedAt = null,
                createdAt = now.toString()
            ),
            apiKey = rawKey
        )
    }

    fun rename(appId: UUID, keyId: UUID, name: String): Boolean = transaction {
        ApiKeys.update({ (ApiKeys.id eq keyId) and (ApiKeys.appId eq appId) }) {
            it[ApiKeys.name] = name
        } > 0
    }

    /** Soft revoke: the key stops authenticating but stays in the list so the
     *  audit trail (who created it, when it was last used) survives. */
    fun revoke(appId: UUID, keyId: UUID): Boolean = transaction {
        val updated = ApiKeys.update({
            (ApiKeys.id eq keyId) and (ApiKeys.appId eq appId) and ApiKeys.revokedAt.isNull()
        }) {
            it[revokedAt] = OffsetDateTime.now()
        }
        if (updated > 0) touchedAt.remove(keyId)
        updated > 0
    }

    fun delete(appId: UUID, keyId: UUID): Boolean = transaction {
        val deleted = ApiKeys.deleteWhere { (ApiKeys.id eq keyId) and (ApiKeys.appId eq appId) } > 0
        if (deleted) touchedAt.remove(keyId)
        deleted
    }

    /** Resolves an `X-API-Key` value to its app. Revoked keys, and keys issued
     *  for a different scope, never match. */
    fun authenticate(rawKey: String, scope: String = SCOPE_SDK): AppResponse? = transaction {
        val row = (ApiKeys innerJoin Apps)
            .selectAll()
            .where {
                (ApiKeys.keyHash eq sha256(rawKey)) and
                    (ApiKeys.scope eq scope) and
                    ApiKeys.revokedAt.isNull()
            }
            .singleOrNull()
            ?: return@transaction null

        touch(row[ApiKeys.id].value)

        AppResponse(
            id = row[Apps.id].value.toString(),
            name = row[Apps.name],
            packageName = row[Apps.packageName],
            createdAt = row[Apps.createdAt].toString()
        )
    }

    private fun touch(keyId: UUID) {
        val now = System.currentTimeMillis()
        val last = touchedAt[keyId]
        if (last != null && now - last < TOUCH_INTERVAL_MS) return
        touchedAt[keyId] = now
        ApiKeys.update({ ApiKeys.id eq keyId }) {
            it[lastUsedAt] = OffsetDateTime.now()
        }
    }

    private fun generateKey(): String {
        val bytes = ByteArray(24)
        secureRandom.nextBytes(bytes)
        val randomPart = Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(bytes)
            .take(32)
        return "bnn_$randomPart"
    }

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    private fun ResultRow.toApiKeyResponse() = ApiKeyResponse(
        id = this[ApiKeys.id].value.toString(),
        appId = this[ApiKeys.appId].value.toString(),
        name = this[ApiKeys.name],
        scope = this[ApiKeys.scope],
        keyPrefix = this[ApiKeys.keyPrefix],
        createdBy = this[ApiKeys.createdBy]?.let { this[Users.name] ?: this[Users.email] },
        lastUsedAt = this[ApiKeys.lastUsedAt]?.toString(),
        revokedAt = this[ApiKeys.revokedAt]?.toString(),
        createdAt = this[ApiKeys.createdAt].toString()
    )
}
