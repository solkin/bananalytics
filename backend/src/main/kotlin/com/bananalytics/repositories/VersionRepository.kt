package com.bananalytics.repositories

import com.bananalytics.models.AppVersionResponse
import com.bananalytics.models.AppVersions
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
                it[AppVersions.mappingContent] = null
                it[AppVersions.createdAt] = now
            }
            AppVersionResponse(
                id = id.value.toString(),
                appId = appId.toString(),
                versionCode = versionCode,
                versionName = versionName,
                hasMapping = false,
                createdAt = now.toString()
            )
        }
    }

    fun getMappingContent(appId: UUID, versionCode: Long): String? = transaction {
        AppVersions.select(AppVersions.mappingContent)
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode eq versionCode) }
            .singleOrNull()
            ?.get(AppVersions.mappingContent)
    }

    fun create(
        appId: UUID,
        versionCode: Long,
        versionName: String?,
        mappingContent: String?
    ): AppVersionResponse = transaction {
        val now = OffsetDateTime.now()

        val id = AppVersions.insertAndGetId {
            it[AppVersions.appId] = appId
            it[AppVersions.versionCode] = versionCode
            it[AppVersions.versionName] = versionName
            it[AppVersions.mappingContent] = mappingContent
            it[AppVersions.createdAt] = now
        }

        AppVersionResponse(
            id = id.value.toString(),
            appId = appId.toString(),
            versionCode = versionCode,
            versionName = versionName,
            hasMapping = mappingContent != null,
            createdAt = now.toString()
        )
    }

    fun updateMapping(id: UUID, mappingContent: String): Boolean = transaction {
        AppVersions.update({ AppVersions.id eq id }) {
            it[AppVersions.mappingContent] = mappingContent
        } > 0
    }

    fun delete(id: UUID): Boolean = transaction {
        AppVersions.deleteWhere { AppVersions.id eq id } > 0
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
        hasMapping = this[AppVersions.mappingContent] != null,
        muteCrashes = this[AppVersions.muteCrashes],
        muteEvents = this[AppVersions.muteEvents],
        createdAt = this[AppVersions.createdAt].toString()
    )
}
