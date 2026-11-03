package com.bananalytics.repositories

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Bearer secrets — API keys, access tokens, OAuth codes. Only their SHA-256 is
 * stored. A plain digest (not bcrypt) is deliberate: every secret carries 192
 * bits of randomness, so brute force is not the threat model, and the lookup
 * sits on the hot path of every authenticated request.
 */
internal object Secrets {
    private val secureRandom = SecureRandom()

    fun generate(prefix: String): String {
        val bytes = ByteArray(24)
        secureRandom.nextBytes(bytes)
        return prefix + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}

/**
 * Decides when a credential's `last_used_at` is worth writing again, so that
 * authenticating does not update the row on every single request.
 */
internal class UsageThrottle(private val intervalMs: Long = 5 * 60 * 1000L) {
    private val touchedAt = ConcurrentHashMap<UUID, Long>()

    fun shouldTouch(id: UUID): Boolean {
        val now = System.currentTimeMillis()
        val last = touchedAt[id]
        if (last != null && now - last < intervalMs) return false
        touchedAt[id] = now
        return true
    }

    fun forget(id: UUID) {
        touchedAt.remove(id)
    }
}
