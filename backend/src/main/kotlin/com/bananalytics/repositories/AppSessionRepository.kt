package com.bananalytics.repositories

import com.bananalytics.models.AppSessions
import com.bananalytics.models.Events
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

data class SessionStats(
    val date: String,
    val totalSessions: Long,
    val crashFreeSessions: Long,
    val crashFreeRate: Double
)

data class UniqueSessionStats(
    val date: String,
    val versionCode: Long,
    val versionName: String?,
    val count: Long
)

data class DailyActivityStats(
    val date: String,
    val sessions: Long,
    val users: Long
)

object AppSessionRepository {

    /**
     * Record or update a session. Returns true if new session was created.
     */
    fun recordSession(
        appId: UUID,
        sessionId: UUID,
        versionCode: Long,
        deviceId: String?,
        hasCrash: Boolean = false,
        hasEvent: Boolean = false
    ): Boolean = transaction {
        val now = OffsetDateTime.now()

        val existing = AppSessions.selectAll()
            .where { (AppSessions.appId eq appId) and (AppSessions.sessionId eq sessionId) }
            .singleOrNull()

        if (existing != null) {
            // Update existing session
            AppSessions.update({ (AppSessions.appId eq appId) and (AppSessions.sessionId eq sessionId) }) {
                it[lastSeen] = now
                if (hasCrash) it[AppSessions.hasCrash] = true
                if (hasEvent) it[AppSessions.hasEvent] = true
            }
            false
        } else {
            // Create new session
            AppSessions.insert {
                it[AppSessions.appId] = appId
                it[AppSessions.sessionId] = sessionId
                it[AppSessions.versionCode] = versionCode
                it[AppSessions.deviceId] = deviceId
                it[AppSessions.hasCrash] = hasCrash
                it[AppSessions.hasEvent] = hasEvent
                it[firstSeen] = now
                it[lastSeen] = now
            }
            true
        }
    }

    /**
     * Mark a session as having a crash
     */
    fun markSessionWithCrash(appId: UUID, sessionId: UUID) = transaction {
        AppSessions.update({ (AppSessions.appId eq appId) and (AppSessions.sessionId eq sessionId) }) {
            it[hasCrash] = true
            it[lastSeen] = OffsetDateTime.now()
        }
    }

    /**
     * Get crash-free session statistics by day. Aggregated in SQL so only
     * one row per day crosses the wire.
     */
    fun getCrashFreeStats(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime,
        versionCode: Long? = null
    ): List<SessionStats> = transaction {
        val versionFilter = if (versionCode != null) "AND version_code = ?" else ""
        val args = buildList {
            add(Events.appId.columnType to appId)
            add(AppSessions.firstSeen.columnType to fromDate)
            add(AppSessions.firstSeen.columnType to toDate)
            if (versionCode != null) add(Events.id.columnType to versionCode)
        }
        exec(
            """
            SELECT (first_seen AT TIME ZONE 'UTC')::date AS day,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE NOT has_crash) AS crash_free
            FROM app_sessions
            WHERE app_id = ? AND first_seen >= ? AND first_seen <= ? $versionFilter
            GROUP BY 1
            ORDER BY 1
            """.trimIndent(),
            args
        ) { rs ->
            val results = mutableListOf<SessionStats>()
            while (rs.next()) {
                val total = rs.getLong("total")
                val crashFree = rs.getLong("crash_free")
                results.add(
                    SessionStats(
                        date = rs.getString("day"),
                        totalSessions = total,
                        crashFreeSessions = crashFree,
                        crashFreeRate = if (total > 0) (crashFree.toDouble() / total * 100) else 100.0
                    )
                )
            }
            results
        } ?: emptyList()
    }

    /**
     * Get unique sessions count by day and version
     */
    fun getUniqueSessionsByVersion(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<UniqueSessionStats> = transaction {
        exec(
            """
            SELECT (s.first_seen AT TIME ZONE 'UTC')::date AS day,
                   s.version_code,
                   v.version_name,
                   COUNT(*) AS count
            FROM app_sessions s
            LEFT JOIN app_versions v ON v.app_id = s.app_id AND v.version_code = s.version_code
            WHERE s.app_id = ? AND s.first_seen >= ? AND s.first_seen <= ? AND s.has_event
            GROUP BY 1, 2, 3
            ORDER BY 1, 2
            """.trimIndent(),
            listOf(
                Events.appId.columnType to appId,
                AppSessions.firstSeen.columnType to fromDate,
                AppSessions.firstSeen.columnType to toDate
            )
        ) { rs ->
            val results = mutableListOf<UniqueSessionStats>()
            while (rs.next()) {
                results.add(
                    UniqueSessionStats(
                        date = rs.getString("day"),
                        versionCode = rs.getLong("version_code"),
                        versionName = rs.getString("version_name"),
                        count = rs.getLong("count")
                    )
                )
            }
            results
        } ?: emptyList()
    }

    /**
     * Get daily activity by day: total sessions and distinct active users (devices).
     * Mirrors the "Active users" chart — only counts sessions that produced events.
     */
    fun getDailyActivity(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<DailyActivityStats> = transaction {
        exec(
            """
            SELECT (first_seen AT TIME ZONE 'UTC')::date AS day,
                   COUNT(*) AS sessions,
                   COUNT(DISTINCT device_id) AS users
            FROM app_sessions
            WHERE app_id = ? AND first_seen >= ? AND first_seen <= ? AND has_event
            GROUP BY 1
            ORDER BY 1
            """.trimIndent(),
            listOf(
                Events.appId.columnType to appId,
                AppSessions.firstSeen.columnType to fromDate,
                AppSessions.firstSeen.columnType to toDate
            )
        ) { rs ->
            val results = mutableListOf<DailyActivityStats>()
            while (rs.next()) {
                results.add(
                    DailyActivityStats(
                        date = rs.getString("day"),
                        sessions = rs.getLong("sessions"),
                        users = rs.getLong("users")
                    )
                )
            }
            results
        } ?: emptyList()
    }

    /**
     * Get crash-free stats grouped by version for chart display
     */
    fun getCrashFreeStatsByVersion(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime,
        versionCode: Long? = null
    ): List<UniqueSessionStats> = transaction {
        val versionFilter = if (versionCode != null) "AND s.version_code = ?" else ""
        val args = buildList {
            add(Events.appId.columnType to appId)
            add(AppSessions.firstSeen.columnType to fromDate)
            add(AppSessions.firstSeen.columnType to toDate)
            if (versionCode != null) add(Events.id.columnType to versionCode)
        }
        exec(
            """
            SELECT (s.first_seen AT TIME ZONE 'UTC')::date AS day,
                   s.version_code,
                   v.version_name,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE NOT s.has_crash) AS crash_free
            FROM app_sessions s
            LEFT JOIN app_versions v ON v.app_id = s.app_id AND v.version_code = s.version_code
            WHERE s.app_id = ? AND s.first_seen >= ? AND s.first_seen <= ? $versionFilter
            GROUP BY 1, 2, 3
            ORDER BY 1, 2
            """.trimIndent(),
            args
        ) { rs ->
            val results = mutableListOf<UniqueSessionStats>()
            while (rs.next()) {
                val total = rs.getLong("total")
                val crashFree = rs.getLong("crash_free")
                val rate = if (total > 0) (crashFree.toDouble() / total * 100) else 100.0
                results.add(
                    UniqueSessionStats(
                        date = rs.getString("day"),
                        versionCode = rs.getLong("version_code"),
                        versionName = rs.getString("version_name"),
                        count = (rate * 10).toLong() // Store rate * 10 for precision
                    )
                )
            }
            results
        } ?: emptyList()
    }
}
