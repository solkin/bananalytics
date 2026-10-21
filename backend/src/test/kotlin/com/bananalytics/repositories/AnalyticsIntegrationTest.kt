package com.bananalytics.repositories

import com.bananalytics.models.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import org.junit.Assume.assumeNotNull
import org.junit.BeforeClass
import java.io.File
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.test.*

class AnalyticsIntegrationTest {
    companion object {
        private val app = UUID.fromString("00000000-0000-0000-0000-000000000001")
        private val other = UUID.fromString("00000000-0000-0000-0000-000000000002")
        private val device = DeviceInfo("device", 34, "Test", "Phone", "ru", "en")
        private fun date(value: String) = OffsetDateTime.parse(value)
        private fun event(at: String, name: String = "open") = EventData(name = name, time = date(at).toInstant().toEpochMilli())
        private fun sql(value: String) = transaction { exec(value); Unit }

        @BeforeClass @JvmStatic fun connect() {
            val url = System.getenv("TEST_DATABASE_URL")
            assumeNotNull(url)
            require(url!!.endsWith("/bananalytics_test")) { "Use a disposable bananalytics_test database" }
            Database.connect(url, "org.postgresql.Driver", "bananalytics", System.getenv("TEST_DATABASE_PASSWORD") ?: "perf-local")
            sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
            sql(File("src/main/resources/db/init.sql").readText())
            File("src/main/resources/db/migrations").listFiles()!!.filter { it.extension == "sql" }
                .sortedBy { it.name }.forEach { sql(it.readText()) }
        }
    }

    @BeforeTest fun reset() {
        sql("TRUNCATE apps, events, event_stats_daily, device_stats_daily RESTART IDENTITY CASCADE")
        sql("INSERT INTO apps (id,name,package_name) VALUES ('$app','Test','test.app'), ('$other','Other','test.other')")
        VersionRepository.findOrCreate(app, 1, "one")
        VersionRepository.findOrCreate(app, 2, "two")
    }

    private fun seed() {
        EventRepository.createEvents(app, 1, listOf(
            event("2026-09-22T23:59:59Z"), event("2026-09-23T12:00:00Z"),
            event("2026-09-24T00:00:00Z"), event("2026-09-24T12:00:00Z", "quoted ' событие"),
            event("2026-09-30T23:59:59Z"), event("2026-10-01T00:00:00Z"),
            event("2026-10-02T00:00:00Z"), event("2026-10-02T12:00:00Z"), event("2026-10-02T12:00:00.001Z")
        ), device)
        EventRepository.createEvents(app, 2, listOf(event("2026-09-24T09:00:00Z")), device)
        EventRepository.createEvents(other, 1, listOf(event("2026-09-24T09:00:00Z", "other")), device)
    }

    private fun assertSummary(from: String, to: String, version: Long? = null) {
        val lower = date(from); val upper = date(to)
        val expected = transaction {
            exec("""
                SELECT name, (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS count FROM events
                WHERE app_id = '$app' AND created_at >= '$lower' AND created_at <= '$upper'
                ${if (version == null) "" else "AND version_code = $version"}
                GROUP BY 1,2 ORDER BY 1,2
            """.trimIndent()) { rs ->
                buildMap<Pair<String, String>, Long> { while (rs.next()) put(rs.getString("name") to rs.getString("day"), rs.getLong("count")) }
            }!!
        }
        val actual = EventRepository.getEventSummary(app, version, lower, upper)
        assertEquals(expected, actual.flatMap { e -> e.daily.map { (e.name to it.date) to it.count } }.toMap())
        actual.forEach { assertEquals(it.daily.sumOf { d -> d.count }, it.total) }
        val detail = EventRepository.getEventStatsByName(app, "open", lower, upper, version)
        assertEquals(expected.filterKeys { it.first == "open" }.mapKeys { it.key.second }, detail.associate { it.date to it.count })
        val page = EventRepository.findByAppIdAndName(app, "open", version, lower, upper)
        assertEquals(expected.filterKeys { it.first == "open" }.values.sum(), page.total)
    }

    @Test fun `rollups exactly match raw inclusive windows and UTC boundaries`() {
        seed()
        val windows = listOf(
            "2026-09-23T12:00:00Z" to "2026-10-02T12:00:00Z",
            "2026-09-24T00:00:00Z" to "2026-10-02T00:00:00Z",
            "2026-09-24T00:00:00Z" to "2026-09-24T00:00:00Z",
            "2026-09-24T08:00:00Z" to "2026-09-24T13:00:00Z",
            "2026-09-23T15:00:00+03:00" to "2026-10-02T02:00:00-10:00",
            "2026-10-01T12:00:00Z" to "2026-09-24T13:00:00Z"
        )
        for ((from, to) in windows) for (version in listOf(null, 1L, 2L, 999L)) assertSummary(from, to, version)
    }

    @Test fun `backfill includes legacy null versions without merging a real minus one version`() {
        seed()
        sql("INSERT INTO events (app_id,version_code,name,created_at) VALUES ('$app',NULL,'legacy','2026-09-24'), ('$app',-1,'legacy','2026-09-24')")
        sql("TRUNCATE event_stats_daily")
        sql(File("src/main/resources/db/migrations/015_analytics_rollups.sql").readText())
        assertSummary("2026-09-23T12:00:00Z", "2026-10-02T12:00:00Z")
        assertSummary("2026-09-23T12:00:00Z", "2026-10-02T12:00:00Z", -1)
        assertEquals(2L, EventRepository.getEventSummary(app, null, date("2026-09-23T12:00:00Z"), date("2026-10-02T12:00:00Z")).single { it.name == "legacy" }.total)
        assertEquals(listOf(-1L), EventRepository.getVersionsForEvent(app, "legacy").map { it.versionCode })
    }

    @Test fun `optional bounds and event version totals match raw data`() {
        seed()
        assertEquals(8L, EventRepository.getVersionsForEvent(app, "open").single { it.versionCode == 1L }.count)
        assertEquals(6L, EventRepository.getVersionsForEvent(app, "open", date("2026-09-24T00:00:00Z")).single { it.versionCode == 1L }.count)
        assertEquals(3L, EventRepository.getVersionsForEvent(app, "open", toTime = date("2026-09-24T00:00:00Z")).single { it.versionCode == 1L }.count)
        assertEquals(10L, EventRepository.countByAppId(app))
        assertEquals(listOf("open", "quoted ' событие"), EventRepository.getEventNames(app))
        assertEquals(emptyList(), EventRepository.getVersionsForEvent(app, "missing"))
    }

    @Test fun `retention decrements counters in every batch including a partial day`() {
        seed()
        var deleted: Long
        do { deleted = DataRetentionRepository.deleteEvents(app, date("2026-09-24T12:00:00Z"), 2) } while (deleted > 0)
        assertEquals(6L, EventRepository.countByAppId(app))
        assertSummary("2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z")
        assertEquals(1L, EventRepository.countByAppId(other))
        val stats = EventRepository.getDeviceStats(app, fromDate = date("2026-09-24T00:00:00Z"), toDate = date("2026-09-24T23:59:59Z"))
        assertEquals(listOf(DeviceStatItem("Test Phone", 1)), stats.models)
        assertEquals(listOf(DeviceStatItem("RU", 1)), stats.countries)
    }

    @Test fun `deleting a version removes its rollups without changing another app`() {
        seed()
        val version = VersionRepository.findByAppAndVersionCode(app, 1)!!
        assertTrue(VersionRepository.delete(app, UUID.fromString(version.id)))
        assertEquals(1L, EventRepository.countByAppId(app))
        assertEquals(1L, EventRepository.countByAppId(other))
        assertSummary("2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z")
    }

    @Test fun `concurrent ingest does not lose counts`() {
        val pool = Executors.newFixedThreadPool(8)
        try {
            val events = List(20) { event("2026-09-24T12:00:00Z", "event-${it % 3}") }
            val futures = (1..24).map { pool.submit<Int> { EventRepository.createEvents(app, 1, if (it % 2 == 0) events.reversed() else events, device) } }
            futures.forEach { assertEquals(20, it.get()) }
            assertEquals(480L, EventRepository.countByAppId(app))
            assertSummary("2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z")
        } finally { pool.shutdownNow() }
    }

    @Test fun `raw inserts and counters roll back together`() {
        assertFails { transaction { EventRepository.createEvents(app, 1, listOf(event("2026-09-24T12:00:00Z")), device); error("rollback") } }
        assertEquals(0L, EventRepository.countByAppId(app))
        assertEquals(0L, EventRepository.findByAppId(app).total)
    }

    @Test fun `retention and ingest can update the same buckets concurrently`() {
        val pool = Executors.newFixedThreadPool(5)
        try {
            val writers = (1..4).map { worker -> pool.submit {
                repeat(12) {
                    EventRepository.createEvents(app, (worker % 2 + 1).toLong(), listOf(
                        event("2026-09-24T01:00:00Z", "first"),
                        event("2026-09-25T01:00:00Z", "second"),
                        event("2026-09-24T02:00:00Z", "second")
                    ).let { if (worker % 2 == 0) it.reversed() else it }, device)
                }
            } }
            val trimming = pool.submit { repeat(30) { DataRetentionRepository.deleteEvents(app, date("2026-09-26T00:00:00Z"), 7) } }
            (writers + trimming).forEach { it.get() }
            assertSummary("2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z")
            val count = EventRepository.findByAppId(app).total
            assertEquals(count, EventRepository.countByAppId(app))
            assertEquals(count, EventRepository.getDeviceStats(app).models.sumOf { it.count })
        } finally { pool.shutdownNow() }
    }

    @Test fun `deleting an app clears counters and keeps other apps intact`() {
        seed()
        assertTrue(AppRepository.delete(app))
        assertEquals(0L, EventRepository.countByAppId(app))
        assertEquals(emptyList(), EventRepository.getEventNames(app))
        assertEquals(1L, EventRepository.countByAppId(other))
    }

    @Test fun `retention handles legacy null versions and later arrivals to an emptied bucket`() {
        sql("INSERT INTO events (app_id,version_code,name,created_at) VALUES ('$app',NULL,'legacy','2026-09-24'), ('$app',1,'open','2026-09-24')")
        sql("TRUNCATE event_stats_daily")
        sql(File("src/main/resources/db/migrations/015_analytics_rollups.sql").readText())
        assertEquals(2L, DataRetentionRepository.deleteEvents(app, date("2026-09-25T00:00:00Z"), 10))
        assertEquals(0L, EventRepository.countByAppId(app))
        assertEquals(emptyList(), EventRepository.getEventNames(app))
        EventRepository.createEvents(app, 1, listOf(event("2026-09-24T12:00:00Z")), device)
        assertEquals(1L, EventRepository.countByAppId(app))
        assertSummary("2026-09-23T00:00:00Z", "2026-09-26T00:00:00Z")
    }

    @Test fun `combined overview equals legacy endpoints with cross version and null devices`() {
        sql("""
            INSERT INTO app_sessions (app_id,session_id,version_code,device_id,has_event,has_crash,first_seen,last_seen) VALUES
            ('$app',gen_random_uuid(),1,'same',true,false,'2026-09-24 01:00+00',now()),
            ('$app',gen_random_uuid(),2,'same',true,true,'2026-09-24 02:00+00',now()),
            ('$app',gen_random_uuid(),1,NULL,true,false,'2026-09-24 03:00+00',now()),
            ('$app',gen_random_uuid(),1,'crash-only',false,true,'2026-09-25 03:00+00',now()),
            ('$other',gen_random_uuid(),1,'other',true,false,'2026-09-24 01:00+00',now())
        """.trimIndent())
        val from = date("2026-09-23T00:00:00Z"); val to = date("2026-09-26T00:00:00Z")
        val overview = AppSessionRepository.getOverview(app, from, to)
        assertEquals(AppSessionRepository.getDailyActivity(app, from, to).map { DailyActivityResponse(it.date,it.sessions,it.users) }, overview.activity)
        assertEquals(AppSessionRepository.getUniqueSessionsByVersion(app, from, to).map { SessionVersionStats(it.date,it.versionCode,it.versionName,it.count) }, overview.versions)
        assertEquals(AppSessionRepository.getCrashFreeStats(app, from, to).map { CrashFreeStatsResponse(it.date,it.totalSessions,it.crashFreeSessions,it.crashFreeRate) }, overview.crashFree)
        assertEquals(1L, overview.activity.single().users)
        assertEquals(3L, overview.activity.single().sessions)
        assertEquals(SessionOverviewResponse(emptyList(), emptyList(), emptyList()), AppSessionRepository.getOverview(app, to, from))
    }

    @Test fun `device aggregation preserves dimensions versions limits and UTC day filters`() {
        seed()
        val stats = EventRepository.getDeviceStats(app, 1, 1, date("2026-09-24T03:00:00+03:00"), date("2026-09-24T23:00:00Z"))
        assertEquals(listOf(DeviceStatItem("Test Phone",2)),stats.models)
        assertEquals(listOf(DeviceStatItem("34",2)),stats.osVersions)
        assertEquals(listOf(DeviceStatItem("RU",2)),stats.countries)
        assertEquals(listOf(DeviceStatItem("en",2)),stats.languages)
    }

    @Test fun `distinct devices preserve case and Unicode byte identity`() {
        sql("""
            INSERT INTO app_sessions (app_id,session_id,version_code,device_id,has_event,first_seen,last_seen)
            SELECT '$app',gen_random_uuid(),1,device,true,'2026-09-24 12:00+00',now()
            FROM (VALUES ('A'),('a'),('é'),('é'),('ß'),('ss'),('Σ'),('σ')) devices(device)
        """.trimIndent())
        val from = date("2026-09-23T00:00:00Z"); val to = date("2026-09-25T00:00:00Z")
        assertEquals(8L, AppSessionRepository.getOverview(app, from, to).activity.single().users)
        assertEquals(8L, AppSessionRepository.getDailyActivity(app, from, to).single().users)
    }
}
