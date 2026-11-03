package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

/**
 * Named API keys, many per app. Only the SHA-256 hash of a key is stored (see
 * [Secrets]), so the value is readable exactly once — in the response that
 * created it.
 */
object ApiKeyRepository {

    /** Ingestion from the SDK: submitting crashes and events. */
    const val SCOPE_SDK = "sdk"

    /** Publishing releases from CI. Never shipped inside an app. */
    const val SCOPE_UPLOAD = "upload"

    val SCOPES = listOf(SCOPE_SDK, SCOPE_UPLOAD)

    private const val PREFIX_LENGTH = 12
    private val usage = UsageThrottle()

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
        val rawKey = Secrets.generate("bnn_")
        val now = OffsetDateTime.now()
        val creator = createdBy?.let { UserRepository.findById(it) }

        val id = ApiKeys.insertAndGetId {
            it[ApiKeys.appId] = appId
            it[ApiKeys.name] = name
            it[ApiKeys.scope] = scope
            it[ApiKeys.keyHash] = Secrets.sha256(rawKey)
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
        if (updated > 0) usage.forget(keyId)
        updated > 0
    }

    fun delete(appId: UUID, keyId: UUID): Boolean = transaction {
        val deleted = ApiKeys.deleteWhere { (ApiKeys.id eq keyId) and (ApiKeys.appId eq appId) } > 0
        if (deleted) usage.forget(keyId)
        deleted
    }

    /** Resolves an `X-API-Key` value to its app. Revoked keys, and keys issued
     *  for a different scope, never match. */
    fun authenticate(rawKey: String, scope: String = SCOPE_SDK): AppResponse? = transaction {
        val row = (ApiKeys innerJoin Apps)
            .selectAll()
            .where {
                (ApiKeys.keyHash eq Secrets.sha256(rawKey)) and
                    (ApiKeys.scope eq scope) and
                    ApiKeys.revokedAt.isNull()
            }
            .singleOrNull()
            ?: return@transaction null

        touch(row[ApiKeys.id].value)

        row.toAppResponse()
    }

    private fun touch(keyId: UUID) {
        if (!usage.shouldTouch(keyId)) return
        ApiKeys.update({ ApiKeys.id eq keyId }) {
            it[lastUsedAt] = OffsetDateTime.now()
        }
    }

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
