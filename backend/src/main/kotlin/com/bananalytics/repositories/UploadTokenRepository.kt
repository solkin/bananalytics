package com.bananalytics.repositories

import com.bananalytics.models.UploadTokens
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNull
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.Duration
import java.time.OffsetDateTime
import java.util.*

/** The file an upload token accepts. */
enum class UploadKind(val wire: String) {
    MAPPING("mapping"),
    APK("apk");

    companion object {
        val WIRE = entries.map { it.wire }
        fun fromWire(value: String): UploadKind? = entries.firstOrNull { it.wire == value }
    }
}

/** What a claimed token lets its bearer upload, on behalf of [createdBy]. */
data class UploadGrant(
    val appId: UUID,
    val versionId: UUID,
    val kind: UploadKind,
    val createdBy: UUID
)

data class CreatedUploadToken(val token: String, val expiresAt: OffsetDateTime)

object UploadTokenRepository {

    private const val TOKEN_PREFIX = "bnu_"

    /** Long enough to find the file, short enough not to linger in a transcript. */
    val LIFETIME: Duration = Duration.ofHours(1)

    /** Returns the plaintext token, which exists nowhere else afterwards. */
    fun create(appId: UUID, versionId: UUID, kind: UploadKind, createdBy: UUID): CreatedUploadToken = transaction {
        val now = OffsetDateTime.now()
        // Tokens are short-lived and one-off, so this is all the cleanup they need.
        UploadTokens.deleteWhere { UploadTokens.expiresAt less now }

        val rawToken = Secrets.generate(TOKEN_PREFIX)
        val expiresAt = now.plus(LIFETIME)
        UploadTokens.insert {
            it[tokenHash] = Secrets.sha256(rawToken)
            it[UploadTokens.appId] = appId
            it[UploadTokens.versionId] = versionId
            it[UploadTokens.kind] = kind.wire
            it[UploadTokens.createdBy] = createdBy
            it[UploadTokens.expiresAt] = expiresAt
            it[createdAt] = now
        }
        CreatedUploadToken(rawToken, expiresAt)
    }

    /**
     * Marks the token used and returns what it grants, or null when it is unknown, expired
     * or already used. The update is the claim, so two concurrent uploads with
     * one token can never both pass.
     */
    fun claim(rawToken: String): UploadGrant? = transaction {
        val now = OffsetDateTime.now()
        val hash = Secrets.sha256(rawToken)
        val claimed = UploadTokens.update({
            (UploadTokens.tokenHash eq hash) and UploadTokens.usedAt.isNull() and (UploadTokens.expiresAt greater now)
        }) {
            it[usedAt] = now
        }
        if (claimed == 0) return@transaction null

        UploadTokens.selectAll().where { UploadTokens.tokenHash eq hash }.single().let { row ->
            UploadGrant(
                appId = row[UploadTokens.appId].value,
                versionId = row[UploadTokens.versionId].value,
                kind = UploadKind.fromWire(row[UploadTokens.kind]) ?: error("Unknown upload kind ${row[UploadTokens.kind]}"),
                createdBy = row[UploadTokens.createdBy].value
            )
        }
    }
}
