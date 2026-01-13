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

        // Calculate fingerprint from first few frames (use raw for consistent grouping)
        val fingerprint = calculateFingerprint(crash.stacktrace)
        // Use decoded stacktrace for exception info if available
        val stacktraceForParsing = decodedStacktrace ?: crash.stacktrace
        val (exceptionClass, exceptionMessage) = parseException(stacktraceForParsing)

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
        val updated = Crashes.update({ Crashes.id eq crashId }) {
            it[stacktraceDecoded] = decodedStacktrace
            it[this.decodeError] = decodeError
            it[decodedAt] = if (decodedStacktrace != null) OffsetDateTime.now() else null
        } > 0

        // Also update the crash group exception info if we have decoded stacktrace
        if (updated && decodedStacktrace != null) {
            val groupId = Crashes.select(Crashes.groupId)
                .where { Crashes.id eq crashId }
                .singleOrNull()
                ?.get(Crashes.groupId)

            if (groupId != null) {
                val (exceptionClass, exceptionMessage) = parseException(decodedStacktrace)
                CrashGroups.update({ CrashGroups.id eq groupId }) {
                    it[CrashGroups.exceptionClass] = exceptionClass
                    it[CrashGroups.exceptionMessage] = exceptionMessage?.take(1000)
                }
            }
        }

        updated
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

    /**
     * Migrates existing crash groups to use normalized fingerprints.
     * Groups with the same normalized fingerprint will be merged.
     * 
     * @return Migration statistics
     */
    fun migrateToNormalizedFingerprints(appId: UUID): MigrationResult = transaction {
        var groupsProcessed = 0
        var groupsMerged = 0
        var crashesReassigned = 0

        // Step 1: Get all crash groups for this app with a representative crash
        val groupsWithCrashes = CrashGroups
            .join(Crashes, JoinType.LEFT, CrashGroups.id, Crashes.groupId)
            .select(CrashGroups.id, CrashGroups.fingerprint, CrashGroups.status, 
                    CrashGroups.firstSeen, CrashGroups.lastSeen, CrashGroups.occurrences,
                    Crashes.stacktraceRaw)
            .where { CrashGroups.appId eq appId }
            .groupBy(CrashGroups.id)
            .map { row ->
                GroupMigrationData(
                    id = row[CrashGroups.id].value,
                    oldFingerprint = row[CrashGroups.fingerprint],
                    status = row[CrashGroups.status],
                    firstSeen = row[CrashGroups.firstSeen],
                    lastSeen = row[CrashGroups.lastSeen],
                    occurrences = row[CrashGroups.occurrences],
                    stacktrace = row[Crashes.stacktraceRaw]
                )
            }

        // Step 2: Calculate new normalized fingerprints
        val groupsWithNewFingerprints = groupsWithCrashes.map { group ->
            val newFingerprint = calculateFingerprint(group.stacktrace)
            group to newFingerprint
        }

        // Step 3: Group by new fingerprint to find duplicates
        val fingerprintGroups = groupsWithNewFingerprints.groupBy { it.second }

        for ((newFingerprint, groups) in fingerprintGroups) {
            groupsProcessed += groups.size

            if (groups.size == 1) {
                // No merge needed, just update the fingerprint if changed
                val (group, _) = groups.first()
                if (group.oldFingerprint != newFingerprint) {
                    val (exceptionClass, exceptionMessage) = parseException(group.stacktrace)
                    CrashGroups.update({ CrashGroups.id eq group.id }) {
                        it[fingerprint] = newFingerprint
                        it[CrashGroups.exceptionClass] = exceptionClass
                        it[CrashGroups.exceptionMessage] = exceptionMessage?.take(1000)
                    }
                }
            } else {
                // Multiple groups need to be merged
                val sortedGroups = groups.map { it.first }.sortedBy { it.firstSeen }
                val targetGroup = sortedGroups.first()
                val duplicateGroups = sortedGroups.drop(1)

                // Calculate merged values
                val mergedFirstSeen = sortedGroups.minOf { it.firstSeen }
                val mergedLastSeen = sortedGroups.maxOf { it.lastSeen }
                val mergedOccurrences = sortedGroups.sumOf { it.occurrences }
                val mergedStatus = selectBestStatus(sortedGroups.map { it.status })
                val (exceptionClass, exceptionMessage) = parseException(targetGroup.stacktrace)

                // Update target group
                CrashGroups.update({ CrashGroups.id eq targetGroup.id }) {
                    it[fingerprint] = newFingerprint
                    it[firstSeen] = mergedFirstSeen
                    it[lastSeen] = mergedLastSeen
                    it[occurrences] = mergedOccurrences
                    it[status] = mergedStatus
                    it[CrashGroups.exceptionClass] = exceptionClass
                    it[CrashGroups.exceptionMessage] = exceptionMessage?.take(1000)
                }

                // Move crashes from duplicate groups to target
                for (duplicate in duplicateGroups) {
                    val movedCount = Crashes.update({ Crashes.groupId eq duplicate.id }) {
                        it[groupId] = targetGroup.id
                    }
                    crashesReassigned += movedCount

                    // Delete the empty duplicate group
                    CrashGroups.deleteWhere { CrashGroups.id eq duplicate.id }
                    groupsMerged++
                }
            }
        }

        MigrationResult(
            groupsProcessed = groupsProcessed,
            groupsMerged = groupsMerged,
            crashesReassigned = crashesReassigned
        )
    }

    /**
     * Select the best status when merging groups.
     * Priority: open > resolved > ignored
     */
    private fun selectBestStatus(statuses: List<String>): String {
        return when {
            statuses.contains("open") -> "open"
            statuses.contains("resolved") -> "resolved"
            else -> "ignored"
        }
    }

    private data class GroupMigrationData(
        val id: UUID,
        val oldFingerprint: String,
        val status: String,
        val firstSeen: OffsetDateTime,
        val lastSeen: OffsetDateTime,
        val occurrences: Int,
        val stacktrace: String
    )

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
            .map { line ->
                // Normalize only exception/error lines (not stack frames)
                if (line.trim().startsWith("at ")) line
                else normalizeExceptionMessage(line)
            }
            .joinToString("\n")

        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(significantLines.toByteArray())
        return hash.take(16).joinToString("") { "%02x".format(it) }
    }

    /**
     * Normalizes exception message by replacing variable parts with placeholders.
     * This allows grouping crashes with the same root cause but different dynamic values.
     * 
     * Examples:
     * - "data parcel size 1057544 bytes" -> "data parcel size <N> bytes"
     * - "Failed to connect to 192.168.1.1:8080" -> "Failed to connect to <ip>:<N>"
     * - "Object at 0x7f3a2b00" -> "Object at <hex>"
     */
    internal fun normalizeExceptionMessage(line: String): String {
        return line
            // UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            .replace(Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"), "<uuid>")
            // Hex hashes (32+ characters)
            .replace(Regex("\\b[0-9a-fA-F]{32,}\\b"), "<hash>")
            // Hex addresses: 0x...
            .replace(Regex("0x[0-9a-fA-F]+"), "<hex>")
            // File paths (Unix-style)
            .replace(Regex("/[\\w./\\-]+"), "<path>")
            // IP addresses
            .replace(Regex("\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b"), "<ip>")
            // Numbers (integers and floats) - must be last to not interfere with IP/hex
            .replace(Regex("\\b\\d+(\\.\\d+)?\\b"), "<N>")
    }

    private fun parseException(stacktrace: String, normalize: Boolean = true): Pair<String?, String?> {
        val firstLine = stacktrace.lines().firstOrNull() ?: return null to null
        val colonIndex = firstLine.indexOf(':')
        return if (colonIndex > 0) {
            val exceptionClass = firstLine.substring(0, colonIndex).trim()
            val rawMessage = firstLine.substring(colonIndex + 1).trim()
            val message = if (normalize) normalizeExceptionMessage(rawMessage) else rawMessage
            exceptionClass to message
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
