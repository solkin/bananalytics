package com.bananalytics.repositories

import com.bananalytics.models.DeviceStatItem
import com.bananalytics.models.DeviceStatsResponse
import org.jetbrains.exposed.sql.IntegerColumnType
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.statements.StatementType
import java.time.OffsetDateTime
import java.util.UUID

object DeviceStatsRepository {
    fun getStats(
        appId: UUID,
        versionCode: Long? = null,
        limit: Int = 10,
        fromDate: OffsetDateTime? = null,
        toDate: OffsetDateTime? = null
    ): DeviceStatsResponse = transaction {
        val counts = SessionDeviceStatsQuery(appId, versionCode, fromDate, toDate)
        val byDimension = exec(
            """
            WITH counts AS (
                SELECT dimension, name, SUM(count) AS count FROM (${counts.sql}) buckets
                GROUP BY dimension, name
            ), ranked AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY dimension ORDER BY count DESC, name) AS rank
                FROM counts
            )
            SELECT dimension, name, count FROM ranked
            WHERE rank <= CASE WHEN dimension = 'country' THEN ? ELSE ? END
            ORDER BY dimension, rank
            """.trimIndent(),
            counts.args + listOf(IntegerColumnType() to maxOf(limit, 300), IntegerColumnType() to limit), StatementType.SELECT
        ) { rs ->
            buildMap<String, MutableList<DeviceStatItem>> {
                while (rs.next()) getOrPut(rs.getString("dimension")) { mutableListOf() }
                    .add(DeviceStatItem(rs.getString("name"), rs.getLong("count")))
            }
        }.orEmpty()
        DeviceStatsResponse(
            models = byDimension["model"].orEmpty(),
            osVersions = byDimension["os"].orEmpty(),
            countries = byDimension["country"].orEmpty(),
            languages = byDimension["language"].orEmpty()
        )
    }
}
