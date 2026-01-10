package com.bananalytics.repositories

import com.bananalytics.models.DownloadTokens
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.transactions.transaction
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.*

data class DownloadTokenInfo(
    val id: UUID,
    val appId: UUID,
    val versionId: UUID,
    val token: String,
    val expiresAt: OffsetDateTime,
    val createdAt: OffsetDateTime
)

object DownloadTokenRepository {

    private val secureRandom = SecureRandom()

    fun create(appId: UUID, versionId: UUID, expiresInHours: Int = 24): DownloadTokenInfo = transaction {
        val now = OffsetDateTime.now()
        val expiresAt = now.plusHours(expiresInHours.toLong())
        val token = generateToken()

        val id = DownloadTokens.insertAndGetId {
            it[DownloadTokens.appId] = appId
            it[DownloadTokens.versionId] = versionId
            it[DownloadTokens.token] = token
            it[DownloadTokens.expiresAt] = expiresAt
            it[DownloadTokens.createdAt] = now
        }

        DownloadTokenInfo(
            id = id.value,
            appId = appId,
            versionId = versionId,
            token = token,
            expiresAt = expiresAt,
            createdAt = now
        )
    }

    fun findByToken(token: String): DownloadTokenInfo? = transaction {
        DownloadTokens.selectAll()
            .where { DownloadTokens.token eq token }
            .singleOrNull()
            ?.let {
                DownloadTokenInfo(
                    id = it[DownloadTokens.id].value,
                    appId = it[DownloadTokens.appId].value,
                    versionId = it[DownloadTokens.versionId].value,
                    token = it[DownloadTokens.token],
                    expiresAt = it[DownloadTokens.expiresAt],
                    createdAt = it[DownloadTokens.createdAt]
                )
            }
    }

    fun findValidByToken(token: String): DownloadTokenInfo? = transaction {
        val now = OffsetDateTime.now()
        DownloadTokens.selectAll()
            .where { (DownloadTokens.token eq token) and (DownloadTokens.expiresAt greaterEq now) }
            .singleOrNull()
            ?.let {
                DownloadTokenInfo(
                    id = it[DownloadTokens.id].value,
                    appId = it[DownloadTokens.appId].value,
                    versionId = it[DownloadTokens.versionId].value,
                    token = it[DownloadTokens.token],
                    expiresAt = it[DownloadTokens.expiresAt],
                    createdAt = it[DownloadTokens.createdAt]
                )
            }
    }

    fun delete(id: UUID): Boolean = transaction {
        DownloadTokens.deleteWhere { DownloadTokens.id eq id } > 0
    }

    fun deleteExpired(): Int = transaction {
        val now = OffsetDateTime.now()
        DownloadTokens.deleteWhere { DownloadTokens.expiresAt lessEq now }
    }

    private fun generateToken(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
