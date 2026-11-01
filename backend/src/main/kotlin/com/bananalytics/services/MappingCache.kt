package com.bananalytics.services

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.FutureTask
import java.util.concurrent.Semaphore

private const val MAX_PARALLEL_LOADS = 2

/** Shares concurrent loads, bounds retained source size, and never performs IO under the cache lock. */
internal class MappingCache<T>(
    private val maxWeight: Long,
    private val maxEntries: Int,
    private val weightOf: (T) -> Long
) {
    private val entries = LinkedHashMap<String, T>(16, 0.75f, true)
    private val loading = ConcurrentHashMap<String, FutureTask<T>>()
    private val loadSlots = Semaphore(MAX_PARALLEL_LOADS)
    private var weight = 0L

    fun get(key: String, load: () -> T): T {
        synchronized(entries) { entries[key]?.let { return it } }
        val task = loading.computeIfAbsent(key) {
            FutureTask {
                loadSlots.acquire()
                try {
                    synchronized(entries) { entries[key] } ?: load().also { value ->
                        val itemWeight = weightOf(value)
                        if (itemWeight <= maxWeight) synchronized(entries) {
                            while (entries.isNotEmpty() && (weight + itemWeight > maxWeight || entries.size >= maxEntries)) {
                                val oldest = entries.entries.iterator()
                                weight -= weightOf(oldest.next().value)
                                oldest.remove()
                            }
                            entries[key] = value
                            weight += itemWeight
                        }
                    }
                } finally {
                    loadSlots.release()
                }
            }
        }
        task.run()
        return try {
            task.get()
        } catch (e: ExecutionException) {
            throw e.cause ?: e
        } finally {
            if (task.isDone) loading.remove(key, task)
        }
    }
}
