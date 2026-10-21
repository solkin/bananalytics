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
        val counts = EventStatsQuery(appId, versionCode, fromDate, toDate)
        exec(
            "SELECT name, day, SUM(count) AS count FROM (${counts.sql}) counts GROUP BY 1, 2 ORDER BY 1, 2",
            counts.args
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

        val total = eventCount(appId, eventName, versionCode, fromTime, toTime)
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
        val counts = EventStatsQuery(appId, versionCode, fromDate, toDate, eventName)
        exec(
            "SELECT day, SUM(count) AS count FROM (${counts.sql}) counts GROUP BY 1 ORDER BY 1",
            counts.args
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
        val counts = EventStatsQuery(appId, from = fromTime, to = toTime, eventName = eventName)
        val eventVersions = exec(
            "SELECT version_code, SUM(count) AS count FROM (${counts.sql}) counts " +
                "WHERE version_code IS NOT NULL GROUP BY 1",
            counts.args
        ) { rs ->
            buildMap { while (rs.next()) put(rs.getLong("version_code"), rs.getLong("count")) }
        } ?: emptyMap()

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

        val total = eventCount(appId, eventName, versionCode, fromTime, toTime)
        val items = query
            .orderBy(Events.createdAt, SortOrder.DESC)
            .limit(pageSize).offset(((page - 1) * pageSize).toLong())
            .map { it.toEventResponse() }

        PaginatedResponse(items, total, page, pageSize)
    }

    fun getEventNames(appId: UUID): List<String> = transaction {
        exec(
            "SELECT DISTINCT name FROM event_stats_daily WHERE app_id = ? AND count > 0 ORDER BY name",
            listOf(Events.appId.columnType to appId)
        ) { rs -> buildList { while (rs.next()) add(rs.getString("name")) } } ?: emptyList()
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

        // Use a stable lock order when concurrent batches share counters.
        events.groupingBy {
            Instant.ofEpochMilli(it.time).atOffset(ZoneOffset.UTC).toLocalDate() to it.name
        }.eachCount().toList().sortedWith(compareBy({ it.first.first }, { it.first.second }))
            .forEach { (key, count) ->
                exec(
                    """
                    INSERT INTO event_stats_daily (app_id, day, version_code, name, count)
                    VALUES (?, ?::date, ?, ?, ?)
                    ON CONFLICT (app_id, day, version_code, name)
                    DO UPDATE SET count = event_stats_daily.count + EXCLUDED.count
                    """.trimIndent(),
                    listOf(
                        Events.appId.columnType to appId,
                        Events.name.columnType to key.first.toString(),
                        Events.versionCode.columnType to versionCode,
                        Events.name.columnType to key.second,
                        Events.id.columnType to count.toLong()
                    )
                )
            }

        // Maintain the device_stats_daily rollup: the whole batch shares one device,
        // so it is at most 4 upserts per day covered by the batch.
        val dimensions = listOf(
            "model" to "${deviceInfo.manufacturer} ${deviceInfo.model}".trim().ifEmpty { "Unknown" },
            "os" to deviceInfo.osVersion.toString(),
            "country" to deviceInfo.country.uppercase().ifEmpty { "Unknown" },
            "language" to deviceInfo.language.ifEmpty { "Unknown" }
        ).sortedBy { it.first }
        events
            .groupingBy { Instant.ofEpochMilli(it.time).atOffset(ZoneOffset.UTC).toLocalDate() }
            .eachCount().toSortedMap()
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
        eventCount(appId)
    }

    private fun Transaction.eventCount(
        appId: UUID, eventName: String? = null, versionCode: Long? = null,
        from: OffsetDateTime? = null, to: OffsetDateTime? = null
    ): Long {
        val counts = EventStatsQuery(appId, versionCode, from, to, eventName)
        return exec("SELECT COALESCE(SUM(count), 0) FROM (${counts.sql}) counts", counts.args) {
            it.next(); it.getLong(1)
        } ?: 0L
    }

    fun getDeviceStats(
        appId: UUID,
        versionCode: Long? = null,
        limit: Int = 10,
        fromDate: OffsetDateTime? = null,
        toDate: OffsetDateTime? = null
    ): DeviceStatsResponse = transaction {
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(Events.appId.columnType to appId)
        val filters = buildString {
            if (versionCode != null) {
                append(" AND version_code = ?")
                args.add(Events.versionCode.columnType to versionCode)
            }
            fromDate?.let {
                append(" AND day >= ?::date")
                args.add(Events.name.columnType to it.withOffsetSameInstant(ZoneOffset.UTC).toLocalDate().toString())
            }
            toDate?.let {
                append(" AND day <= ?::date")
                args.add(Events.name.columnType to it.withOffsetSameInstant(ZoneOffset.UTC).toLocalDate().toString())
            }
        }
        val byDimension = exec(
            """
            SELECT dimension, name, SUM(count) AS count
            FROM device_stats_daily WHERE app_id = ? AND count > 0 $filters
            GROUP BY dimension, name ORDER BY count DESC, name
            """.trimIndent(), args
        ) { rs ->
            val result = mutableMapOf<String, MutableList<DeviceStatItem>>()
            while (rs.next()) result.getOrPut(rs.getString("dimension")) { mutableListOf() }
                .add(DeviceStatItem(rs.getString("name"), rs.getLong("count")))
            result
        } ?: emptyMap()
        DeviceStatsResponse(
            models = byDimension["model"].orEmpty().take(limit),
            osVersions = byDimension["os"].orEmpty().take(limit),
            countries = byDimension["country"].orEmpty().take(maxOf(limit, 300)),
            languages = byDimension["language"].orEmpty().take(limit)
        )
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
