package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

object AppAccessRepository {

    fun findByAppId(appId: UUID): List<AppAccessResponse> = transaction {
        (AppAccess innerJoin Users)
            .selectAll()
            .where { AppAccess.appId eq appId }
            .orderBy(AppAccess.createdAt, SortOrder.ASC)
            .map { it.toAppAccessResponse() }
    }

    fun findByUserId(userId: UUID): List<AppAccessResponse> = transaction {
        (AppAccess innerJoin Users)
            .selectAll()
            .where { AppAccess.userId eq userId }
            .map { it.toAppAccessResponse() }
    }

    fun findUserApps(userId: UUID): List<AppResponse> = transaction {
        (AppAccess innerJoin Apps)
            .selectAll()
            .where { AppAccess.userId eq userId }
            .orderBy(Apps.createdAt, SortOrder.DESC)
            .map {
                AppResponse(
                    id = it[Apps.id].value.toString(),
                    name = it[Apps.name],
                    packageName = it[Apps.packageName],
                    apiKey = it[Apps.apiKey],
                    createdAt = it[Apps.createdAt].toString()
                )
            }
    }

    fun getUserRole(appId: UUID, userId: UUID): String? = transaction {
        AppAccess.select(AppAccess.role)
            .where { (AppAccess.appId eq appId) and (AppAccess.userId eq userId) }
            .singleOrNull()
            ?.get(AppAccess.role)
    }

    fun hasAccess(appId: UUID, userId: UUID): Boolean = transaction {
        AppAccess.selectAll()
            .where { (AppAccess.appId eq appId) and (AppAccess.userId eq userId) }
            .count() > 0
    }

    fun isAdmin(appId: UUID, userId: UUID): Boolean = transaction {
        AppAccess.selectAll()
            .where { 
                (AppAccess.appId eq appId) and 
                (AppAccess.userId eq userId) and 
                (AppAccess.role eq "admin") 
            }
            .count() > 0
    }

    fun grantAccess(appId: UUID, userId: UUID, role: String): AppAccessResponse = transaction {
        val now = OffsetDateTime.now()

        val id = AppAccess.insertAndGetId {
            it[AppAccess.appId] = appId
            it[AppAccess.userId] = userId
            it[AppAccess.role] = role
            it[AppAccess.createdAt] = now
        }

        // Fetch with user info
        (AppAccess innerJoin Users)
            .selectAll()
            .where { AppAccess.id eq id.value }
            .single()
            .toAppAccessResponse()
    }

    fun updateRole(appId: UUID, userId: UUID, role: String): Boolean = transaction {
        AppAccess.update({ (AppAccess.appId eq appId) and (AppAccess.userId eq userId) }) {
            it[AppAccess.role] = role
        } > 0
    }

    fun revokeAccess(appId: UUID, userId: UUID): Boolean = transaction {
        AppAccess.deleteWhere { 
            (AppAccess.appId eq appId) and (AppAccess.userId eq userId) 
        } > 0
    }

    fun countAdmins(appId: UUID): Long = transaction {
        AppAccess.selectAll()
            .where { (AppAccess.appId eq appId) and (AppAccess.role eq "admin") }
            .count()
    }

    private fun ResultRow.toAppAccessResponse() = AppAccessResponse(
        id = this[AppAccess.id].value.toString(),
        appId = this[AppAccess.appId].value.toString(),
        userId = this[AppAccess.userId].value.toString(),
        userEmail = this[Users.email],
        userName = this[Users.name],
        role = this[AppAccess.role],
        createdAt = this[AppAccess.createdAt].toString()
    )
}
