package com.bananalytics.repositories

import com.bananalytics.models.AppVersionResponse
import com.bananalytics.models.AppVersions
import com.bananalytics.services.StorageService
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

object VersionRepository {

    fun findByAppId(appId: UUID): List<AppVersionResponse> = transaction {
        AppVersions.selectAll()
            .where { AppVersions.appId eq appId }
            .orderBy(AppVersions.versionCode, SortOrder.DESC)
            .map { it.toVersionResponse() }
    }

    fun findById(id: UUID): AppVersionResponse? = transaction {
        AppVersions.selectAll()
            .where { AppVersions.id eq id }
            .singleOrNull()
            ?.toVersionResponse()
    }

    fun findByAppAndVersionCode(appId: UUID, versionCode: Long): AppVersionResponse? = transaction {
        AppVersions.selectAll()
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode eq versionCode) }
            .singleOrNull()
            ?.toVersionResponse()
    }

    fun findOrCreate(
        appId: UUID,
        versionCode: Long,
        versionName: String?
    ): AppVersionResponse = transaction {
        val existing = AppVersions.selectAll()
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode eq versionCode) }
            .singleOrNull()
            ?.toVersionResponse()

        existing ?: run {
            val now = OffsetDateTime.now()
            val id = AppVersions.insertAndGetId {
                it[AppVersions.appId] = appId
                it[AppVersions.versionCode] = versionCode
                it[AppVersions.versionName] = versionName
                it[AppVersions.mappingPath] = null
                it[AppVersions.createdAt] = now
            }
            AppVersionResponse(
                id = id.value.toString(),
                appId = appId.toString(),
                versionCode = versionCode,
                versionName = versionName,
                hasMapping = false,
                muteCrashes = false,
                muteEvents = false,
                createdAt = now.toString()
            )
        }
    }

    fun getMappingContent(appId: UUID, versionCode: Long): String? {
        val mappingPath = transaction {
            AppVersions.select(AppVersions.mappingPath)
                .where { (AppVersions.appId eq appId) and (AppVersions.versionCode eq versionCode) }
                .singleOrNull()
                ?.get(AppVersions.mappingPath)
        }

        return mappingPath?.let { StorageService.getMappingByKey(it) }
    }

    fun create(
        appId: UUID,
        versionCode: Long,
        versionName: String?,
        mappingContent: String?
    ): AppVersionResponse = transaction {
        val now = OffsetDateTime.now()

        // Upload mapping to S3 if provided
        val mappingPath = mappingContent?.let {
            StorageService.uploadMapping(appId.toString(), versionCode, it)
        }

        val id = AppVersions.insertAndGetId {
            it[AppVersions.appId] = appId
            it[AppVersions.versionCode] = versionCode
            it[AppVersions.versionName] = versionName
            it[AppVersions.mappingPath] = mappingPath
            it[AppVersions.createdAt] = now
        }

        AppVersionResponse(
            id = id.value.toString(),
            appId = appId.toString(),
            versionCode = versionCode,
            versionName = versionName,
            hasMapping = mappingPath != null,
            muteCrashes = false,
            muteEvents = false,
            createdAt = now.toString()
        )
    }

    fun updateMapping(id: UUID, mappingContent: String): Boolean {
        // First get the version to know appId and versionCode
        val version = transaction {
            AppVersions.selectAll()
                .where { AppVersions.id eq id }
                .singleOrNull()
        } ?: return false

        val appId = version[AppVersions.appId].value.toString()
        val versionCode = version[AppVersions.versionCode]

        // Upload to S3
        val mappingPath = StorageService.uploadMapping(appId, versionCode, mappingContent)

        // Update path in database
        return transaction {
            AppVersions.update({ AppVersions.id eq id }) {
                it[AppVersions.mappingPath] = mappingPath
            } > 0
        }
    }

    fun delete(id: UUID): Boolean {
        // First get the version to delete mapping from S3
        val version = transaction {
            AppVersions.selectAll()
                .where { AppVersions.id eq id }
                .singleOrNull()
        }

        version?.let {
            val appId = it[AppVersions.appId].value.toString()
            val versionCode = it[AppVersions.versionCode]
            StorageService.deleteMapping(appId, versionCode)
        }

        return transaction {
            AppVersions.deleteWhere { AppVersions.id eq id } > 0
        }
    }

    fun updateMuteSettings(id: UUID, muteCrashes: Boolean?, muteEvents: Boolean?): Boolean = transaction {
        AppVersions.update({ AppVersions.id eq id }) {
            muteCrashes?.let { value -> it[AppVersions.muteCrashes] = value }
            muteEvents?.let { value -> it[AppVersions.muteEvents] = value }
        } > 0
    }

    private fun ResultRow.toVersionResponse() = AppVersionResponse(
        id = this[AppVersions.id].value.toString(),
        appId = this[AppVersions.appId].value.toString(),
        versionCode = this[AppVersions.versionCode],
        versionName = this[AppVersions.versionName],
        hasMapping = this[AppVersions.mappingPath] != null,
        muteCrashes = this[AppVersions.muteCrashes],
        muteEvents = this[AppVersions.muteEvents],
        createdAt = this[AppVersions.createdAt].toString()
    )
}
