package com.bananalytics.services

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.*

class MappingCacheTest {
    @Test fun `cache evicts by weight and access order`() {
        val cache = MappingCache<String>(6, 2) { it.length.toLong() }
        var loads = 0
        fun get(key: String) = cache.get(key) { loads++; key.repeat(3) }
        assertEquals("aaa", get("a"))
        get("b"); get("a"); get("c")
        assertEquals(3, loads)
        get("a")
        assertEquals(3, loads)
        get("b")
        assertEquals(4, loads)
    }

    @Test fun `concurrent callers share one mapping load`() {
        val cache = MappingCache<String>(100, 8) { it.length.toLong() }
        val loads = AtomicInteger()
        val started = CountDownLatch(1)
        val release = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(8)
        try {
            val tasks = (1..8).map { pool.submit<String> { cache.get("mapping") {
                loads.incrementAndGet(); started.countDown()
                check(release.await(5, TimeUnit.SECONDS))
                "prepared"
            } } }
            assertTrue(started.await(5, TimeUnit.SECONDS))
            release.countDown()
            tasks.forEach { assertEquals("prepared", it.get(5, TimeUnit.SECONDS)) }
            assertEquals(1, loads.get())
        } finally { release.countDown(); pool.shutdownNow() }
    }

    @Test fun `failed loads can be retried and oversized entries are not retained`() {
        val cache = MappingCache<String>(3, 2) { it.length.toLong() }
        assertFailsWith<IllegalStateException> { cache.get("bad") { error("storage failed") } }
        assertEquals("ok", cache.get("bad") { "ok" })
        var loads = 0
        repeat(2) { cache.get("large") { loads++; "oversized" } }
        assertEquals(2, loads)
    }
}
