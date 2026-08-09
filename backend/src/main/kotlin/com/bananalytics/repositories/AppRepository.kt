package com.bananalytics.repositories

import com.bananalytics.models.AppResponse
import com.bananalytics.models.Apps
import com.bananalytics.models.Events
import com.bananalytics.services.StorageService
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import java.time.OffsetDateTime
import java.util.*

object AppRepository {
    private val logger = LoggerFactory.getLogger(AppRepository::class.java)

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

    /**
     * Every app-scoped table cascades from `apps` except `events` and its
     * `device_stats_daily` rollup: neither carries a foreign key, so an app
     * deletion leaves their rows behind forever. Clear both here, in the same
     * transaction that drops the app.
     *
     * The APKs and mappings of every version go too, and — as in
     * VersionRepository.delete — storage goes first: the two cannot be made
     * atomic, and an unreachable bucket must not leave an app that refuses to
     * be deleted. Objects nobody points at are the cheaper failure.
     */
    fun delete(id: UUID): Boolean {
        val exists = transaction {
            !Apps.select(Apps.id).where { Apps.id eq id }.empty()
        }
        if (!exists) return false

        val storageStartedAt = System.nanoTime()
        StorageService.deleteAppFiles(id.toString())
        val storageDurationMs = (System.nanoTime() - storageStartedAt) / 1_000_000

        val databaseStartedAt = System.nanoTime()
        val deleted = transaction {
            if (Apps.deleteWhere { Apps.id eq id } == 0) return@transaction false

            Events.deleteWhere { Events.appId eq id }
            exec("DELETE FROM device_stats_daily WHERE app_id = '$id'::uuid")
            true
        }
        val databaseDurationMs = (System.nanoTime() - databaseStartedAt) / 1_000_000

        logger.info(
            "Deleted app {}: storage={}ms, database={}ms",
            id, storageDurationMs, databaseDurationMs
        )
        return deleted
    }

    private fun ResultRow.toAppResponse() = AppResponse(
        id = this[Apps.id].value.toString(),
        name = this[Apps.name],
        packageName = this[Apps.packageName],
        createdAt = this[Apps.createdAt].toString()
    )
}
