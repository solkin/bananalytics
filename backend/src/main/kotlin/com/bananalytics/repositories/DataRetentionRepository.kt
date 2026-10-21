package com.bananalytics.repositories

import com.bananalytics.models.AppSessions
import com.bananalytics.models.Crashes
import com.bananalytics.models.Events
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.Transaction
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

    /** How long a single trim request keeps deleting batches before reporting back. */
    const val TRIM_TIME_BUDGET_MS = 3_000L

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

    /**
     * `events` is partitioned by month, and joining a batch back to the
     * partitioned parent makes PostgreSQL hash-join it against a sequential scan
     * of every partition — the whole table re-read for each batch. Deleting from
     * one partition at a time by `ctid` keeps a batch at one index scan plus a
     * TID lookup per row, so walk the partitions oldest first until the batch is
     * full.
     */
    fun deleteEvents(appId: UUID, cutoff: OffsetDateTime, limit: Int): Long = transaction {
        var deleted = 0L
        for (partition in eventPartitions()) {
            if (deleted >= limit) break
            deleted += deleteBatch(
                table = partition,
                where = "app_id = '$appId'::uuid AND created_at < '$cutoff'::timestamptz",
                limit = limit - deleted.toInt(),
                eventCounters = true
            )
        }

        if (deleted < limit) {
            exec("DELETE FROM device_stats_daily WHERE app_id = '$appId'::uuid AND count = 0")
            exec("DELETE FROM event_stats_daily WHERE app_id = '$appId'::uuid AND count = 0")
        }
        deleted
    }

    fun deleteSessions(appId: UUID, cutoff: OffsetDateTime, limit: Int): Long = transaction {
        deleteBatch(
            table = "app_sessions",
            where = "app_id = '$appId'::uuid AND first_seen < '$cutoff'::timestamptz",
            limit = limit
        )
    }

    /** Partitions of `events`, oldest first; the DEFAULT catch-all sorts last. */
    private fun Transaction.eventPartitions(): List<String> {
        val partitions = mutableListOf<String>()
        exec(
            """
            SELECT partition.oid::regclass::text AS name
            FROM pg_inherits
            JOIN pg_class AS partition ON partition.oid = pg_inherits.inhrelid
            WHERE pg_inherits.inhparent = 'events'::regclass
            ORDER BY name
            """.trimIndent()
        ) { result ->
            while (result.next()) partitions.add(result.getString("name"))
        }
        return partitions
    }

    /**
     * Delete up to [limit] matching rows of a single physical table. The rows are
     * picked by an index scan and deleted by `ctid`, which PostgreSQL resolves
     * with a TID lookup instead of scanning the table for every batch. Which rows
     * a batch picks is left unordered on purpose: ordering them by age makes the
     * planner read *every* matching row and sort it before applying the limit.
     */
    private fun Transaction.deleteBatch(table: String, where: String, limit: Int, eventCounters: Boolean = false): Long {
        val returning = if (eventCounters) "app_id, version_code, name, created_at, device_info" else "1"
        // Match ingest's lock order: event counters, then device counters;
        // within each table visit keys in the same order as concurrent batches.
        val counters = if (eventCounters) """
            , adjusted AS (
                INSERT INTO event_stats_daily (app_id, day, version_code, name, count)
                SELECT app_id, (created_at AT TIME ZONE 'UTC')::date AS day, version_code, name, -COUNT(*)
                FROM deleted GROUP BY 1, 2, 3, 4 ORDER BY 2, 3, 4
                ON CONFLICT (app_id, day, version_code, name)
                DO UPDATE SET count = event_stats_daily.count + EXCLUDED.count
                RETURNING 1
            ), adjusted_devices AS (
                INSERT INTO device_stats_daily (app_id, day, version_code, dimension, name, count)
                SELECT app_id, (created_at AT TIME ZONE 'UTC')::date AS day,
                       COALESCE(version_code, -1) AS version_code, dimension, value AS name, -COUNT(*)
                FROM deleted CROSS JOIN LATERAL (VALUES
                    ('model', COALESCE(NULLIF(TRIM(CONCAT(device_info->>'manufacturer', ' ', device_info->>'model')), ''), 'Unknown')),
                    ('os', COALESCE(NULLIF(device_info->>'os_version', ''), 'Unknown')),
                    ('country', COALESCE(NULLIF(UPPER(device_info->>'country'), ''), 'Unknown')),
                    ('language', COALESCE(NULLIF(device_info->>'language', ''), 'Unknown'))
                ) dimensions(dimension, value)
                WHERE device_info IS NOT NULL AND (SELECT COUNT(*) FROM adjusted) >= 0
                GROUP BY 1, 2, 3, 4, 5 ORDER BY 2, 4, 3, 5
                ON CONFLICT (app_id, dimension, version_code, day, name)
                DO UPDATE SET count = device_stats_daily.count + EXCLUDED.count
            )
        """.trimIndent() else ""
        return exec(
            """
            WITH batch AS (
                SELECT ctid
                FROM $table
                WHERE $where
                LIMIT $limit
            ), deleted AS (
                DELETE FROM $table AS target
                USING batch
                WHERE target.ctid = batch.ctid
                RETURNING $returning
            ) $counters
            SELECT COUNT(*) AS deleted FROM deleted
            """.trimIndent(),
            emptyList(),
            StatementType.SELECT
        ) { result ->
            if (result.next()) result.getLong("deleted") else 0L
        } ?: 0L
    }
}
