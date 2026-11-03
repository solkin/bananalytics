package com.bananalytics.repositories

import com.bananalytics.support.TestDatabase
import com.bananalytics.support.TestDatabase.app
import org.junit.BeforeClass
import java.io.File
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.*

class SessionDeviceBackfillTest {
    companion object { @BeforeClass @JvmStatic fun connect() = TestDatabase.connect() }
    @BeforeTest fun reset() = TestDatabase.reset()

    private val day = "2026-03-10"

    /* The script commits per day, which only works outside an open transaction. */
    private fun runBackfill() {
        val password = System.getenv("TEST_DATABASE_PASSWORD") ?: "perf-local"
        DriverManager.getConnection(System.getenv("TEST_DATABASE_URL"), "bananalytics", password).use { connection ->
            connection.createStatement().use { it.execute(File("scripts/backfill_session_device_info.sql").readText()) }
        }
    }

    private fun event(device: String, at: String, model: String = "Pixel 8") = TestDatabase.sql(
        """
        INSERT INTO events (app_id, version_code, name, device_info, created_at) VALUES ('$app', 1, 'open',
          '{"device_id":"$device","os_version":34,"manufacturer":"Google","model":"$model","country":"de","language":"de"}', '$at')
        """.trimIndent()
    )

    private fun session(device: String, at: String, hasEvent: Boolean = true): String {
        val id = UUID.randomUUID().toString()
        TestDatabase.sql(
            """
            INSERT INTO app_sessions (app_id, session_id, version_code, device_id, has_event, first_seen, last_seen)
            VALUES ('$app', '$id', 1, '$device', $hasEvent, '$at', '$at')
            """.trimIndent()
        )
        return id
    }

    /** Puts the counters where migration 017 left them: every session under Unknown. */
    private fun countAllAsUnknown() = TestDatabase.sql(
        """
        INSERT INTO session_device_stats_daily (app_id, day, version_code, dimension, name, count)
        SELECT app_id, (first_seen AT TIME ZONE 'UTC')::date, version_code, dimension, 'Unknown', COUNT(*)
        FROM app_sessions CROSS JOIN (VALUES ('model'), ('os'), ('country'), ('language')) d(dimension)
        WHERE has_event GROUP BY 1, 2, 3, 4
        """.trimIndent()
    )

    private fun counts(dimension: String): Map<String, Long> = query(
        "SELECT name, count FROM session_device_stats_daily WHERE dimension = '$dimension' AND count > 0"
    ).associate { it[0]!! to it[1]!!.toLong() }

    private fun model(session: String): String? =
        query("SELECT device_info->>'model' FROM app_sessions WHERE session_id = '$session'").single()[0]

    private fun query(sql: String): List<List<String?>> {
        val password = System.getenv("TEST_DATABASE_PASSWORD") ?: "perf-local"
        return DriverManager.getConnection(System.getenv("TEST_DATABASE_URL"), "bananalytics", password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(sql).use { rows ->
                    buildList { while (rows.next()) add((1..rows.metaData.columnCount).map(rows::getString)) }
                }
            }
        }
    }

    @Test fun `a session takes the device info of the same device on the same day`() {
        event("a", "$day 10:00:00+00")
        val session = session("a", "$day 09:00:00+00")
        countAllAsUnknown()
        runBackfill()
        assertEquals("Pixel 8", model(session))
        assertEquals(mapOf("Google Pixel 8" to 1L), counts("model"))
        assertEquals(mapOf("34" to 1L), counts("os"))
        assertEquals(mapOf("DE" to 1L), counts("country"))
        assertEquals(mapOf("de" to 1L), counts("language"))
    }

    @Test fun `the first event of the day decides when a device changed`() {
        event("a", "$day 12:00:00+00", model = "Later")
        event("a", "$day 08:00:00+00", model = "Earlier")
        val session = session("a", "$day 09:00:00+00")
        runBackfill()
        assertEquals("Earlier", model(session))
    }

    @Test fun `a session without an event of its device that day stays Unknown`() {
        event("other", "$day 10:00:00+00")
        event("a", "2026-03-11 00:00:00+00")
        event("a", "2026-03-09 23:59:59+00")
        val session = session("a", "$day 09:00:00+00")
        countAllAsUnknown()
        runBackfill()
        assertNull(model(session))
        assertEquals(mapOf("Unknown" to 1L), counts("model"))
    }

    @Test fun `only part of a day moves out of Unknown`() {
        event("a", "$day 10:00:00+00")
        session("a", "$day 09:00:00+00")
        session("missing", "$day 09:00:00+00")
        countAllAsUnknown()
        runBackfill()
        assertEquals(mapOf("Google Pixel 8" to 1L, "Unknown" to 1L), counts("model"))
    }

    @Test fun `a session without events gains info but is not counted`() {
        event("a", "$day 10:00:00+00")
        val session = session("a", "$day 09:00:00+00", hasEvent = false)
        runBackfill()
        assertEquals("Pixel 8", model(session))
        assertEquals(emptyMap(), counts("model"))
    }

    @Test fun `a second run changes nothing`() {
        event("a", "$day 10:00:00+00")
        session("a", "$day 09:00:00+00")
        session("missing", "$day 09:00:00+00")
        countAllAsUnknown()
        runBackfill()
        val first = counts("model")
        runBackfill()
        assertEquals(first, counts("model"))
    }
}
