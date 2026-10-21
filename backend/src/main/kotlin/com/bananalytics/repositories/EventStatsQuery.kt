package com.bananalytics.repositories

import com.bananalytics.models.Events
import org.jetbrains.exposed.sql.IColumnType
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exact inclusive time windows: roll up whole UTC days, read only partial edges. */
internal class EventStatsQuery(
    appId: UUID,
    versionCode: Long? = null,
    from: OffsetDateTime? = null,
    to: OffsetDateTime? = null,
    eventName: String? = null
) {
    val args = mutableListOf<Pair<IColumnType<*>, Any?>>()
    val sql: String

    init {
        val start = from?.withOffsetSameInstant(ZoneOffset.UTC)
        val end = to?.withOffsetSameInstant(ZoneOffset.UTC)
        val firstDay = start?.toLocalDate()?.atStartOfDay()?.atOffset(ZoneOffset.UTC)
            ?.let { if (it == start) it else it.plusDays(1) }
        val lastDay = end?.toLocalDate()?.atStartOfDay()?.atOffset(ZoneOffset.UTC)

        fun scope(): String {
            args.add(Events.appId.columnType to appId)
            return buildString {
                append("app_id = ?")
                if (versionCode != null) {
                    append(" AND version_code = ?")
                    args.add(Events.versionCode.columnType to versionCode)
                }
                if (eventName != null) {
                    append(" AND name = ?")
                    args.add(Events.name.columnType to eventName)
                }
            }
        }

        fun raw(lower: OffsetDateTime?, upper: OffsetDateTime?, inclusiveEnd: Boolean): String {
            val where = buildString {
                append(scope())
                if (lower != null) {
                    append(" AND created_at >= ?")
                    args.add(Events.createdAt.columnType to lower)
                }
                if (upper != null) {
                    append(if (inclusiveEnd) " AND created_at <= ?" else " AND created_at < ?")
                    args.add(Events.createdAt.columnType to upper)
                }
            }
            return """
                SELECT version_code, name, (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count
                FROM events WHERE $where GROUP BY 1, 2, 3
            """.trimIndent()
        }

        sql = if (firstDay != null && lastDay != null && firstDay >= lastDay) {
            raw(start, end, true)
        } else {
            val where = buildString {
                append(scope())
                append(" AND count > 0")
                if (firstDay != null) {
                    append(" AND day >= ?::date")
                    args.add(Events.name.columnType to firstDay.toLocalDate().toString())
                }
                if (lastDay != null) {
                    append(" AND day < ?::date")
                    args.add(Events.name.columnType to lastDay.toLocalDate().toString())
                }
            }
            buildList {
                add("SELECT version_code, name, day, count FROM event_stats_daily WHERE $where")
                if (start != null && firstDay != null && start < firstDay) add(raw(start, firstDay, false))
                if (end != null && lastDay != null) add(raw(lastDay, end, true))
            }.joinToString("\nUNION ALL\n")
        }
    }
}
