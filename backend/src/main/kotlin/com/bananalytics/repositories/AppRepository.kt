package com.bananalytics.repositories

import com.bananalytics.models.AppResponse
import com.bananalytics.models.Apps
import com.bananalytics.models.Events
import com.bananalytics.services.StorageService
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import java.io.File
import java.time.OffsetDateTime
import java.util.*

/** App icon or user avatar bytes, with the content type they are served as. */
class StoredImage(val bytes: ByteArray, val contentType: String)

/**
 * Every repository that reads an app row — directly or out of a join — maps it
 * here, so a field added to the response reaches all of them at once.
 */
internal fun ResultRow.toAppResponse() = AppResponse(
    id = this[Apps.id].value.toString(),
    name = this[Apps.name],
    packageName = this[Apps.packageName],
    createdAt = this[Apps.createdAt].toString(),
    iconUrl = iconUrl(this[Apps.id].value, this[Apps.iconPath], this[Apps.iconUpdatedAt])
)

/**
 * Icons are served by an endpoint rather than straight from the bucket, so the
 * URL of an app never changes on its own. The upload time in the query string
 * is what tells a browser cache that a replaced icon is a different image —
 * in milliseconds, because two uploads can easily land in the same second.
 */
private fun iconUrl(id: UUID, path: String?, updatedAt: OffsetDateTime?): String? =
    if (path == null) null else "/api/v1/apps/$id/icon?v=${updatedAt?.toInstant()?.toEpochMilli() ?: 0}"

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
     * Stores an icon and points the app at it. The previous object is dropped
     * only once the row points somewhere else — a format change moves the key,
     * and deleting first would leave the app with an icon nobody can read if
     * the upload failed.
     */
    fun updateIcon(id: UUID, file: File, contentType: String): Boolean {
        val row = transaction {
            Apps.select(Apps.iconPath).where { Apps.id eq id }.singleOrNull()
        } ?: return false
        val previousKey = row[Apps.iconPath]

        val key = StorageService.uploadIcon(id.toString(), file, contentType)

        val updated = transaction {
            Apps.update({ Apps.id eq id }) {
                it[iconPath] = key
                it[iconContentType] = contentType
                it[iconUpdatedAt] = OffsetDateTime.now()
            } > 0
        }

        if (updated && previousKey != null && previousKey != key) {
            StorageService.deleteFiles(listOf(previousKey))
        }
        return updated
    }

    /**
     * Clears the icon. Storage goes first, as in [delete]: the two cannot be
     * made atomic, and an unreachable bucket must not leave an app carrying an
     * icon that refuses to be removed.
     */
    fun deleteIcon(id: UUID): Boolean {
        val key = transaction {
            Apps.select(Apps.iconPath).where { Apps.id eq id }.singleOrNull()?.get(Apps.iconPath)
        } ?: return false

        StorageService.deleteFiles(listOf(key))

        return transaction {
            Apps.update({ Apps.id eq id }) {
                it[iconPath] = null
                it[iconContentType] = null
                it[iconUpdatedAt] = null
            } > 0
        }
    }

    fun getIcon(id: UUID): StoredImage? {
        val row = transaction {
            Apps.select(Apps.iconPath, Apps.iconContentType).where { Apps.id eq id }.singleOrNull()
        } ?: return null

        val key = row[Apps.iconPath] ?: return null
        val bytes = StorageService.getImage(key) ?: return null

        return StoredImage(bytes, row[Apps.iconContentType] ?: "image/png")
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
}
