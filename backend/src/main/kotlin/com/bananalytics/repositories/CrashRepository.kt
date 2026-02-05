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
        fromDate: OffsetDateTime? = null,
        sortBy: String? = null,
        sortOrder: String? = null,
        page: Int = 1,
        pageSize: Int = 20
    ): PaginatedResponse<CrashGroupResponse> = transaction {
        // Always calculate stats from Crashes table to support date/version filtering
        findGroupsByAppIdWithFilters(appId, status, versionCode, fromDate, sortBy, sortOrder, page, pageSize)
    }

    private fun findGroupsByAppIdWithFilters(
        appId: UUID,
        status: String?,
        versionCode: Long?,
        fromDate: OffsetDateTime?,
        sortBy: String?,
        sortOrder: String?,
        page: Int,
        pageSize: Int
    ): PaginatedResponse<CrashGroupResponse> {
        // Define aggregate expressions
        val minCreatedAt = Crashes.createdAt.min()
        val maxCreatedAt = Crashes.createdAt.max()
        val countCrashes = Crashes.id.count()
        val countDevices = Crashes.deviceId.countDistinct()
        
        // Build query with filters
        var crashQuery = Crashes
            .select(Crashes.groupId, minCreatedAt, maxCreatedAt, countCrashes, countDevices)
            .where { (Crashes.appId eq appId) and Crashes.groupId.isNotNull() }
        
        if (versionCode != null) {
            crashQuery = crashQuery.andWhere { Crashes.versionCode eq versionCode }
        }
        
        if (fromDate != null) {
            crashQuery = crashQuery.andWhere { Crashes.createdAt greaterEq fromDate }
        }
        
        // Calculate stats per group
        val crashStats = crashQuery
            .groupBy(Crashes.groupId)
            .associate { row ->
                val groupId = row[Crashes.groupId]!!.value
                groupId to FilteredCrashStats(
                    count = row[countCrashes].toInt(),
                    affectedDevices = row[countDevices].toInt(),
                    firstSeen = row[minCreatedAt]!!,
                    lastSeen = row[maxCreatedAt]!!
                )
            }

        if (crashStats.isEmpty()) {
            return PaginatedResponse(emptyList(), 0, page, pageSize)
        }

        // Query crash groups that have crashes matching filters
        var baseQuery = CrashGroups.selectAll()
            .where { (CrashGroups.appId eq appId) and (CrashGroups.id inList crashStats.keys) }

        if (status != null) {
            baseQuery = baseQuery.andWhere { CrashGroups.status eq status }
        }

        val total = baseQuery.count()
        
        // We need to sort by filtered occurrences, so fetch all matching groups first
        val allGroups = baseQuery.map { row ->
            val groupId = row[CrashGroups.id].value
            val stats = crashStats[groupId]!!
            CrashGroupResponse(
                id = groupId.toString(),
                appId = row[CrashGroups.appId].value.toString(),
                exceptionClass = row[CrashGroups.exceptionClass],
                exceptionMessage = row[CrashGroups.exceptionMessage],
                firstSeen = stats.firstSeen.toString(),
                lastSeen = stats.lastSeen.toString(),
                occurrences = stats.count,
                affectedDevices = stats.affectedDevices,
                status = row[CrashGroups.status]
            )
        }
        
        // Sort by requested field and paginate
        val ascending = sortOrder == "asc"
        val sortedGroups = when (sortBy) {
            "status" -> if (ascending) allGroups.sortedBy { it.status } else allGroups.sortedByDescending { it.status }
            "occurrences" -> if (ascending) allGroups.sortedBy { it.occurrences } else allGroups.sortedByDescending { it.occurrences }
            "affected_devices" -> if (ascending) allGroups.sortedBy { it.affectedDevices } else allGroups.sortedByDescending { it.affectedDevices }
            "last_seen" -> if (ascending) allGroups.sortedBy { it.lastSeen } else allGroups.sortedByDescending { it.lastSeen }
            else -> allGroups.sortedByDescending { it.occurrences } // Default: sort by occurrences desc
        }
        
        val items = sortedGroups
            .drop((page - 1) * pageSize)
            .take(pageSize)

        return PaginatedResponse(items, total, page, pageSize)
    }

    private data class FilteredCrashStats(
        val count: Int,
        val affectedDevices: Int,
        val firstSeen: OffsetDateTime,
        val lastSeen: OffsetDateTime
    )

    fun getVersionCodes(appId: UUID): List<VersionInfo> = transaction {
        val crashVersionCodes = Crashes
            .select(Crashes.versionCode)
            .where { (Crashes.appId eq appId) and Crashes.versionCode.isNotNull() }
            .withDistinct()
            .mapNotNull { it[Crashes.versionCode] }
            .toSet()

        // Only include versions that exist in AppVersions (filter out deleted versions)
        AppVersions
            .select(AppVersions.versionCode, AppVersions.versionName)
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode inList crashVersionCodes) }
            .map { row ->
                VersionInfo(
                    versionCode = row[AppVersions.versionCode],
                    versionName = row[AppVersions.versionName]
                )
            }
            .sortedByDescending { it.versionCode }
    }

    fun findGroupById(id: UUID): CrashGroupResponse? = transaction {
        val group = CrashGroups.selectAll()
            .where { CrashGroups.id eq id }
            .singleOrNull() ?: return@transaction null
        
        // Count distinct devices for this group
        val affectedDevices = Crashes
            .select(Crashes.deviceId.countDistinct())
            .where { Crashes.groupId eq id }
            .single()[Crashes.deviceId.countDistinct()].toInt()
        
        CrashGroupResponse(
            id = group[CrashGroups.id].value.toString(),
            appId = group[CrashGroups.appId].value.toString(),
            exceptionClass = group[CrashGroups.exceptionClass],
            exceptionMessage = group[CrashGroups.exceptionMessage],
            firstSeen = group[CrashGroups.firstSeen].toString(),
            lastSeen = group[CrashGroups.lastSeen].toString(),
            occurrences = group[CrashGroups.occurrences],
            affectedDevices = affectedDevices,
            status = group[CrashGroups.status]
        )
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
            it[Crashes.deviceId] = deviceInfo?.deviceId
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

    /**
     * Deletes crashes by version ID and recalculates affected crash groups.
     * Empty groups are deleted.
     * 
     * @return Number of crashes deleted
     */
    fun deleteCrashesByVersionId(versionId: UUID): Int = transaction {
        // Find affected group IDs before deletion
        val affectedGroupIds = Crashes
            .select(Crashes.groupId)
            .where { Crashes.versionId eq versionId }
            .mapNotNull { it[Crashes.groupId]?.value }
            .toSet()

        // Delete crashes
        val deletedCount = Crashes.deleteWhere { Crashes.versionId eq versionId }

        // Recalculate stats for affected groups
        recalculateGroupStats(affectedGroupIds)

        deletedCount
    }

    /**
     * Deletes orphaned crashes (crashes with no valid version).
     * A crash is orphaned if its versionId is null AND its versionCode doesn't exist in AppVersions.
     * 
     * @return CleanupResult with counts
     */
    fun deleteOrphanedCrashes(appId: UUID): CleanupResult = transaction {
        // Get all valid version codes for this app
        val validVersionCodes = AppVersions
            .select(AppVersions.versionCode)
            .where { AppVersions.appId eq appId }
            .map { it[AppVersions.versionCode] }
            .toSet()

        // Find orphaned crashes: versionId is null AND (versionCode is null OR versionCode not in valid set)
        val orphanedCrashIds = Crashes
            .select(Crashes.id, Crashes.groupId)
            .where { 
                (Crashes.appId eq appId) and 
                (Crashes.versionId.isNull()) and
                (Crashes.versionCode.isNull() or (Crashes.versionCode notInList validVersionCodes))
            }
            .toList()

        val affectedGroupIds = orphanedCrashIds.mapNotNull { it[Crashes.groupId]?.value }.toSet()
        val crashIds = orphanedCrashIds.map { it[Crashes.id].value }

        // Delete orphaned crashes
        val deletedCount = if (crashIds.isNotEmpty()) {
            Crashes.deleteWhere { Op.build { Crashes.id inList crashIds } }
        } else 0

        // Recalculate stats for affected groups
        val deletedGroups = recalculateGroupStats(affectedGroupIds)

        CleanupResult(
            crashesDeleted = deletedCount,
            groupsRecalculated = affectedGroupIds.size - deletedGroups,
            groupsDeleted = deletedGroups
        )
    }

    /**
     * Recalculates stats for crash groups based on remaining crashes.
     * Deletes groups that have no crashes left.
     * 
     * @return Number of groups deleted
     */
    private fun recalculateGroupStats(groupIds: Set<UUID>): Int {
        if (groupIds.isEmpty()) return 0

        var deletedGroups = 0

        for (groupId in groupIds) {
            val minCreatedAt = Crashes.createdAt.min()
            val maxCreatedAt = Crashes.createdAt.max()
            val countCrashes = Crashes.id.count()

            val stats = Crashes
                .select(minCreatedAt, maxCreatedAt, countCrashes)
                .where { Crashes.groupId eq groupId }
                .singleOrNull()

            val count = stats?.get(countCrashes)?.toInt() ?: 0

            if (count == 0) {
                // No crashes left, delete the group
                CrashGroups.deleteWhere { CrashGroups.id eq groupId }
                deletedGroups++
            } else {
                // Update group stats
                CrashGroups.update({ CrashGroups.id eq groupId }) {
                    it[occurrences] = count
                    it[firstSeen] = stats!![minCreatedAt]!!
                    it[lastSeen] = stats[maxCreatedAt]!!
                }
            }
        }

        return deletedGroups
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
        toDate: OffsetDateTime,
        versionCode: Long? = null
    ): List<DailyStat> = transaction {
        var query = Crashes
            .select(Crashes.createdAt)
            .where { 
                (Crashes.appId eq appId) and 
                (Crashes.createdAt greaterEq fromDate) and 
                (Crashes.createdAt lessEq toDate) 
            }
        
        if (versionCode != null) {
            query = query.andWhere { Crashes.versionCode eq versionCode }
        }
        
        query
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
