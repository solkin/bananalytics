package com.bananalytics.repositories

import com.bananalytics.models.AppSessions
import com.bananalytics.models.Events
import org.jetbrains.exposed.sql.UUIDColumnType
import org.jetbrains.exposed.sql.IColumnType
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

internal val deviceDimensionsSql = """
    (VALUES
        ('model', COALESCE(NULLIF(TRIM(CONCAT(device_info->>'manufacturer', ' ', device_info->>'model')), ''), 'Unknown')),
        ('os', COALESCE(NULLIF(device_info->>'os_version', ''), 'Unknown')),
        ('country', COALESCE(NULLIF(UPPER(device_info->>'country'), ''), 'Unknown')),
        ('language', COALESCE(NULLIF(device_info->>'language', ''), 'Unknown'))
    ) dimensions(dimension, name)
""".trimIndent()

/** Whole UTC days come from counters; incomplete edges retain exact timestamp semantics. */
internal class SessionDeviceStatsQuery(appId: UUID, version: Long?, from: OffsetDateTime?, to: OffsetDateTime?) {
    val args = mutableListOf<Pair<IColumnType<*>, Any?>>()
    val sql: String

    init {
        val start = from?.withOffsetSameInstant(ZoneOffset.UTC)
        val end = to?.withOffsetSameInstant(ZoneOffset.UTC)
        val firstDay = start?.toLocalDate()?.atStartOfDay()?.atOffset(ZoneOffset.UTC)
            ?.let { if (it == start) it else it.plusDays(1) }
        val lastDay = end?.toLocalDate()?.atStartOfDay()?.atOffset(ZoneOffset.UTC)

        fun scope(): String {
            args.add(UUIDColumnType() to appId)
            return "app_id = ?" + if (version == null) "" else " AND version_code = ?".also {
                args.add(AppSessions.versionCode.columnType to version)
            }
        }
        fun raw(lower: OffsetDateTime?, upper: OffsetDateTime?, inclusiveEnd: Boolean): String {
            val where = buildString {
                append(scope())
                if (lower != null) {
                    append(" AND first_seen >= ?")
                    args.add(AppSessions.firstSeen.columnType to lower)
                }
                if (upper != null) {
                    append(if (inclusiveEnd) " AND first_seen <= ?" else " AND first_seen < ?")
                    args.add(AppSessions.firstSeen.columnType to upper)
                }
            }
            return "SELECT dimension, name, COUNT(*) AS count FROM app_sessions " +
                "CROSS JOIN LATERAL $deviceDimensionsSql WHERE $where AND has_event GROUP BY 1, 2"
        }
        sql = if (firstDay != null && lastDay != null && firstDay >= lastDay) {
            raw(start, end, true)
        } else {
            val where = buildString {
                append(scope())
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
                add("SELECT dimension, name, count FROM session_device_stats_daily WHERE $where AND count > 0")
                if (start != null && firstDay != null && start < firstDay) add(raw(start, firstDay, false))
                if (end != null && lastDay != null) add(raw(lastDay, end, true))
            }.joinToString("\nUNION ALL\n")
        }
    }
}
