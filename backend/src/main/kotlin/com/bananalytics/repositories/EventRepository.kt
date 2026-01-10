package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.*

object EventRepository {

    fun findByAppId(
        appId: UUID,
        eventName: String? = null,
        fromTime: OffsetDateTime? = null,
        toTime: OffsetDateTime? = null,
        page: Int = 1,
        pageSize: Int = 50
    ): PaginatedResponse<EventResponse> = transaction {
        var query = Events.selectAll().where { Events.appId eq appId }

        eventName?.let { query = query.andWhere { Events.name eq it } }
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
