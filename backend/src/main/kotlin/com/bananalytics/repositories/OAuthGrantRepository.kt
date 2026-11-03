package com.bananalytics.repositories

import com.bananalytics.models.AccessTokens
import com.bananalytics.models.OAuthClients
import com.bananalytics.models.OAuthCodes
import com.bananalytics.models.OAuthGrantResponse
import com.bananalytics.models.OAuthGrants
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.Duration
import java.time.OffsetDateTime
import java.util.*

/** What a client receives for a redeemed code or refresh token. */
data class IssuedTokens(
    val accessToken: String,
    val expiresIn: Long,
    val refreshToken: String,
    val scopes: Set<String>
)

sealed interface Redemption {
    data class Issued(val tokens: IssuedTokens) : Redemption
    /** Unknown, expired, or not issued to this client. */
    data object Invalid : Redemption
    /** Presented a second time: someone else has a copy, so the grant was revoked. */
    data object Replayed : Redemption
}

/**
 * Authorization codes and grants. A grant is one connection between a person
 * and a client; it holds a rotating refresh token and issues short-lived
 * access tokens, which authenticate exactly like personal ones.
 */
object OAuthGrantRepository {
    val CODE_TTL: Duration = Duration.ofMinutes(5)
    val ACCESS_TOKEN_TTL: Duration = Duration.ofHours(1)
    private val REFRESH_TOKEN_TTL: Duration = Duration.ofDays(90)

    /** A client that retries a refresh whose answer it lost is not an attacker. */
    private val REFRESH_RETRY_GRACE: Duration = Duration.ofSeconds(60)

    private const val CODE_PREFIX = "bna_"
    private const val REFRESH_PREFIX = "bnr_"

    fun createCode(clientId: UUID, userId: UUID, redirectUri: String, scopes: Set<String>, codeChallenge: String): String = transaction {
        val now = OffsetDateTime.now()
        // Codes live minutes and grants months; sweeping here keeps both tables small.
        OAuthCodes.deleteWhere { expiresAt less now.minusDays(1) }
        OAuthGrants.deleteWhere { refreshExpiresAt less now }

        val raw = Secrets.generate(CODE_PREFIX)
        OAuthCodes.insert {
            it[codeHash] = Secrets.sha256(raw)
            it[OAuthCodes.clientId] = clientId
            it[OAuthCodes.userId] = userId
            it[OAuthCodes.redirectUri] = redirectUri
            it[scope] = scopes.encode()
            it[OAuthCodes.codeChallenge] = codeChallenge
            it[expiresAt] = now.plus(CODE_TTL)
            it[createdAt] = now
        }
        raw
    }

    /**
     * Redeems a code once. [verifier] checks the PKCE challenge the code was
     * issued with; a failed check leaves the code for the rightful client.
     */
    fun redeemCode(raw: String, clientId: UUID, redirectUri: String, verifier: (challenge: String) -> Boolean): Redemption = transaction {
        val now = OffsetDateTime.now()
        val hash = Secrets.sha256(raw)
        val code = OAuthCodes.selectAll().where { OAuthCodes.codeHash eq hash }.forUpdate().singleOrNull()
            ?: return@transaction Redemption.Invalid

        if (code[OAuthCodes.usedAt] != null) {
            code[OAuthCodes.grantId]?.let { grant -> OAuthGrants.deleteWhere { id eq grant } }
            return@transaction Redemption.Replayed
        }
        if (code[OAuthCodes.expiresAt] < now ||
            code[OAuthCodes.clientId].value != clientId ||
            code[OAuthCodes.redirectUri] != redirectUri ||
            !verifier(code[OAuthCodes.codeChallenge])
        ) return@transaction Redemption.Invalid

        val scopes = code[OAuthCodes.scope].decodeScopes()
        val refresh = Secrets.generate(REFRESH_PREFIX)
        val grantId = OAuthGrants.insertAndGetId {
            it[OAuthGrants.clientId] = clientId
            it[userId] = code[OAuthCodes.userId]
            it[scope] = scopes.encode()
            it[refreshTokenHash] = Secrets.sha256(refresh)
            it[refreshExpiresAt] = now.plus(REFRESH_TOKEN_TTL)
            it[lastUsedAt] = now
            it[createdAt] = now
        }.value
        OAuthCodes.update({ OAuthCodes.codeHash eq hash }) {
            it[usedAt] = now
            it[OAuthCodes.grantId] = grantId
        }
        Redemption.Issued(issueAccessToken(grantId, clientId, code[OAuthCodes.userId].value, scopes, refresh, now))
    }

    /**
     * Rotates a refresh token. [requestedScopes], when given, may only narrow
     * the grant, and narrows just the access token issued now.
     */
    fun refresh(raw: String, clientId: UUID, requestedScopes: Set<String>?): Redemption = transaction {
        val now = OffsetDateTime.now()
        val hash = Secrets.sha256(raw)
        val grant = OAuthGrants.selectAll().where { OAuthGrants.refreshTokenHash eq hash }.forUpdate().singleOrNull()

        if (grant == null) {
            val rotated = OAuthGrants.selectAll().where { OAuthGrants.previousRefreshTokenHash eq hash }.forUpdate().singleOrNull()
                ?: return@transaction Redemption.Invalid
            val rotatedAt = rotated[OAuthGrants.lastUsedAt]
            if (rotatedAt != null && rotatedAt.plus(REFRESH_RETRY_GRACE) > now) return@transaction Redemption.Invalid
            OAuthGrants.deleteWhere { id eq rotated[OAuthGrants.id] }
            return@transaction Redemption.Replayed
        }

        val grantId = grant[OAuthGrants.id].value
        val granted = grant[OAuthGrants.scope].decodeScopes()
        if (grant[OAuthGrants.clientId].value != clientId || grant[OAuthGrants.refreshExpiresAt] < now) {
            return@transaction Redemption.Invalid
        }
        val scopes = requestedScopes ?: granted
        if (!granted.containsAll(scopes)) return@transaction Redemption.Invalid

        val refresh = Secrets.generate(REFRESH_PREFIX)
        OAuthGrants.update({ OAuthGrants.id eq grantId }) {
            it[previousRefreshTokenHash] = hash
            it[refreshTokenHash] = Secrets.sha256(refresh)
            it[refreshExpiresAt] = now.plus(REFRESH_TOKEN_TTL)
            it[lastUsedAt] = now
        }
        AccessTokens.deleteWhere { (AccessTokens.grantId eq grantId) and (expiresAt less now) }
        Redemption.Issued(issueAccessToken(grantId, clientId, grant[OAuthGrants.userId].value, scopes, refresh, now))
    }

    /**
     * RFC 7009: a refresh token ends its whole grant, an access token only
     * itself. Tokens of other clients are left alone.
     */
    fun revoke(raw: String, clientId: UUID) = transaction {
        val hash = Secrets.sha256(raw)
        val deleted = OAuthGrants.deleteWhere { (refreshTokenHash eq hash) and (OAuthGrants.clientId eq clientId) }
        if (deleted == 0) {
            val ownGrants = OAuthGrants.select(OAuthGrants.id).where { OAuthGrants.clientId eq clientId }
            AccessTokens.update({ (AccessTokens.tokenHash eq hash) and (AccessTokens.grantId inSubQuery ownGrants) }) {
                it[revokedAt] = OffsetDateTime.now()
            }
        }
    }

    fun findByUserId(userId: UUID): List<OAuthGrantResponse> = transaction {
        // Access tokens are used between refreshes; the latest of either is when the client was last active.
        val tokenUse = AccessTokens.lastUsedAt.max()
        (OAuthGrants innerJoin OAuthClients leftJoin AccessTokens)
            .select(OAuthGrants.columns + OAuthClients.columns + tokenUse)
            .where { OAuthGrants.userId eq userId }
            .groupBy(OAuthGrants.id, OAuthClients.id)
            .orderBy(OAuthGrants.createdAt, SortOrder.DESC)
            .map {
                OAuthGrantResponse(
                    id = it[OAuthGrants.id].value.toString(),
                    clientName = it[OAuthClients.clientName],
                    clientId = it[OAuthClients.clientId],
                    verified = it[OAuthClients.kind] == OAuthClientRepository.KIND_METADATA,
                    scope = it[OAuthGrants.scope],
                    lastUsedAt = listOfNotNull(it[OAuthGrants.lastUsedAt], it[tokenUse]).maxOrNull()?.toString(),
                    createdAt = it[OAuthGrants.createdAt].toString()
                )
            }
    }

    /** Disconnects a client: its grant goes, and every token issued under it. */
    fun delete(userId: UUID, grantId: UUID): Boolean = transaction {
        OAuthGrants.deleteWhere { (id eq grantId) and (OAuthGrants.userId eq userId) } > 0
    }

    private fun issueAccessToken(
        grantId: UUID,
        clientId: UUID,
        userId: UUID,
        scopes: Set<String>,
        refresh: String,
        now: OffsetDateTime
    ): IssuedTokens {
        val clientName = OAuthClients.select(OAuthClients.clientName).where { OAuthClients.id eq clientId }.single()[OAuthClients.clientName]
        val access = AccessTokenRepository.create(
            userId = userId,
            name = clientName.take(100),
            scopes = scopes,
            expiresAt = now.plus(ACCESS_TOKEN_TTL),
            grantId = grantId
        )
        return IssuedTokens(access.accessToken, ACCESS_TOKEN_TTL.seconds, refresh, scopes)
    }

    private fun Set<String>.encode() = sorted().joinToString(" ")

    private fun String.decodeScopes() = split(' ').filter { it.isNotEmpty() }.toSet()
}
