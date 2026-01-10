package com.bananalytics.repositories

import com.bananalytics.models.UserResponse
import com.bananalytics.models.Users
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

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

    private fun ResultRow.toUserResponse() = UserResponse(
        id = this[Users.id].value.toString(),
        email = this[Users.email],
        name = this[Users.name],
        createdAt = this[Users.createdAt].toString()
    )
}
