package com.bananalytics.services

import java.net.URI

/**
 * Which redirect URIs an OAuth client may use (OAuth 2.1 and RFC 8252): HTTPS,
 * HTTP on the loopback interface for native apps, or a private-use scheme such
 * as `cursor://`. Never a scheme that runs code or reads local files.
 */
object RedirectUris {
    const val MAX_COUNT = 10
    private const val MAX_LENGTH = 2000
    private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "[::1]")
    private val FORBIDDEN_SCHEMES = setOf("javascript", "data", "file", "vbscript", "about", "blob", "ftp", "ws", "wss")
    private val SCHEME = Regex("^[a-z][a-z0-9+.-]*$")

    fun isAllowed(value: String): Boolean {
        if (value.length > MAX_LENGTH) return false
        val uri = parse(value) ?: return false
        val scheme = uri.scheme?.lowercase() ?: return false
        if (uri.rawFragment != null || !SCHEME.matches(scheme) || scheme in FORBIDDEN_SCHEMES) return false
        return when (scheme) {
            "https" -> !uri.host.isNullOrEmpty() && uri.rawUserInfo == null
            "http" -> isLoopback(uri) && uri.rawUserInfo == null
            else -> true
        }
    }

    /**
     * Exact comparison, except that a loopback redirect may use any port: a
     * native app learns its free port only when it starts listening.
     */
    fun matches(registered: String, requested: String): Boolean {
        if (registered == requested) return true
        val a = parse(registered) ?: return false
        val b = parse(requested) ?: return false
        return a.scheme == "http" && b.scheme == "http" && isLoopback(a) &&
            a.host.equals(b.host, ignoreCase = true) &&
            a.rawPath == b.rawPath && a.rawQuery == b.rawQuery && b.rawFragment == null
    }

    fun host(value: String): String = parse(value)?.let { it.host ?: it.scheme } ?: value

    private fun isLoopback(uri: URI): Boolean = uri.host?.lowercase() in LOOPBACK_HOSTS

    private fun parse(value: String): URI? = try {
        URI(value).takeIf { it.isAbsolute }
    } catch (e: java.net.URISyntaxException) {
        null
    }
}
