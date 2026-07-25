package com.bananalytics.repositories

import com.bananalytics.models.AppResponse
import com.bananalytics.models.Apps
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

object AppRepository {

    fun findAll(): List<AppResponse> = transaction {
        Apps.selectAll()
            .orderBy(Apps.createdAt, SortOrder.DESC)
            .map { it.toAppResponse() }
    }

    fun findById(id: UUID): AppResponse? = transaction {
        Apps.selectAll()
            .where { Apps.id eq id }
            .singleOrNull()
            ?.toAppResponse()
    }

    fun findByPackageName(packageName: String): AppResponse? = transaction {
        Apps.selectAll()
            .where { Apps.packageName eq packageName }
            .singleOrNull()
            ?.toAppResponse()
    }

    fun create(name: String, packageName: String): AppResponse = transaction {
        val now = OffsetDateTime.now()

        val id = Apps.insertAndGetId {
            it[Apps.name] = name
            it[Apps.packageName] = packageName
            it[Apps.createdAt] = now
        }

        AppResponse(
            id = id.value.toString(),
            name = name,
            packageName = packageName,
            createdAt = now.toString()
        )
    }

    fun update(id: UUID, name: String?): Boolean = transaction {
        val updated = Apps.update({ Apps.id eq id }) { row ->
            name?.let { row[Apps.name] = it }
        }
        updated > 0
    }

    fun delete(id: UUID): Boolean = transaction {
        Apps.deleteWhere { Apps.id eq id } > 0
    }

    private fun ResultRow.toAppResponse() = AppResponse(
        id = this[Apps.id].value.toString(),
        name = this[Apps.name],
        packageName = this[Apps.packageName],
        createdAt = this[Apps.createdAt].toString()
    )
}
