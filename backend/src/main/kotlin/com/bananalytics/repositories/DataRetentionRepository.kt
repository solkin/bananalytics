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
                limit = limit - deleted.toInt()
            )
        }

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
    private fun Transaction.deleteBatch(table: String, where: String, limit: Int): Long =
        exec(
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
