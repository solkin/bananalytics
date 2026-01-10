package com.bananalytics.repositories

import com.bananalytics.models.Sessions
import com.bananalytics.models.UserResponse
import com.bananalytics.models.Users
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

object SessionRepository {

    private const val SESSION_DURATION_DAYS = 30L

    fun create(userId: UUID): UUID = transaction {
        val now = OffsetDateTime.now()
        val expiresAt = now.plusDays(SESSION_DURATION_DAYS)

        Sessions.insertAndGetId {
            it[Sessions.userId] = userId
            it[Sessions.expiresAt] = expiresAt
            it[Sessions.createdAt] = now
        }.value
    }

    fun findUserBySessionId(sessionId: UUID): UserResponse? = transaction {
        val now = OffsetDateTime.now()

        (Sessions innerJoin Users)
            .selectAll()
            .where { (Sessions.id eq sessionId) and (Sessions.expiresAt greater now) }
            .singleOrNull()
            ?.let {
                UserResponse(
                    id = it[Users.id].value.toString(),
                    email = it[Users.email],
                    name = it[Users.name],
                    createdAt = it[Users.createdAt].toString()
                )
            }
    }

    fun delete(sessionId: UUID): Boolean = transaction {
        Sessions.deleteWhere { Sessions.id eq sessionId } > 0
    }

    fun deleteByUserId(userId: UUID): Int = transaction {
        Sessions.deleteWhere { Sessions.userId eq userId }
    }

    fun deleteExpired(): Int = transaction {
        val now = OffsetDateTime.now()
        Sessions.deleteWhere { expiresAt less now }
    }

    fun extend(sessionId: UUID): Boolean = transaction {
        val expiresAt = OffsetDateTime.now().plusDays(SESSION_DURATION_DAYS)
        Sessions.update({ Sessions.id eq sessionId }) {
            it[Sessions.expiresAt] = expiresAt
        } > 0
    }
}
