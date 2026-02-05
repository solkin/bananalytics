package com.bananalytics.repositories

import com.bananalytics.models.AppVersionResponse
import com.bananalytics.models.AppVersions
import com.bananalytics.models.Crashes
import com.bananalytics.models.DownloadTokens
import com.bananalytics.models.Events
import com.bananalytics.models.AppSessions
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
                hasApk = false,
                apkSize = null,
                apkFilename = null,
                apkUploadedAt = null,
                releaseNotes = null,
                publishedForTesters = false,
                muteCrashes = false,
                muteEvents = false,
                createdAt = now.toString()
            )
        }
    }

    fun findPublishedForTesters(appId: UUID): List<AppVersionResponse> = transaction {
        AppVersions.selectAll()
            .where { (AppVersions.appId eq appId) and (AppVersions.publishedForTesters eq true) and (AppVersions.apkPath.isNotNull()) }
            .orderBy(AppVersions.versionCode, SortOrder.DESC)
            .map { it.toVersionResponse() }
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
        mappingContent: String?,
        apkBytes: ByteArray? = null,
        apkFilename: String? = null,
        releaseNotes: String? = null
    ): AppVersionResponse = transaction {
        val now = OffsetDateTime.now()

        // Upload mapping to S3 if provided
        val mappingPath = mappingContent?.let {
            StorageService.uploadMapping(appId.toString(), versionCode, it)
        }

        // Upload APK to S3 if provided
        val apkPath = apkBytes?.let {
            StorageService.uploadApk(appId.toString(), versionCode, it)
        }

        val id = AppVersions.insertAndGetId {
            it[AppVersions.appId] = appId
            it[AppVersions.versionCode] = versionCode
            it[AppVersions.versionName] = versionName
            it[AppVersions.mappingPath] = mappingPath
            it[AppVersions.apkPath] = apkPath
            it[AppVersions.apkSize] = apkBytes?.size?.toLong()
            it[AppVersions.apkFilename] = apkFilename
            it[AppVersions.apkUploadedAt] = if (apkBytes != null) now else null
            it[AppVersions.releaseNotes] = releaseNotes
            it[AppVersions.createdAt] = now
        }

        AppVersionResponse(
            id = id.value.toString(),
            appId = appId.toString(),
            versionCode = versionCode,
            versionName = versionName,
            hasMapping = mappingPath != null,
            hasApk = apkPath != null,
            apkSize = apkBytes?.size?.toLong(),
            apkFilename = apkFilename,
            apkUploadedAt = if (apkBytes != null) now.toString() else null,
            releaseNotes = releaseNotes,
            publishedForTesters = false,
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
        // First get the version info
        val version = transaction {
            AppVersions.selectAll()
                .where { AppVersions.id eq id }
                .singleOrNull()
        } ?: return false

        val appId = version[AppVersions.appId].value
        val versionCode = version[AppVersions.versionCode]

        // Delete files from storage
        StorageService.deleteMapping(appId.toString(), versionCode)
        StorageService.deleteApk(appId.toString(), versionCode)

        return transaction {
            // Delete download tokens for this version
            DownloadTokens.deleteWhere { DownloadTokens.versionId eq id }

            // Delete crashes and recalculate affected crash groups
            CrashRepository.deleteCrashesByVersionId(id)

            // Delete events for this app and version_code
            Events.deleteWhere { (Events.appId eq appId) and (Events.versionCode eq versionCode) }

            // Delete app sessions for this app and version_code
            AppSessions.deleteWhere { (AppSessions.appId eq appId) and (AppSessions.versionCode eq versionCode) }

            // Delete the version record
            AppVersions.deleteWhere { AppVersions.id eq id } > 0
        }
    }

    fun updateMuteSettings(id: UUID, muteCrashes: Boolean?, muteEvents: Boolean?): Boolean = transaction {
        AppVersions.update({ AppVersions.id eq id }) {
            muteCrashes?.let { value -> it[AppVersions.muteCrashes] = value }
            muteEvents?.let { value -> it[AppVersions.muteEvents] = value }
        } > 0
    }

    fun update(
        id: UUID,
        releaseNotes: String? = null,
        publishedForTesters: Boolean? = null,
        muteCrashes: Boolean? = null,
        muteEvents: Boolean? = null
    ): Boolean = transaction {
        AppVersions.update({ AppVersions.id eq id }) {
            releaseNotes?.let { value -> it[AppVersions.releaseNotes] = value }
            publishedForTesters?.let { value -> it[AppVersions.publishedForTesters] = value }
            muteCrashes?.let { value -> it[AppVersions.muteCrashes] = value }
            muteEvents?.let { value -> it[AppVersions.muteEvents] = value }
        } > 0
    }

    fun uploadApk(id: UUID, apkBytes: ByteArray, apkFilename: String): Boolean {
        val version = transaction {
            AppVersions.selectAll()
                .where { AppVersions.id eq id }
                .singleOrNull()
        } ?: return false

        val appId = version[AppVersions.appId].value.toString()
        val versionCode = version[AppVersions.versionCode]

        val apkPath = StorageService.uploadApk(appId, versionCode, apkBytes)

        return transaction {
            AppVersions.update({ AppVersions.id eq id }) {
                it[AppVersions.apkPath] = apkPath
                it[AppVersions.apkSize] = apkBytes.size.toLong()
                it[AppVersions.apkFilename] = apkFilename
                it[AppVersions.apkUploadedAt] = OffsetDateTime.now()
            } > 0
        }
    }

    fun getApkContent(id: UUID): ByteArray? {
        val apkPath = transaction {
            AppVersions.select(AppVersions.apkPath)
                .where { AppVersions.id eq id }
                .singleOrNull()
                ?.get(AppVersions.apkPath)
        }
        return apkPath?.let { StorageService.getApkByKey(it) }
    }

    fun getApkInfo(id: UUID): Triple<String?, Long?, String?>? = transaction {
        AppVersions.select(AppVersions.apkPath, AppVersions.apkSize, AppVersions.apkFilename)
            .where { AppVersions.id eq id }
            .singleOrNull()
            ?.let {
                Triple(it[AppVersions.apkPath], it[AppVersions.apkSize], it[AppVersions.apkFilename])
            }
    }

    fun deleteApk(id: UUID): Boolean {
        val version = transaction {
            AppVersions.selectAll()
                .where { AppVersions.id eq id }
                .singleOrNull()
        }

        version?.let {
            val appId = it[AppVersions.appId].value.toString()
            val versionCode = it[AppVersions.versionCode]
            StorageService.deleteApk(appId, versionCode)
        }

        return transaction {
            AppVersions.update({ AppVersions.id eq id }) {
                it[AppVersions.apkPath] = null
                it[AppVersions.apkSize] = null
                it[AppVersions.apkFilename] = null
                it[AppVersions.apkUploadedAt] = null
            } > 0
        }
    }

    private fun ResultRow.toVersionResponse() = AppVersionResponse(
        id = this[AppVersions.id].value.toString(),
        appId = this[AppVersions.appId].value.toString(),
        versionCode = this[AppVersions.versionCode],
        versionName = this[AppVersions.versionName],
        hasMapping = this[AppVersions.mappingPath] != null,
        hasApk = this[AppVersions.apkPath] != null,
        apkSize = this[AppVersions.apkSize],
        apkFilename = this[AppVersions.apkFilename],
        apkUploadedAt = this[AppVersions.apkUploadedAt]?.toString(),
        releaseNotes = this[AppVersions.releaseNotes],
        publishedForTesters = this[AppVersions.publishedForTesters],
        muteCrashes = this[AppVersions.muteCrashes],
        muteEvents = this[AppVersions.muteEvents],
        createdAt = this[AppVersions.createdAt].toString()
    )
}
