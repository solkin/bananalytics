package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import java.util.*

object EventRepository {

    fun getEventSummary(
        appId: UUID,
        versionCode: Long? = null
    ): List<EventSummaryResponse> = transaction {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val startOfDay = now.truncatedTo(ChronoUnit.DAYS)
        val startOfMonth = now.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS)

        // Build base condition
        val baseCondition = if (versionCode != null) {
            Op.build { (Events.appId eq appId) and (Events.versionCode eq versionCode) }
        } else {
            Op.build { Events.appId eq appId }
        }

        // Get all unique event names with total count
        val totals = Events
            .select(Events.name, Events.name.count())
            .where { baseCondition }
            .groupBy(Events.name)
            .associate { it[Events.name] to it[Events.name.count()] }

        // Get counts for this month
        val monthCounts = Events
            .select(Events.name, Events.name.count())
            .where { baseCondition and (Events.createdAt greaterEq startOfMonth) }
            .groupBy(Events.name)
            .associate { it[Events.name] to it[Events.name.count()] }

        // Get counts for today
        val dayCounts = Events
            .select(Events.name, Events.name.count())
            .where { baseCondition and (Events.createdAt greaterEq startOfDay) }
            .groupBy(Events.name)
            .associate { it[Events.name] to it[Events.name.count()] }

        totals.map { (name, total) ->
            EventSummaryResponse(
                name = name,
                total = total,
                thisMonth = monthCounts[name] ?: 0,
                today = dayCounts[name] ?: 0
            )
        }.sortedByDescending { it.total }
    }

    fun findByAppIdAndName(
        appId: UUID,
        eventName: String,
        versionCode: Long? = null,
        page: Int = 1,
        pageSize: Int = 50
    ): PaginatedResponse<EventResponse> = transaction {
        var query = Events.selectAll()
            .where { (Events.appId eq appId) and (Events.name eq eventName) }

        versionCode?.let { query = query.andWhere { Events.versionCode eq it } }

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
        toDate: OffsetDateTime
    ): List<DailyStat> = transaction {
        exec(
            """
            SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count
            FROM events
            WHERE app_id = ? AND name = ? AND created_at >= ? AND created_at <= ?
            GROUP BY 1
            ORDER BY 1
            """.trimIndent(),
            listOf(
                Events.appId.columnType to appId,
                Events.name.columnType to eventName,
                Events.createdAt.columnType to fromDate,
                Events.createdAt.columnType to toDate
            )
        ) { rs ->
            val results = mutableListOf<DailyStat>()
            while (rs.next()) {
                results.add(DailyStat(rs.getString("day"), rs.getLong("count")))
            }
            results
        } ?: emptyList()
    }

    fun getVersionsForEvent(appId: UUID, eventName: String): List<EventVersionStats> = transaction {
        val eventVersions = Events
            .select(Events.versionCode, Events.versionCode.count())
            .where { (Events.appId eq appId) and (Events.name eq eventName) and Events.versionCode.isNotNull() }
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
        limit: Int = 10
    ): DeviceStatsResponse = transaction {
        DeviceStatsResponse(
            models = topDeviceStats(appId, "model", versionCode, limit),
            osVersions = topDeviceStats(appId, "os", versionCode, limit) { name ->
                if (name == "Unknown") name else "Android $name"
            },
            // The map paints every country it is given, so the country list is
            // not cut to the caller's top-N. There are ~250 ISO codes, a few
            // kilobytes at worst.
            countries = topDeviceStats(appId, "country", versionCode, maxOf(limit, 300)),
            languages = topDeviceStats(appId, "language", versionCode, limit)
        )
    }

    private fun Transaction.topDeviceStats(
        appId: UUID,
        dimension: String,
        versionCode: Long?,
        limit: Int,
        display: (String) -> String = { it }
    ): List<DeviceStatItem> {
        val versionFilter = if (versionCode != null) "AND version_code = ?" else ""
        val args = buildList {
            add(Events.appId.columnType to appId)
            add(Events.name.columnType to dimension)
            if (versionCode != null) add(Events.id.columnType to versionCode)
            add(Events.id.columnType to limit.toLong())
        }
        return exec(
            """
            SELECT name, SUM(count) AS count
            FROM device_stats_daily
            WHERE app_id = ? AND dimension = ? $versionFilter
            GROUP BY name
            ORDER BY count DESC
            LIMIT ?
            """.trimIndent(),
            args
        ) { rs ->
            val results = mutableListOf<DeviceStatItem>()
            while (rs.next()) {
                results.add(DeviceStatItem(display(rs.getString("name") ?: "Unknown"), rs.getLong("count")))
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
