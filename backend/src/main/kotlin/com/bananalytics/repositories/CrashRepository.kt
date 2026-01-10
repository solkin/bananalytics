package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.plus
import org.jetbrains.exposed.sql.transactions.transaction
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.*

object CrashRepository {

    fun findGroupsByAppId(
        appId: UUID,
        status: String? = null,
        versionCode: Long? = null,
        page: Int = 1,
        pageSize: Int = 20
    ): PaginatedResponse<CrashGroupResponse> = transaction {
        // If filtering by version, get group IDs that have crashes with this version
        val groupIdsWithVersion = if (versionCode != null) {
            Crashes.select(Crashes.groupId)
                .where { (Crashes.appId eq appId) and (Crashes.versionCode eq versionCode) }
                .mapNotNull { it[Crashes.groupId]?.value }
                .toSet()
        } else null

        var baseQuery = CrashGroups.selectAll()
            .where { CrashGroups.appId eq appId }

        if (status != null) {
            baseQuery = baseQuery.andWhere { CrashGroups.status eq status }
        }

        if (groupIdsWithVersion != null) {
            baseQuery = baseQuery.andWhere { CrashGroups.id inList groupIdsWithVersion }
        }

        val total = baseQuery.count()
        val items = baseQuery
            .orderBy(CrashGroups.lastSeen, SortOrder.DESC)
            .limit(pageSize).offset(((page - 1) * pageSize).toLong())
            .map { it.toCrashGroupResponse() }

        PaginatedResponse(items, total, page, pageSize)
    }

    fun getVersionCodes(appId: UUID): List<VersionInfo> = transaction {
        val crashVersionCodes = Crashes
            .select(Crashes.versionCode)
            .where { (Crashes.appId eq appId) and Crashes.versionCode.isNotNull() }
            .withDistinct()
            .mapNotNull { it[Crashes.versionCode] }
            .toSet()

        val versionNames = AppVersions
            .select(AppVersions.versionCode, AppVersions.versionName)
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode inList crashVersionCodes) }
            .associate { it[AppVersions.versionCode] to it[AppVersions.versionName] }

        crashVersionCodes.map { code ->
            VersionInfo(
                versionCode = code,
                versionName = versionNames[code]
            )
        }.sortedByDescending { it.versionCode }
    }

    fun findGroupById(id: UUID): CrashGroupResponse? = transaction {
        CrashGroups.selectAll()
            .where { CrashGroups.id eq id }
            .singleOrNull()
            ?.toCrashGroupResponse()
    }

    fun findCrashesByGroupId(
        groupId: UUID,
        page: Int = 1,
        pageSize: Int = 20
    ): PaginatedResponse<CrashResponse> = transaction {
        val baseQuery = Crashes.selectAll().where { Crashes.groupId eq groupId }
        val total = baseQuery.count()
        val items = baseQuery
            .orderBy(Crashes.createdAt, SortOrder.DESC)
            .limit(pageSize).offset(((page - 1) * pageSize).toLong())
            .map { it.toCrashResponse() }

        PaginatedResponse(items, total, page, pageSize)
    }

    fun findCrashById(id: UUID): CrashResponse? = transaction {
        Crashes.selectAll()
            .where { Crashes.id eq id }
            .singleOrNull()
            ?.toCrashResponse()
    }

    fun createCrash(
        appId: UUID,
        versionId: UUID?,
        versionCode: Long?,
        crash: CrashData,
        deviceInfo: DeviceInfo,
        decodedStacktrace: String?,
        decodeError: String?
    ): UUID = transaction {
        val now = OffsetDateTime.now()
        val crashTime = OffsetDateTime.ofInstant(
            Instant.ofEpochMilli(crash.timestamp),
            ZoneOffset.UTC
        )

        // Calculate fingerprint from first few frames
        val fingerprint = calculateFingerprint(crash.stacktrace)
        val (exceptionClass, exceptionMessage) = parseException(crash.stacktrace)

        // Find or create crash group
        val groupId = findOrCreateGroup(
            appId = appId,
            fingerprint = fingerprint,
            exceptionClass = exceptionClass,
            exceptionMessage = exceptionMessage,
            crashTime = crashTime
        )

        Crashes.insertAndGetId {
            it[Crashes.appId] = appId
            it[Crashes.versionId] = versionId
            it[Crashes.groupId] = groupId
            it[Crashes.versionCode] = versionCode
            it[stacktraceRaw] = crash.stacktrace
            it[stacktraceDecoded] = decodedStacktrace
            it[decodedAt] = if (decodedStacktrace != null) now else null
            it[Crashes.decodeError] = decodeError
            it[thread] = crash.thread
            it[isFatal] = crash.isFatal
            it[context] = crash.context.ifEmpty { null }
            it[breadcrumbs] = crash.breadcrumbs.ifEmpty { null }
            it[Crashes.deviceInfo] = deviceInfo
            it[createdAt] = crashTime
        }.value
    }

    fun updateGroupStatus(id: UUID, status: String): Boolean = transaction {
        CrashGroups.update({ CrashGroups.id eq id }) {
            it[CrashGroups.status] = status
        } > 0
    }

    fun deleteGroup(id: UUID): Boolean = transaction {
        // First delete all crashes in the group
        Crashes.deleteWhere { Crashes.groupId eq id }
        // Then delete the group itself
        CrashGroups.deleteWhere { CrashGroups.id eq id } > 0
    }

    fun updateDecodedStacktrace(
        crashId: UUID,
        decodedStacktrace: String?,
        decodeError: String?
    ): Boolean = transaction {
        Crashes.update({ Crashes.id eq crashId }) {
            it[stacktraceDecoded] = decodedStacktrace
            it[this.decodeError] = decodeError
            it[decodedAt] = if (decodedStacktrace != null) OffsetDateTime.now() else null
        } > 0
    }

    fun getCrashStatsByGroupId(
        groupId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<DailyStat> = transaction {
        Crashes
            .select(Crashes.createdAt)
            .where { 
                (Crashes.groupId eq groupId) and 
                (Crashes.createdAt greaterEq fromDate) and 
                (Crashes.createdAt lessEq toDate) 
            }
            .map { it[Crashes.createdAt].toLocalDate() }
            .groupingBy { it }
            .eachCount()
            .map { (date, count) -> DailyStat(date.toString(), count.toLong()) }
            .sortedBy { it.date }
    }

    fun getCrashStatsByAppId(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<DailyStat> = transaction {
        Crashes
            .select(Crashes.createdAt)
            .where { 
                (Crashes.appId eq appId) and 
                (Crashes.createdAt greaterEq fromDate) and 
                (Crashes.createdAt lessEq toDate) 
            }
            .map { it[Crashes.createdAt].toLocalDate() }
            .groupingBy { it }
            .eachCount()
            .map { (date, count) -> DailyStat(date.toString(), count.toLong()) }
            .sortedBy { it.date }
    }

    private fun findOrCreateGroup(
        appId: UUID,
        fingerprint: String,
        exceptionClass: String?,
        exceptionMessage: String?,
        crashTime: OffsetDateTime
    ): UUID {
        val existing = CrashGroups.selectAll()
            .where { (CrashGroups.appId eq appId) and (CrashGroups.fingerprint eq fingerprint) }
            .singleOrNull()

        return if (existing != null) {
            val groupId = existing[CrashGroups.id].value
            CrashGroups.update({ CrashGroups.id eq groupId }) {
                it[lastSeen] = crashTime
                it[occurrences] = CrashGroups.occurrences + 1
            }
            groupId
        } else {
            CrashGroups.insertAndGetId {
                it[CrashGroups.appId] = appId
                it[CrashGroups.fingerprint] = fingerprint
                it[CrashGroups.exceptionClass] = exceptionClass
                it[CrashGroups.exceptionMessage] = exceptionMessage?.take(1000)
                it[firstSeen] = crashTime
                it[lastSeen] = crashTime
                it[occurrences] = 1
                it[status] = "open"
            }.value
        }
    }

    private fun calculateFingerprint(stacktrace: String): String {
        // Take first 5 meaningful lines for fingerprint
        val significantLines = stacktrace.lines()
            .filter { it.trim().startsWith("at ") || it.contains("Exception") || it.contains("Error") }
            .take(5)
            .joinToString("\n")

        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(significantLines.toByteArray())
        return hash.take(16).joinToString("") { "%02x".format(it) }
    }

    private fun parseException(stacktrace: String): Pair<String?, String?> {
        val firstLine = stacktrace.lines().firstOrNull() ?: return null to null
        val colonIndex = firstLine.indexOf(':')
        return if (colonIndex > 0) {
            firstLine.substring(0, colonIndex).trim() to firstLine.substring(colonIndex + 1).trim()
        } else {
            firstLine.trim() to null
        }
    }

    private fun ResultRow.toCrashGroupResponse() = CrashGroupResponse(
        id = this[CrashGroups.id].value.toString(),
        appId = this[CrashGroups.appId].value.toString(),
        exceptionClass = this[CrashGroups.exceptionClass],
        exceptionMessage = this[CrashGroups.exceptionMessage],
        firstSeen = this[CrashGroups.firstSeen].toString(),
        lastSeen = this[CrashGroups.lastSeen].toString(),
        occurrences = this[CrashGroups.occurrences],
        status = this[CrashGroups.status]
    )

    private fun ResultRow.toCrashResponse() = CrashResponse(
        id = this[Crashes.id].value.toString(),
        appId = this[Crashes.appId].value.toString(),
        groupId = this[Crashes.groupId]?.value?.toString(),
        versionCode = this[Crashes.versionCode],
        stacktraceRaw = this[Crashes.stacktraceRaw],
        stacktraceDecoded = this[Crashes.stacktraceDecoded],
        decodedAt = this[Crashes.decodedAt]?.toString(),
        decodeError = this[Crashes.decodeError],
        thread = this[Crashes.thread],
        isFatal = this[Crashes.isFatal],
        context = this[Crashes.context],
        breadcrumbs = this[Crashes.breadcrumbs],
        deviceInfo = this[Crashes.deviceInfo],
        createdAt = this[Crashes.createdAt].toString()
    )
}
