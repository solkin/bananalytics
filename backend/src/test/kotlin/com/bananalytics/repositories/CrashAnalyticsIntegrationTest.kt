package com.bananalytics.repositories

import com.bananalytics.models.*
import com.bananalytics.support.TestDatabase
import com.bananalytics.support.TestDatabase.app
import org.junit.BeforeClass
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.*

class CrashAnalyticsIntegrationTest {
    companion object { @BeforeClass @JvmStatic fun connect() = TestDatabase.connect() }
    @BeforeTest fun reset() = TestDatabase.reset()
    private val from = OffsetDateTime.parse("2026-10-01T00:00:00Z")
    private val to = OffsetDateTime.parse("2026-11-01T00:00:00Z")

    private fun seed() {
        TestDatabase.sql("""
            INSERT INTO crash_groups (app_id,fingerprint,exception_class,first_seen,last_seen,status)
            SELECT '$app',n::text,'Issue-'||n,'2026-10-20','2026-10-20',CASE WHEN n%2=0 THEN 'open' ELSE 'resolved' END
            FROM generate_series(1,125) n;
            INSERT INTO crashes(app_id,group_id,version_code,device_id,stacktrace_raw,created_at,device_info)
            SELECT '$app',id,CASE WHEN n%2=0 THEN 1 ELSE 2 END,'device-'||n,'trace','2026-10-20 12:00+00',
                '{"device_id":"device","manufacturer":"Maker","model":"Phone","os_version":34,"country":"RU","language":"en"}'::jsonb
            FROM crash_groups CROSS JOIN generate_series(1,60) n;
        """.trimIndent())
    }

    @Test fun `all groups are reachable with stable server sorting and correct totals`() {
        seed()
        val pages = (1..9).map { CrashRepository.findGroupsByAppId(app, fromDate = from, sortBy = "last_seen", sortOrder = "asc", page = it, pageSize = 15) }
        assertTrue(pages.all { it.total == 125L })
        assertEquals(125, pages.flatMap { it.items }.size)
        assertEquals(125, pages.flatMap { it.items }.map { it.id }.toSet().size)
        val empty = CrashRepository.findGroupsByAppId(app, page = 99)
        assertEquals(125L, empty.total)
        assertEquals(emptyList(), empty.items)
        assertEquals(0L, CrashRepository.findGroupsByAppId(TestDatabase.other).total)
    }

    @Test fun `status version and time filters apply before aggregation and pagination`() {
        seed()
        val page = CrashRepository.findGroupsByAppId(app, "open", 1, from, pageSize = 100)
        assertEquals(62L, page.total)
        assertTrue(page.items.all { it.occurrences == 30 && it.affectedDevices == 30 && it.status == "open" })
        assertEquals(0L, CrashRepository.findGroupsByAppId(app, fromDate = to).total)
        assertEquals(listOf(DailyStat("2026-10-20", 3750)), CrashRepository.getCrashStatsByAppId(app, from, to, 1))
    }

    @Test fun `reports beyond fifty and distributions use the entire filtered group`() {
        seed()
        val group = UUID.fromString(CrashRepository.findGroupsByAppId(app).items.first().id)
        val last = CrashRepository.findCrashesByGroupId(group, page = 60, pageSize = 1)
        assertEquals(60L, last.total)
        assertEquals(1, last.items.size)
        val stats = CrashRepository.getDistributions(group, from, to, null)
        assertEquals(60L, stats.total)
        assertEquals(listOf(DeviceStatItem("Phone", 60)), stats.models)
        assertEquals(listOf(DailyStat("2026-10-20", 60)), CrashRepository.getCrashStatsByGroupId(group, from, to))
        assertEquals(30L, CrashRepository.getDistributions(group, from, to, 1).total)
    }
}
