package com.bananalytics.repositories

import com.bananalytics.models.AccessTokenResponse
import com.bananalytics.models.AccessTokens
import com.bananalytics.models.CreatedAccessTokenResponse
import com.bananalytics.models.UserResponse
import com.bananalytics.models.Users
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNull
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

/**
 * How far an agent may go on its owner's behalf; each level includes the ones
 * before it. Within it, the owner's role in each app still decides.
 */
enum class TokenAccess(val wire: String, val scopes: Set<String>) {
    /** Crashes, analytics, releases. */
    READ("read", setOf(AccessTokenRepository.SCOPE_READ)),

    /** Changes that stay inside the app and can be set back or cleaned up. */
    WRITE("write", READ.scopes + AccessTokenRepository.SCOPE_WRITE),

    /** Also what reaches people or cannot be undone: access, emails, deletions. */
    MANAGE("manage", WRITE.scopes + AccessTokenRepository.SCOPE_MANAGE);

    companion object {
        fun fromWire(value: String): TokenAccess? = entries.firstOrNull { it.wire == value }

        /** The highest level [scopes] name, each implying those below; unknown scopes add nothing. */
        fun of(scopes: Set<String>): TokenAccess = when {
            AccessTokenRepository.SCOPE_MANAGE in scopes -> MANAGE
            AccessTokenRepository.SCOPE_WRITE in scopes -> WRITE
            else -> READ
        }
    }
}

/** Who an access token speaks for, and what it may do on their behalf. */
data class TokenPrincipal(
    val user: UserResponse,
    val tokenId: UUID,
    val scopes: Set<String>
) {
    val canWrite: Boolean get() = AccessTokenRepository.SCOPE_WRITE in scopes
    val canManage: Boolean get() = AccessTokenRepository.SCOPE_MANAGE in scopes
}

/**
 * Access tokens belong to a person rather than to an app: an agent holding one
 * sees exactly the apps its owner sees, with the owner's current role in each.
 */
object AccessTokenRepository {

    const val SCOPE_READ = "mcp:read"

    /** Implies [SCOPE_READ]: a token that may change data may also read it. */
    const val SCOPE_WRITE = "mcp:write"

    /** Implies [SCOPE_WRITE]. */
    const val SCOPE_MANAGE = "mcp:manage"

    private const val TOKEN_PREFIX = "bnp_"
    private const val PREFIX_LENGTH = 12
    private val usage = UsageThrottle()

    /** Personal tokens only; those of OAuth clients are managed as grants. */
    fun findByUserId(userId: UUID): List<AccessTokenResponse> = transaction {
        AccessTokens.selectAll()
            .where { (AccessTokens.userId eq userId) and AccessTokens.grantId.isNull() }
            .orderBy(AccessTokens.createdAt, SortOrder.DESC)
            .map { it.toAccessTokenResponse() }
    }

    /** Returns the stored token plus its plaintext value, which the caller must
     *  hand to the user right away — it cannot be recovered later. */
    fun create(
        userId: UUID,
        name: String,
        scopes: Set<String>,
        expiresAt: OffsetDateTime?,
        grantId: UUID? = null
    ): CreatedAccessTokenResponse = transaction {
        val rawToken = Secrets.generate(TOKEN_PREFIX)
        val now = OffsetDateTime.now()

        val id = AccessTokens.insertAndGetId {
            it[AccessTokens.userId] = userId
            it[AccessTokens.name] = name
            it[AccessTokens.scope] = scopes.sorted().joinToString(" ")
            it[AccessTokens.tokenHash] = Secrets.sha256(rawToken)
            it[AccessTokens.tokenPrefix] = rawToken.take(PREFIX_LENGTH)
            it[AccessTokens.expiresAt] = expiresAt
            it[AccessTokens.createdAt] = now
            it[AccessTokens.grantId] = grantId
        }

        CreatedAccessTokenResponse(
            token = AccessTokens.selectAll().where { AccessTokens.id eq id }.single().toAccessTokenResponse(),
            accessToken = rawToken
        )
    }

    /** Soft revoke: the token stops authenticating but stays listed, so its
     *  owner can still see when it was last used. */
    fun revoke(userId: UUID, tokenId: UUID): Boolean = transaction {
        val updated = AccessTokens.update({
            (AccessTokens.id eq tokenId) and (AccessTokens.userId eq userId) and
                AccessTokens.grantId.isNull() and AccessTokens.revokedAt.isNull()
        }) {
            it[revokedAt] = OffsetDateTime.now()
        }
        if (updated > 0) usage.forget(tokenId)
        updated > 0
    }

    fun delete(userId: UUID, tokenId: UUID): Boolean = transaction {
        val deleted = AccessTokens.deleteWhere {
            (AccessTokens.id eq tokenId) and (AccessTokens.userId eq userId) and AccessTokens.grantId.isNull()
        } > 0
        if (deleted) usage.forget(tokenId)
        deleted
    }

    /** Resolves a bearer value to its owner. Revoked and expired tokens never match. */
    fun authenticate(rawToken: String): TokenPrincipal? = transaction {
        val now = OffsetDateTime.now()
        val row = (AccessTokens innerJoin Users)
            .selectAll()
            .where {
                (AccessTokens.tokenHash eq Secrets.sha256(rawToken)) and
                    AccessTokens.revokedAt.isNull() and
                    (AccessTokens.expiresAt.isNull() or (AccessTokens.expiresAt greater now))
            }
            .singleOrNull()
            ?: return@transaction null

        val tokenId = row[AccessTokens.id].value
        if (usage.shouldTouch(tokenId)) {
            AccessTokens.update({ AccessTokens.id eq tokenId }) { it[lastUsedAt] = now }
        }

        TokenPrincipal(
            user = row.toUserResponse(),
            tokenId = tokenId,
            scopes = row[AccessTokens.scope].split(' ').filter { it.isNotEmpty() }.toSet()
        )
    }

    private fun ResultRow.toAccessTokenResponse() = AccessTokenResponse(
        id = this[AccessTokens.id].value.toString(),
        name = this[AccessTokens.name],
        scope = this[AccessTokens.scope],
        tokenPrefix = this[AccessTokens.tokenPrefix],
        expiresAt = this[AccessTokens.expiresAt]?.toString(),
        lastUsedAt = this[AccessTokens.lastUsedAt]?.toString(),
        revokedAt = this[AccessTokens.revokedAt]?.toString(),
        createdAt = this[AccessTokens.createdAt].toString()
    )
}
