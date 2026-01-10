package com.bananalytics.repositories

import com.bananalytics.models.AppSessions
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
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
     * Get crash-free session statistics by day
     */
    fun getCrashFreeStats(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime,
        versionCode: Long? = null
    ): List<SessionStats> = transaction {
        val sessions = AppSessions.selectAll()
            .where {
                (AppSessions.appId eq appId) and
                (AppSessions.firstSeen greaterEq fromDate) and
                (AppSessions.firstSeen lessEq toDate)
            }
            .let { query ->
                if (versionCode != null) {
                    query.andWhere { AppSessions.versionCode eq versionCode }
                } else {
                    query
                }
            }
            .map {
                Triple(
                    it[AppSessions.firstSeen].toLocalDate(),
                    it[AppSessions.hasCrash],
                    it[AppSessions.versionCode]
                )
            }

        // Group by date
        sessions
            .groupBy { it.first }
            .map { (date, daySessions) ->
                val total = daySessions.size.toLong()
                val crashFree = daySessions.count { !it.second }.toLong()
                val rate = if (total > 0) (crashFree.toDouble() / total * 100) else 100.0
                SessionStats(
                    date = date.toString(),
                    totalSessions = total,
                    crashFreeSessions = crashFree,
                    crashFreeRate = rate
                )
            }
            .sortedBy { it.date }
    }

    /**
     * Get unique sessions count by day and version
     */
    fun getUniqueSessionsByVersion(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<UniqueSessionStats> = transaction {
        val sessions = AppSessions.selectAll()
            .where {
                (AppSessions.appId eq appId) and
                (AppSessions.firstSeen greaterEq fromDate) and
                (AppSessions.firstSeen lessEq toDate) and
                (AppSessions.hasEvent eq true)
            }
            .map {
                Triple(
                    it[AppSessions.firstSeen].toLocalDate(),
                    it[AppSessions.versionCode],
                    1
                )
            }

        // Get version names
        val versionCodes = sessions.map { it.second }.distinct()
        val versionNames = com.bananalytics.models.AppVersions
            .select(com.bananalytics.models.AppVersions.versionCode, com.bananalytics.models.AppVersions.versionName)
            .where { 
                (com.bananalytics.models.AppVersions.appId eq appId) and 
                (com.bananalytics.models.AppVersions.versionCode inList versionCodes) 
            }
            .associate { it[com.bananalytics.models.AppVersions.versionCode] to it[com.bananalytics.models.AppVersions.versionName] }

        // Group by date and version
        sessions
            .groupBy { Pair(it.first, it.second) }
            .map { (key, daySessions) ->
                UniqueSessionStats(
                    date = key.first.toString(),
                    versionCode = key.second,
                    versionName = versionNames[key.second],
                    count = daySessions.size.toLong()
                )
            }
            .sortedWith(compareBy({ it.date }, { it.versionCode }))
    }

    /**
     * Get crash-free stats grouped by version for chart display
     */
    fun getCrashFreeStatsByVersion(
        appId: UUID,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<UniqueSessionStats> = transaction {
        val sessions = AppSessions.selectAll()
            .where {
                (AppSessions.appId eq appId) and
                (AppSessions.firstSeen greaterEq fromDate) and
                (AppSessions.firstSeen lessEq toDate)
            }
            .map {
                Triple(
                    it[AppSessions.firstSeen].toLocalDate(),
                    it[AppSessions.versionCode],
                    if (it[AppSessions.hasCrash]) 0 else 1
                )
            }

        // Get version names
        val versionCodes = sessions.map { it.second }.distinct()
        val versionNames = com.bananalytics.models.AppVersions
            .select(com.bananalytics.models.AppVersions.versionCode, com.bananalytics.models.AppVersions.versionName)
            .where { 
                (com.bananalytics.models.AppVersions.appId eq appId) and 
                (com.bananalytics.models.AppVersions.versionCode inList versionCodes) 
            }
            .associate { it[com.bananalytics.models.AppVersions.versionCode] to it[com.bananalytics.models.AppVersions.versionName] }

        // Group by date and version, count crash-free sessions
        sessions
            .groupBy { Pair(it.first, it.second) }
            .map { (key, daySessions) ->
                val total = daySessions.size
                val crashFree = daySessions.sumOf { it.third }
                val rate = if (total > 0) (crashFree.toDouble() / total * 100) else 100.0
                UniqueSessionStats(
                    date = key.first.toString(),
                    versionCode = key.second,
                    versionName = versionNames[key.second],
                    count = (rate * 10).toLong() // Store rate * 10 for precision
                )
            }
            .sortedWith(compareBy({ it.date }, { it.versionCode }))
    }
}
