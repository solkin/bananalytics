package com.bananalytics.repositories

import com.bananalytics.models.AppResponse
import com.bananalytics.models.Apps
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.security.SecureRandom
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

    fun findByApiKey(apiKey: String): AppResponse? = transaction {
        Apps.selectAll()
            .where { Apps.apiKey eq apiKey }
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
        val apiKey = generateApiKey()
        val now = OffsetDateTime.now()

        val id = Apps.insertAndGetId {
            it[Apps.name] = name
            it[Apps.packageName] = packageName
            it[Apps.apiKey] = apiKey
            it[Apps.createdAt] = now
        }

        AppResponse(
            id = id.value.toString(),
            name = name,
            packageName = packageName,
            apiKey = apiKey,
            createdAt = now.toString()
        )
    }

    fun update(id: UUID, name: String?): Boolean = transaction {
        val updated = Apps.update({ Apps.id eq id }) { row ->
            name?.let { row[Apps.name] = it }
        }
        updated > 0
    }

    fun regenerateApiKey(id: UUID): String? = transaction {
        val newKey = generateApiKey()
        val updated = Apps.update({ Apps.id eq id }) {
            it[apiKey] = newKey
        }
        if (updated > 0) newKey else null
    }

    fun delete(id: UUID): Boolean = transaction {
        Apps.deleteWhere { Apps.id eq id } > 0
    }

    private fun generateApiKey(): String {
        val random = SecureRandom()
        val bytes = ByteArray(24)
        random.nextBytes(bytes)
        val randomPart = Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(bytes)
            .take(32)
        return "bnn_$randomPart"
    }

    private fun ResultRow.toAppResponse() = AppResponse(
        id = this[Apps.id].value.toString(),
        name = this[Apps.name],
        packageName = this[Apps.packageName],
        apiKey = this[Apps.apiKey],
        createdAt = this[Apps.createdAt].toString()
    )
}
