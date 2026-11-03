package com.bananalytics.routes

import com.bananalytics.models.*
import com.bananalytics.repositories.*
import com.bananalytics.services.*
import com.bananalytics.support.TestDatabase
import com.bananalytics.support.TestDatabase.app
import com.bananalytics.support.api
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.BeforeClass
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.test.*

class TelemetryIntegrationTest {
    companion object { @BeforeClass @JvmStatic fun connect() = TestDatabase.connect() }
    private val environment = EnvironmentData("test.app", 1, "one", "device", 34, "Maker", "Phone", "RU", "en")
    private fun crash(id: UUID? = UUID.randomUUID(), thread: String = "main") = CrashData(
        System.currentTimeMillis(), thread, "java.lang.IllegalStateException: first\n\tat test.App.run(App.kt:1)",
        reportId = id?.toString())
    @BeforeTest fun reset() = TestDatabase.reset()

    @Test fun `invalid batch returns 400 and writes no reports groups or sessions`() = testApplication {
        api()
        val key = ApiKeyRepository.create(app, "SDK", null).apiKey
        val request = CrashesSubmitRequest(UUID.randomUUID().toString(), environment, listOf(crash(), crash(thread = "x".repeat(101))))
        val response = client.post("/api/v1/crashes/submit") {
            header("X-API-Key", key); contentType(ContentType.Application.Json); setBody(Json.encodeToString(request))
        }
        assertEquals(HttpStatusCode.BadRequest, response.status)
        for (table in listOf("crashes", "crash_groups", "app_sessions")) assertEquals(0L, TestDatabase.count(table), table)
    }

    @Test fun `a build with another package is rejected and writes nothing`() = testApplication {
        api()
        val key = ApiKeyRepository.create(app, "SDK", null).apiKey
        val foreign = environment.copy(packageName = "test.app.clone")
        val session = UUID.randomUUID().toString()
        val events = client.post("/api/v1/events/submit") {
            header("X-API-Key", key); contentType(ContentType.Application.Json)
            setBody(Json.encodeToString(EventsSubmitRequest(session, foreign, listOf(EventData("open", time = 1L)))))
        }
        val crashes = client.post("/api/v1/crashes/submit") {
            header("X-API-Key", key); contentType(ContentType.Application.Json)
            setBody(Json.encodeToString(CrashesSubmitRequest(session, foreign, listOf(crash()))))
        }
        assertEquals(HttpStatusCode.BadRequest, events.status)
        assertEquals(HttpStatusCode.BadRequest, crashes.status)
        for (table in listOf("crashes", "app_sessions", "app_versions")) assertEquals(0L, TestDatabase.count(table))
    }

    @Test fun `database failure in a later report rolls back the entire batch`() {
        val session = UUID.randomUUID().toString()
        val invalidClass = crash().copy(stacktrace = "X".repeat(513) + ": failure")
        assertFails { CrashService.processCrashes(app, environment, listOf(crash(), invalidClass), session) }
        for (table in listOf("crashes", "crash_groups", "app_sessions", "app_versions")) assertEquals(0L, TestDatabase.count(table), table)
    }

    @Test fun `concurrent retries do not duplicate reports or group counters`() {
        val report = crash()
        val pool = Executors.newFixedThreadPool(8)
        try {
            val work = (1..16).map { pool.submit<Int> { CrashService.processCrashes(app, environment, listOf(report)) } }
            work.forEach { assertEquals(1, it.get()) }
        } finally { pool.shutdownNow() }
        assertEquals(1L, TestDatabase.count("crashes"))
        assertEquals(1, CrashRepository.findGroupsByAppId(app).items.single().occurrences)
        CrashService.processCrashes(TestDatabase.other, environment.copy(packageName = "other.app"), listOf(report))
        assertEquals(2L, TestDatabase.count("crashes"))
    }

    @Test fun `legacy clients remain supported and distinct new reports keep separate IDs`() {
        val legacy = crash(null)
        CrashService.processCrashes(app, environment, listOf(legacy, legacy))
        val first = crash()
        CrashService.processCrashes(app, environment, listOf(first, first.copy(reportId = UUID.randomUUID().toString())))
        assertEquals(4L, TestDatabase.count("crashes"))
        assertEquals(4, CrashRepository.findGroupsByAppId(app).items.single().occurrences)
    }

    @Test fun `device statistics count sessions instead of event batches and honor exact time bounds`() {
        val session = UUID.randomUUID().toString()
        val events = List(20) { EventData("open", time = System.currentTimeMillis()) }
        repeat(2) { EventService.processEvents(app, environment, events, session) }
        val now = OffsetDateTime.parse("2026-10-20T12:00:00Z")
        TestDatabase.sql("UPDATE app_sessions SET first_seen='$now', last_seen='$now'")
        assertEquals(40L, TestDatabase.count("events"))
        assertEquals(1L, TestDatabase.count("app_sessions"))
        val stats = DeviceStatsRepository.getStats(app, fromDate = now, toDate = now)
        assertEquals(listOf(DeviceStatItem("Maker Phone", 1)), stats.models)
        assertEquals(listOf(DeviceStatItem("RU", 1)), stats.countries)
        assertEquals(emptyList(), DeviceStatsRepository.getStats(app, fromDate = now.plusSeconds(1), toDate = now.plusHours(1)).models)
        assertEquals(emptyList(), DeviceStatsRepository.getStats(app, fromDate = now.minusHours(1), toDate = now.minusSeconds(1)).models)
        assertEquals(emptyList(), DeviceStatsRepository.getStats(app, fromDate = now.plusHours(1), toDate = now.minusHours(1)).models)
    }

    @Test fun `muted and empty batches do not create active sessions`() {
        val version = VersionRepository.findOrCreate(app, 1, "one")
        VersionRepository.updateMuteSettings(app, UUID.fromString(version.id), true, true)
        val session = UUID.randomUUID().toString()
        EventService.processEvents(app, environment, listOf(EventData("open", time = System.currentTimeMillis())), session)
        CrashService.processCrashes(app, environment, listOf(crash()), session)
        EventService.processEvents(app, environment, emptyList(), session)
        CrashService.processCrashes(app, environment, emptyList(), session)
        assertEquals(0L, TestDatabase.count("app_sessions"))
    }

    @Test fun `old sessions without device information stay visible as unknown`() {
        AppSessionRepository.recordSession(app, UUID.randomUUID(), 1, "old-device", hasEvent = true)
        assertEquals(listOf(DeviceStatItem("Unknown", 1)), DeviceStatsRepository.getStats(app).models)
    }

    @Test fun `parallel first session observations merge crash and event flags`() {
        val session = UUID.randomUUID()
        val pool = Executors.newFixedThreadPool(8)
        try {
            val work = (1..16).map { n -> pool.submit {
                AppSessionRepository.recordSession(app, session, 1, "device", hasEvent = n % 2 == 0, hasCrash = n % 2 == 1)
            } }
            work.forEach { it.get() }
        } finally { pool.shutdownNow() }
        val now = OffsetDateTime.now()
        val overview = AppSessionRepository.getOverview(app, now.minusDays(1), now.plusDays(1))
        assertEquals(1L, overview.activity.single().sessions)
        assertEquals(0L, overview.crashFree.single().crashFreeSessions)
    }
}
