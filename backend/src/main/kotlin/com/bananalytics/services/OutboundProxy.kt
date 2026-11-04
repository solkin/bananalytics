package com.bananalytics.services

import java.net.URI
import java.net.URLDecoder

/**
 * An HTTP CONNECT proxy for requests the backend makes to the outside world,
 * for hosts whose network cannot reach every client's metadata (some block
 * claude.ai). TLS still runs end to end through the tunnel.
 */
data class OutboundProxy(
    val host: String,
    val port: Int,
    val username: String?,
    val password: String?
) {
    companion object {
        /** Reads `http://[user:password@]host:port`; anything else is a configuration error. */
        fun parse(value: String): OutboundProxy {
            val uri = try {
                URI(value.trim())
            } catch (e: java.net.URISyntaxException) {
                throw IllegalArgumentException("OUTBOUND_PROXY_URL is not a URL")
            }
            require(uri.scheme == "http" && !uri.host.isNullOrEmpty() && uri.port > 0) {
                "OUTBOUND_PROXY_URL must look like http://user:password@host:port"
            }
            val credentials = uri.rawUserInfo?.split(':', limit = 2)?.map { URLDecoder.decode(it, Charsets.UTF_8) }
            return OutboundProxy(uri.host, uri.port, credentials?.getOrNull(0), credentials?.getOrNull(1))
        }
    }

    /** The address alone: credentials never belong in a log line. */
    override fun toString() = "$host:$port"
}
