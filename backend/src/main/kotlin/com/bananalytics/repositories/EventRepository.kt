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
        val eventVersionCodes = Events
            .select(Events.versionCode)
            .where { (Events.appId eq appId) and Events.versionCode.isNotNull() }
            .withDistinct()
            .mapNotNull { it[Events.versionCode] }
            .toSet()

        val versionNames = AppVersions
            .select(AppVersions.versionCode, AppVersions.versionName)
            .where { (AppVersions.appId eq appId) and (AppVersions.versionCode inList eventVersionCodes) }
            .associate { it[AppVersions.versionCode] to it[AppVersions.versionName] }

        eventVersionCodes.map { code ->
            VersionInfo(
                versionCode = code,
                versionName = versionNames[code]
            )
        }.sortedByDescending { it.versionCode }
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
        Events.batchInsert(events) { event ->
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
    }

    fun countByAppId(appId: UUID): Long = transaction {
        Events.selectAll().where { Events.appId eq appId }.count()
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
