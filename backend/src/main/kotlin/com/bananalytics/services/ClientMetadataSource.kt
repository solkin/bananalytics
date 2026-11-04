package com.bananalytics.services

import com.bananalytics.config.OAuthException
import com.bananalytics.models.ClientMetadataDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.IOException
import java.net.Authenticator
import java.net.Inet6Address
import java.net.InetSocketAddress
import java.net.PasswordAuthentication
import java.net.ProxySelector
import java.net.InetAddress
import java.net.URI
import java.net.UnknownHostException
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

/** Where the metadata of a client identified by a URL comes from. */
fun interface ClientMetadataSource {
    /** The document published at [clientId]; fails with an OAuth error when there is none usable. */
    suspend fun fetch(clientId: URI): ClientMetadataDocument
}

/**
 * Fetches OAuth Client ID Metadata Documents. The URL comes from an anonymous
 * request, so the fetch must not become a way into our own network: public
 * HTTPS only, no redirects, a short timeout and a small body. With a [proxy]
 * the request leaves through it; the target is still checked here first.
 */
class HttpClientMetadataSource(proxy: OutboundProxy? = null) : ClientMetadataSource {
    private val client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(TIMEOUT)
        .apply { if (proxy != null) useProxy(proxy) }
        .build()
    private val json = Json { ignoreUnknownKeys = true }
    private val cache = ConcurrentHashMap<URI, Pair<Long, ClientMetadataDocument>>()

    override suspend fun fetch(clientId: URI): ClientMetadataDocument {
        val now = System.currentTimeMillis()
        cache[clientId]?.let { (fetchedAt, document) -> if (now - fetchedAt < CACHE_TTL_MS) return document }

        val document = withContext(Dispatchers.IO) { download(clientId) }
        if (cache.size >= MAX_CACHED) cache.clear()
        cache[clientId] = now to document
        return document
    }

    private fun download(clientId: URI): ClientMetadataDocument {
        val host = clientId.host ?: throw invalid("client_id has no host")
        val addresses = try {
            InetAddress.getAllByName(host).toList()
        } catch (e: UnknownHostException) {
            throw invalid("client_id host does not resolve")
        }
        if (addresses.any(::isInternal)) throw invalid("client_id must point to a public host")

        val request = HttpRequest.newBuilder(clientId)
            .timeout(TIMEOUT)
            .header("Accept", "application/json")
            .GET()
            .build()
        val response = try {
            client.send(request, HttpResponse.BodyHandlers.ofInputStream())
        } catch (e: IOException) {
            throw invalid("client metadata could not be fetched")
        }
        val body = response.body().use { stream ->
            if (response.statusCode() != 200) throw invalid("client metadata answered ${response.statusCode()}")
            val bytes = stream.readNBytes(MAX_BYTES + 1)
            if (bytes.size > MAX_BYTES) throw invalid("client metadata is larger than $MAX_BYTES bytes")
            bytes.toString(Charsets.UTF_8)
        }
        return try {
            json.decodeFromString<ClientMetadataDocument>(body)
        } catch (e: SerializationException) {
            throw invalid("client metadata is not a valid document")
        } catch (e: IllegalArgumentException) {
            throw invalid("client metadata is not a valid document")
        }
    }

    private fun HttpClient.Builder.useProxy(proxy: OutboundProxy) {
        proxy(ProxySelector.of(InetSocketAddress.createUnresolved(proxy.host, proxy.port)))
        if (proxy.username == null) return
        // Basic credentials for an HTTPS tunnel also need ALLOW_PROXY_TUNNEL_BASIC_AUTH (Application.kt).
        val credentials = PasswordAuthentication(proxy.username, proxy.password.orEmpty().toCharArray())
        authenticator(object : Authenticator() {
            override fun getPasswordAuthentication(): PasswordAuthentication? =
                credentials.takeIf { requestorType == RequestorType.PROXY }
        })
    }

    private fun invalid(description: String) = OAuthException("invalid_client", description)

    companion object {
        private val TIMEOUT: Duration = Duration.ofSeconds(5)
        private const val MAX_BYTES = 5 * 1024
        private const val CACHE_TTL_MS = 10 * 60 * 1000L
        private const val MAX_CACHED = 1000

        /** Loopback, private, link-local, carrier-grade NAT and unique-local addresses. */
        fun isInternal(address: InetAddress): Boolean {
            if (address.isLoopbackAddress || address.isAnyLocalAddress || address.isLinkLocalAddress ||
                address.isSiteLocalAddress || address.isMulticastAddress
            ) return true
            val bytes = address.address
            return when (address) {
                is Inet6Address -> (bytes[0].toInt() and 0xFE) == 0xFC
                else -> bytes[0].toInt() and 0xFF == 100 && (bytes[1].toInt() and 0xC0) == 64
            }
        }
    }
}
