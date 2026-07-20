package com.bananalytics.repositories

import com.bananalytics.models.AppSessions
import com.bananalytics.models.Crashes
import com.bananalytics.models.Events
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.statements.StatementType
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.UUID

data class RetentionCounts(
    val crashes: Long,
    val events: Long,
    val sessions: Long
) {
    val total: Long get() = crashes + events + sessions
}

object DataRetentionRepository {
    const val TRIM_BATCH_SIZE = 50_000

    fun preview(appId: UUID, cutoff: OffsetDateTime): RetentionCounts = transaction {
        RetentionCounts(
            crashes = Crashes.selectAll()
                .where { (Crashes.appId eq appId) and (Crashes.createdAt less cutoff) }
                .count(),
            events = Events.selectAll()
                .where { (Events.appId eq appId) and (Events.createdAt less cutoff) }
                .count(),
            sessions = AppSessions.selectAll()
                .where { (AppSessions.appId eq appId) and (AppSessions.firstSeen less cutoff) }
                .count()
        )
    }

    fun deleteEvents(appId: UUID, cutoff: OffsetDateTime, limit: Int): Long = transaction {
        val deleted = exec(
            """
            WITH batch AS (
                SELECT id, created_at
                FROM events
                WHERE app_id = '$appId'::uuid
                  AND created_at < '$cutoff'::timestamptz
                ORDER BY created_at
                LIMIT $limit
            ), deleted AS (
                DELETE FROM events AS event
                USING batch
                WHERE event.id = batch.id
                  AND event.created_at = batch.created_at
                RETURNING 1
            )
            SELECT COUNT(*) AS deleted FROM deleted
            """.trimIndent(),
            emptyList(),
            StatementType.SELECT
        ) { result ->
            if (result.next()) result.getLong("deleted") else 0L
        } ?: 0L

        if (deleted < limit) exec(
            """
            DELETE FROM device_stats_daily
            WHERE app_id = '$appId'::uuid
              AND day < '${cutoff.toLocalDate()}'::date
            """.trimIndent()
        )
        deleted
    }

    fun deleteSessions(appId: UUID, cutoff: OffsetDateTime, limit: Int): Long = transaction {
        exec(
            """
            WITH batch AS (
                SELECT id
                FROM app_sessions
                WHERE app_id = '$appId'::uuid
                  AND first_seen < '$cutoff'::timestamptz
                ORDER BY first_seen
                LIMIT $limit
            ), deleted AS (
                DELETE FROM app_sessions AS session
                USING batch
                WHERE session.id = batch.id
                RETURNING 1
            )
            SELECT COUNT(*) AS deleted FROM deleted
            """.trimIndent(),
            emptyList(),
            StatementType.SELECT
        ) { result ->
            if (result.next()) result.getLong("deleted") else 0L
        } ?: 0L
    }
}
