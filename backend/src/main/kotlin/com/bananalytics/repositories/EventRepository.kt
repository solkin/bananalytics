package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.*

object EventRepository {

    /**
     * Per-event totals and daily counts over a date range. One pass over the
     * range gives both, so the table and its trend lines can never disagree.
     */
    fun getEventSummary(
        appId: UUID,
        versionCode: Long? = null,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime
    ): List<EventSummaryResponse> = transaction {
        val versionFilter = if (versionCode != null) "AND version_code = ?" else ""
        val args = buildList {
            add(Events.appId.columnType to appId)
            add(Events.createdAt.columnType to fromDate)
            add(Events.createdAt.columnType to toDate)
            if (versionCode != null) add(Events.id.columnType to versionCode)
        }
        exec(
            """
            SELECT name, (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count
            FROM events
            WHERE app_id = ? AND created_at >= ? AND created_at <= ? $versionFilter
            GROUP BY 1, 2
            ORDER BY 1, 2
            """.trimIndent(),
            args
        ) { rs ->
            val byName = linkedMapOf<String, MutableList<DailyStat>>()
            while (rs.next()) {
                byName.getOrPut(rs.getString("name")) { mutableListOf() }
                    .add(DailyStat(rs.getString("day"), rs.getLong("count")))
            }
            byName
                .map { (name, days) -> EventSummaryResponse(name, days.sumOf { it.count }, days) }
                .sortedByDescending { it.total }
        } ?: emptyList()
    }

    fun findByAppIdAndName(
        appId: UUID,
        eventName: String,
        versionCode: Long? = null,
        fromTime: OffsetDateTime? = null,
        toTime: OffsetDateTime? = null,
        page: Int = 1,
        pageSize: Int = 50
    ): PaginatedResponse<EventResponse> = transaction {
        var query = Events.selectAll()
            .where { (Events.appId eq appId) and (Events.name eq eventName) }

        versionCode?.let { query = query.andWhere { Events.versionCode eq it } }
        fromTime?.let { query = query.andWhere { Events.createdAt greaterEq it } }
        toTime?.let { query = query.andWhere { Events.createdAt lessEq it } }

        val total = query.count()
        val items = query
            .orderBy(Events.createdAt, SortOrder.DESC)
            .limit(pageSize).offset(((page - 1) * pageSize).toLong())
            .map { it.toEventResponse() }

        PaginatedResponse(items, total, page, pageSize)
    }

    fun getEventStatsByName(
        appId: UUID,
        eventName: String,
        fromDate: OffsetDateTime,
        toDate: OffsetDateTime,
        versionCode: Long? = null
    ): List<DailyStat> = transaction {
        val versionFilter = if (versionCode != null) "AND version_code = ?" else ""
        val args = buildList {
            add(Events.appId.columnType to appId)
            add(Events.name.columnType to eventName)
            add(Events.createdAt.columnType to fromDate)
            add(Events.createdAt.columnType to toDate)
            if (versionCode != null) add(Events.id.columnType to versionCode)
        }
        exec(
            """
            SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count
            FROM events
            WHERE app_id = ? AND name = ? AND created_at >= ? AND created_at <= ? $versionFilter
            GROUP BY 1
            ORDER BY 1
            """.trimIndent(),
            args
        ) { rs ->
            val results = mutableListOf<DailyStat>()
            while (rs.next()) {
                results.add(DailyStat(rs.getString("day"), rs.getLong("count")))
            }
            results
        } ?: emptyList()
    }

    fun getVersionsForEvent(
        appId: UUID,
        eventName: String,
        fromTime: OffsetDateTime? = null,
        toTime: OffsetDateTime? = null
    ): List<EventVersionStats> = transaction {
        var scope = Events
            .select(Events.versionCode, Events.versionCode.count())
            .where { (Events.appId eq appId) and (Events.name eq eventName) and Events.versionCode.isNotNull() }
        fromTime?.let { scope = scope.andWhere { Events.createdAt greaterEq it } }
        toTime?.let { scope = scope.andWhere { Events.createdAt lessEq it } }
        val eventVersions = scope
            .groupBy(Events.versionCode)
            .associate { row ->
                row[Events.versionCode]!! to row[Events.versionCode.count()]
            }

        val versionNames = AppVersions
            .select(AppVersions.versionCode, AppVersions.versionName)
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode inList eventVersions.keys) }
            .associate { it[AppVersions.versionCode] to it[AppVersions.versionName] }

        eventVersions.map { (code, count) ->
            EventVersionStats(
                versionCode = code,
                versionName = versionNames[code],
                count = count
            )
        }.sortedByDescending { it.versionCode }
    }

    fun getVersionCodes(appId: UUID): List<VersionInfo> = transaction {
        // app_versions is auto-populated at ingest, so it covers every version that
        // has events — no need for a DISTINCT scan over the events table.
        AppVersions
            .select(AppVersions.versionCode, AppVersions.versionName)
            .where { AppVersions.appId eq appId }
            .orderBy(AppVersions.versionCode, SortOrder.DESC)
            .map { VersionInfo(it[AppVersions.versionCode], it[AppVersions.versionName]) }
    }

    fun findByAppId(
        appId: UUID,
        eventName: String? = null,
        versionCode: Long? = null,
        fromTime: OffsetDateTime? = null,
        toTime: OffsetDateTime? = null,
        page: Int = 1,
        pageSize: Int = 50
    ): PaginatedResponse<EventResponse> = transaction {
        var query = Events.selectAll().where { Events.appId eq appId }

        eventName?.let { query = query.andWhere { Events.name eq it } }
        versionCode?.let { query = query.andWhere { Events.versionCode eq it } }
        fromTime?.let { query = query.andWhere { Events.createdAt greaterEq it } }
        toTime?.let { query = query.andWhere { Events.createdAt lessEq it } }

        val total = query.count()
        val items = query
            .orderBy(Events.createdAt, SortOrder.DESC)
            .limit(pageSize).offset(((page - 1) * pageSize).toLong())
            .map { it.toEventResponse() }

        PaginatedResponse(items, total, page, pageSize)
    }

    fun getEventNames(appId: UUID): List<String> = transaction {
        Events.select(Events.name)
            .where { Events.appId eq appId }
            .withDistinct()
            .map { it[Events.name] }
            .sorted()
    }

    fun createEvents(
        appId: UUID,
        versionCode: Long,
        events: List<EventData>,
        deviceInfo: DeviceInfo
    ): Int = transaction {
        val inserted = Events.batchInsert(events) { event ->
            this[Events.appId] = appId
            this[Events.versionCode] = versionCode
            this[Events.name] = event.name
            this[Events.tags] = event.tags.ifEmpty { null }
            this[Events.eventFields] = event.fields.ifEmpty { null }
            this[Events.deviceInfo] = deviceInfo
            this[Events.createdAt] = OffsetDateTime.ofInstant(
                Instant.ofEpochMilli(event.time),
                ZoneOffset.UTC
            )
        }.size

        // Maintain the device_stats_daily rollup: the whole batch shares one device,
        // so it is at most 4 upserts per day covered by the batch.
        val dimensions = listOf(
            "model" to "${deviceInfo.manufacturer} ${deviceInfo.model}".trim().ifEmpty { "Unknown" },
            "os" to deviceInfo.osVersion.toString(),
            "country" to deviceInfo.country.uppercase().ifEmpty { "Unknown" },
            "language" to deviceInfo.language.ifEmpty { "Unknown" }
        )
        events
            .groupingBy { Instant.ofEpochMilli(it.time).atOffset(ZoneOffset.UTC).toLocalDate() }
            .eachCount()
            .forEach { (day, count) ->
                dimensions.forEach { (dimension, name) ->
                    exec(
                        """
                        INSERT INTO device_stats_daily (app_id, dimension, version_code, day, name, count)
                        VALUES (?, ?, ?, ?::date, ?, ?)
                        ON CONFLICT (app_id, dimension, version_code, day, name)
                        DO UPDATE SET count = device_stats_daily.count + EXCLUDED.count
                        """.trimIndent(),
                        listOf(
                            Events.appId.columnType to appId,
                            Events.name.columnType to dimension,
                            Events.id.columnType to versionCode,
                            Events.name.columnType to day.toString(),
                            Events.name.columnType to name,
                            Events.id.columnType to count.toLong()
                        )
                    )
                }
            }

        inserted
    }

    fun countByAppId(appId: UUID): Long = transaction {
        Events.selectAll().where { Events.appId eq appId }.count()
    }

    fun getDeviceStats(
        appId: UUID,
        versionCode: Long? = null,
        limit: Int = 10,
        fromDate: OffsetDateTime? = null,
        toDate: OffsetDateTime? = null
    ): DeviceStatsResponse = transaction {
        DeviceStatsResponse(
            models = topDeviceStats(appId, "model", versionCode, limit, fromDate, toDate),
            // The raw SDK_INT travels as-is: "34" is an API level, not a version
            // number, and only the UI knows how to name it.
            osVersions = topDeviceStats(appId, "os", versionCode, limit, fromDate, toDate),
            // The map paints every country it is given, so the country list is
            // not cut to the caller's top-N. There are ~250 ISO codes, a few
            // kilobytes at worst.
            countries = topDeviceStats(appId, "country", versionCode, maxOf(limit, 300), fromDate, toDate),
            languages = topDeviceStats(appId, "language", versionCode, limit, fromDate, toDate)
        )
    }

    /** The rollup keys days in UTC, so a range in any offset is read there. */
    private fun OffsetDateTime.utcDay(): String =
        withOffsetSameInstant(ZoneOffset.UTC).toLocalDate().toString()

    private fun Transaction.topDeviceStats(
        appId: UUID,
        dimension: String,
        versionCode: Long?,
        limit: Int,
        fromDate: OffsetDateTime?,
        toDate: OffsetDateTime?
    ): List<DeviceStatItem> {
        val versionFilter = if (versionCode != null) "AND version_code = ?" else ""
        // The rollup buckets by UTC day, so the range is compared as dates.
        val fromFilter = if (fromDate != null) "AND day >= ?::date" else ""
        val toFilter = if (toDate != null) "AND day <= ?::date" else ""
        val args = buildList {
            add(Events.appId.columnType to appId)
            add(Events.name.columnType to dimension)
            if (versionCode != null) add(Events.id.columnType to versionCode)
            fromDate?.let { add(Events.name.columnType to it.utcDay()) }
            toDate?.let { add(Events.name.columnType to it.utcDay()) }
            add(Events.id.columnType to limit.toLong())
        }
        return exec(
            """
            SELECT name, SUM(count) AS count
            FROM device_stats_daily
            WHERE app_id = ? AND dimension = ? $versionFilter $fromFilter $toFilter
            GROUP BY name
            ORDER BY count DESC
            LIMIT ?
            """.trimIndent(),
            args
        ) { rs ->
            val results = mutableListOf<DeviceStatItem>()
            while (rs.next()) {
                results.add(DeviceStatItem(rs.getString("name") ?: "Unknown", rs.getLong("count")))
            }
            results
        } ?: emptyList()
    }

    private fun ResultRow.toEventResponse() = EventResponse(
        id = this[Events.id],
        appId = this[Events.appId].toString(),
        versionCode = this[Events.versionCode],
        name = this[Events.name],
        tags = this[Events.tags],
        fields = this[Events.eventFields],
        deviceInfo = this[Events.deviceInfo],
        createdAt = this[Events.createdAt].toString()
    )
}
