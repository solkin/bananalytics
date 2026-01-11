package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.transactions.transaction
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.*

object InvitationRepository {

    private val secureRandom = SecureRandom()

    fun create(
        email: String,
        appId: UUID,
        role: String,
        invitedBy: UUID,
        expiresInDays: Int = 30
    ): InvitationInfo = transaction {
        val now = OffsetDateTime.now()
        val token = generateToken()
        val expiresAt = now.plusDays(expiresInDays.toLong())

        val id = Invitations.insertAndGetId {
            it[Invitations.email] = email.lowercase()
            it[Invitations.appId] = appId
            it[Invitations.role] = role
            it[Invitations.token] = token
            it[Invitations.invitedBy] = invitedBy
            it[Invitations.expiresAt] = expiresAt
            it[Invitations.createdAt] = now
        }

        InvitationInfo(
            id = id.value,
            email = email.lowercase(),
            appId = appId,
            role = role,
            token = token,
            expiresAt = expiresAt
        )
    }

    fun findByToken(token: String): InvitationInfo? = transaction {
        Invitations.selectAll()
            .where { Invitations.token eq token }
            .singleOrNull()
            ?.toInvitationInfo()
    }

    fun findByEmail(email: String): List<InvitationInfo> = transaction {
        Invitations.selectAll()
            .where { Invitations.email eq email.lowercase() }
            .map { it.toInvitationInfo() }
    }

    fun findByEmailAndApp(email: String, appId: UUID): InvitationInfo? = transaction {
        Invitations.selectAll()
            .where { 
                (Invitations.email eq email.lowercase()) and 
                (Invitations.appId eq appId) 
            }
            .singleOrNull()
            ?.toInvitationInfo()
    }

    fun findByAppId(appId: UUID): List<InvitationResponse> = transaction {
        Invitations.selectAll()
            .where { Invitations.appId eq appId }
            .orderBy(Invitations.createdAt, SortOrder.ASC)
            .map { it.toInvitationResponse() }
    }

    fun delete(id: UUID): Boolean = transaction {
        Invitations.deleteWhere { Invitations.id eq id } > 0
    }

    fun deleteByToken(token: String): Boolean = transaction {
        Invitations.deleteWhere { Invitations.token eq token } > 0
    }

    fun deleteByEmail(email: String): Int = transaction {
        Invitations.deleteWhere { Invitations.email eq email.lowercase() }
    }

    fun deleteByEmailAndApp(email: String, appId: UUID): Boolean = transaction {
        Invitations.deleteWhere { 
            (Invitations.email eq email.lowercase()) and 
            (Invitations.appId eq appId) 
        } > 0
    }

    fun updateRole(id: UUID, role: String): Boolean = transaction {
        Invitations.update({ Invitations.id eq id }) {
            it[Invitations.role] = role
        } > 0
    }

    fun findById(id: UUID): InvitationInfo? = transaction {
        Invitations.selectAll()
            .where { Invitations.id eq id }
            .singleOrNull()
            ?.toInvitationInfo()
    }

    fun deleteExpired(): Int = transaction {
        val now = OffsetDateTime.now()
        Invitations.deleteWhere { Invitations.expiresAt lessEq now }
    }

    fun isValidToken(token: String): Boolean = transaction {
        val now = OffsetDateTime.now()
        Invitations.selectAll()
            .where { 
                (Invitations.token eq token) and 
                (Invitations.expiresAt greaterEq now) 
            }
            .count() > 0
    }

    private fun generateToken(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun ResultRow.toInvitationInfo() = InvitationInfo(
        id = this[Invitations.id].value,
        email = this[Invitations.email],
        appId = this[Invitations.appId].value,
        role = this[Invitations.role],
        token = this[Invitations.token],
        expiresAt = this[Invitations.expiresAt]
    )

    private fun ResultRow.toInvitationResponse() = InvitationResponse(
        id = this[Invitations.id].value.toString(),
        email = this[Invitations.email],
        appId = this[Invitations.appId].value.toString(),
        role = this[Invitations.role],
        createdAt = this[Invitations.createdAt].toString()
    )
}

data class InvitationInfo(
    val id: UUID,
    val email: String,
    val appId: UUID,
    val role: String,
    val token: String,
    val expiresAt: OffsetDateTime
)
