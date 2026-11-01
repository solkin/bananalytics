package com.bananalytics.repositories

import com.bananalytics.models.*
import com.bananalytics.support.TestDatabase
import com.bananalytics.support.TestDatabase.app
import org.junit.BeforeClass
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.*

class DeviceStatsIntegrationTest {
    companion object { @BeforeClass @JvmStatic fun connect() = TestDatabase.connect() }
    private val device = DeviceInfo("device", 34, "Maker", "Phone", "ru", "en")
    private fun at(value: String) = OffsetDateTime.parse(value)
    @BeforeTest fun reset() = TestDatabase.reset()

    private fun session(at: String, version: Long = 1, info: DeviceInfo? = device, appId: UUID = app): UUID {
        val id = UUID.randomUUID()
        AppSessionRepository.recordSession(appId, id, version, info?.deviceId, deviceInfo = info)
        TestDatabase.sql("UPDATE app_sessions SET first_seen='$at'::timestamptz WHERE session_id='$id'")
        AppSessionRepository.recordSession(appId, id, version, info?.deviceId, hasEvent = true, deviceInfo = info)
        return id
    }

    @Test fun `whole days partial edges and optional bounds agree with the same session population`() {
        session("2026-10-19T23:59:59Z")
        session("2026-10-20T00:00:00Z")
        session("2026-10-20T12:00:00Z")
        session("2026-10-21T00:00:00Z", version = 2, info = null)
        session("2026-10-21T12:00:00Z", version = 2)
        session("2026-10-20T12:00:00Z", appId = TestDatabase.other)
        val windows = listOf(
            "2026-10-19T23:00:00Z" to "2026-10-22T00:00:00Z",
            "2026-10-20T00:00:00Z" to "2026-10-21T00:00:00Z",
            "2026-10-20T11:00:00Z" to "2026-10-20T13:00:00Z",
            "2026-10-20T15:00:00+03:00" to "2026-10-21T15:00:00+03:00",
            "2026-10-21T00:00:00Z" to "2026-10-21T00:00:00Z",
            "2026-10-22T00:00:00Z" to "2026-10-19T00:00:00Z"
        ).map { at(it.first) to at(it.second) } + listOf(null to null, at("2026-10-20T12:00:00Z") to null, null to at("2026-10-21T00:00:00Z"))
        for ((from, to) in windows) for (version in listOf(null, 1L, 2L)) {
            val stats = DeviceStatsRepository.getStats(app, version, fromDate = from, toDate = to)
            val lower = from ?: at("2026-01-01T00:00:00Z")
            val upper = to ?: at("2027-01-01T00:00:00Z")
            val sessions = AppSessionRepository.getOverview(app, lower, upper).versions
                .filter { version == null || it.versionCode == version }.sumOf { it.count }
            for (dimension in listOf(stats.models, stats.osVersions, stats.countries, stats.languages)) {
                assertEquals(sessions, dimension.sumOf { it.count }, "$from..$to version=$version")
            }
        }
    }

    @Test fun `retention adjusts partial batches and counters can receive later sessions`() {
        repeat(3) { session("2026-10-20T12:00:00Z") }
        session("2026-10-21T12:00:00Z")
        assertEquals(4L, DeviceStatsRepository.getStats(app).models.sumOf { it.count })
        assertEquals(2L, DataRetentionRepository.deleteSessions(app, at("2026-10-21T00:00:00Z"), 2))
        assertEquals(2L, DeviceStatsRepository.getStats(app).models.sumOf { it.count })
        assertEquals(1L, DataRetentionRepository.deleteSessions(app, at("2026-10-21T00:00:00Z"), 2))
        assertEquals(1L, DeviceStatsRepository.getStats(app).models.sumOf { it.count })
        session("2026-10-20T13:00:00Z")
        assertEquals(2L, DeviceStatsRepository.getStats(app).models.sumOf { it.count })
    }

    @Test fun `version and app deletion remove only their session counters`() {
        val version = VersionRepository.findOrCreate(app, 1, "one")
        session("2026-10-20T12:00:00Z")
        session("2026-10-20T12:00:00Z", version = 2)
        session("2026-10-20T12:00:00Z", appId = TestDatabase.other)
        assertTrue(VersionRepository.delete(app, UUID.fromString(version.id)))
        assertEquals(1L, DeviceStatsRepository.getStats(app).models.sumOf { it.count })
        assertTrue(AppRepository.delete(app))
        assertEquals(emptyList(), DeviceStatsRepository.getStats(app).models)
        assertEquals(1L, DeviceStatsRepository.getStats(TestDatabase.other).models.sumOf { it.count })
    }
}
