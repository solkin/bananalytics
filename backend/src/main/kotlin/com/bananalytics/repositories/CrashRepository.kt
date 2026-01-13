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

        // Step 1: Get all crash groups for this app
        val groupsWithCrashes = CrashGroups
            .selectAll()
            .where { CrashGroups.appId eq appId }
            .mapNotNull { row ->
                val groupId = row[CrashGroups.id].value
                // Get one representative crash for this group
                val stacktrace = Crashes
                    .select(Crashes.stacktraceRaw)
                    .where { Crashes.groupId eq groupId }
                    .limit(1)
                    .firstOrNull()
                    ?.get(Crashes.stacktraceRaw)
                    ?: return@mapNotNull null // Skip groups without crashes

                GroupMigrationData(
                    id = groupId,
                    oldFingerprint = row[CrashGroups.fingerprint],
                    status = row[CrashGroups.status],
                    firstSeen = row[CrashGroups.firstSeen],
                    lastSeen = row[CrashGroups.lastSeen],
                    occurrences = row[CrashGroups.occurrences],
                    stacktrace = stacktrace
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
                val allGroups = groups.map { it.first }
                
                // Prefer group that already has the new fingerprint to avoid constraint violation
                // Otherwise, use the oldest group (by firstSeen)
                val targetGroup = allGroups.find { it.oldFingerprint == newFingerprint }
                    ?: allGroups.minBy { it.firstSeen }
                val duplicateGroups = allGroups.filter { it.id != targetGroup.id }

                // Calculate merged values
                val mergedFirstSeen = allGroups.minOf { it.firstSeen }
                val mergedLastSeen = allGroups.maxOf { it.lastSeen }
                val mergedOccurrences = allGroups.sumOf { it.occurrences }
                val mergedStatus = selectBestStatus(allGroups.map { it.status })
                val (exceptionClass, exceptionMessage) = parseException(targetGroup.stacktrace)

                // FIRST: Move crashes from duplicate groups to target and delete duplicates
                for (duplicate in duplicateGroups) {
                    val movedCount = Crashes.update({ Crashes.groupId eq duplicate.id }) {
                        it[groupId] = targetGroup.id
                    }
                    crashesReassigned += movedCount

                    // Delete the empty duplicate group
                    CrashGroups.deleteWhere { CrashGroups.id eq duplicate.id }
                    groupsMerged++
                }

                // THEN: Update target group (now safe, duplicates are gone)
                CrashGroups.update({ CrashGroups.id eq targetGroup.id }) {
                    it[fingerprint] = newFingerprint
                    it[firstSeen] = mergedFirstSeen
                    it[lastSeen] = mergedLastSeen
                    it[occurrences] = mergedOccurrences
                    it[status] = mergedStatus
                    it[CrashGroups.exceptionClass] = exceptionClass
                    it[CrashGroups.exceptionMessage] = exceptionMessage?.take(1000)
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

    /**
     * Calculates fingerprint for crash grouping.
     * 
     * Algorithm:
     * 1. Extract root cause (last "Caused by:" or first exception line)
     * 2. Extract app frames (non-system packages)
     * 3. Fingerprint = normalized_root_cause + app_frames (if any)
     * 
     * This ensures:
     * - System-only crashes group by exception type (e.g., TransactionTooLargeException)
     * - App crashes group by exception + location in app code
     */
    private fun calculateFingerprint(stacktrace: String): String {
        val lines = stacktrace.lines()
        
        // 1. Extract root cause - last "Caused by:" or first exception line
        val rootCause = extractRootCause(lines)
        
        // 2. Extract app frames (non-system packages)
        val appFrames = extractAppFrames(lines)
        
        // 3. Build fingerprint: root cause + app frames (if any)
        val significantParts = mutableListOf<String>()
        
        // Always include normalized root cause
        significantParts.add(normalizeExceptionMessage(rootCause))
        
        // Add app frames if present (max 3)
        if (appFrames.isNotEmpty()) {
            appFrames.take(3).forEach { frame ->
                significantParts.add(normalizeStackFrame(frame))
            }
        }
        
        val fingerprint = significantParts.joinToString("\n")
        
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(fingerprint.toByteArray())
        return hash.take(16).joinToString("") { "%02x".format(it) }
    }

    /**
     * Extracts root cause from stacktrace.
     * Returns the last "Caused by:" line, or the first exception line if no causes.
     */
    private fun extractRootCause(lines: List<String>): String {
        // Find last "Caused by:" line
        val lastCausedBy = lines.lastOrNull { it.trim().startsWith("Caused by:") }
        if (lastCausedBy != null) {
            // Remove "Caused by: " prefix
            return lastCausedBy.trim().removePrefix("Caused by:").trim()
        }
        
        // Otherwise, return first exception/error line
        return lines.firstOrNull { line ->
            val trimmed = line.trim()
            (trimmed.contains("Exception") || trimmed.contains("Error")) &&
            !trimmed.startsWith("at ") &&
            !trimmed.startsWith("[")
        } ?: lines.firstOrNull()?.trim() ?: ""
    }

    /**
     * Extracts stack frames from application code (non-system packages).
     */
    private fun extractAppFrames(lines: List<String>): List<String> {
        return lines
            .filter { it.trim().startsWith("at ") }
            .filterNot { isSystemFrame(it) }
    }

    /**
     * Checks if a stack frame belongs to a system package.
     */
    private fun isSystemFrame(frame: String): Boolean {
        val systemPackages = listOf(
            "android.", "java.", "javax.", "com.android.", "dalvik.",
            "kotlin.", "kotlinx.", "sun.", "com.sun.", "org.json.",
            "androidx.", "com.google.android."
        )
        return systemPackages.any { frame.contains(it) }
    }

    /**
     * Normalizes stack frame by removing line numbers for system classes.
     * For app code, line numbers are preserved as they are meaningful for debugging.
     */
    private fun normalizeStackFrame(frame: String): String {
        return if (isSystemFrame(frame)) {
            // Remove line number from system classes: (File.java:123) -> (File.java)
            frame.replace(Regex(":\\d+\\)"), ")")
        } else {
            frame
        }
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
