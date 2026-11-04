package com.bananalytics.services

import com.bananalytics.config.OAuthException
import kotlinx.coroutines.runBlocking
import java.net.ServerSocket
import java.net.URI
import java.util.Base64
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import kotlin.test.*

class ClientMetadataSourceTest {
    @Test fun `proxy URLs carry an address and optional credentials`() {
        assertEquals(OutboundProxy("93.92.0.1", 8888, "user", "p@ss:word"), OutboundProxy.parse("http://user:p%40ss:word@93.92.0.1:8888"))
        assertEquals(OutboundProxy("proxy.example", 3128, null, null), OutboundProxy.parse(" http://proxy.example:3128 "))
        for (value in listOf("socks5://h:1080", "http://host", "proxy:8888", "http://:8888", "http://a b:1")) {
            assertFailsWith<IllegalArgumentException>(value) { OutboundProxy.parse(value) }
        }
        assertFalse(OutboundProxy.parse("http://user:secret@h:1").toString().contains("secret"))
    }

    /**
     * A proxy that demands Basic credentials, records the tunnel the client
     * asks for, then refuses it: enough to see the request leave through it.
     */
    @Test fun `metadata is fetched through the proxy with its credentials`() {
        val server = ServerSocket(0)
        val tunnels = CopyOnWriteArrayList<Pair<String, String?>>()
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = runCatching { server.accept() }.getOrNull() ?: break
                socket.use {
                    val reader = it.getInputStream().bufferedReader()
                    val request = reader.readLine() ?: return@use
                    val headers = generateSequence { reader.readLine()?.takeIf(String::isNotEmpty) }.toList()
                    val auth = headers.firstOrNull { h -> h.startsWith("Proxy-Authorization:", ignoreCase = true) }
                        ?.substringAfter("Basic ")?.trim()?.let { b -> String(Base64.getDecoder().decode(b)) }
                    tunnels += request to auth
                    val answer = if (auth == null) {
                        "HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"test\"\r\nContent-Length: 0\r\n\r\n"
                    } else {
                        "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n"
                    }
                    it.getOutputStream().write(answer.toByteArray())
                    it.getOutputStream().flush()
                }
            }
        }
        try {
            val source = HttpClientMetadataSource(OutboundProxy("127.0.0.1", server.localPort, "agent", "s3cret"))
            assertFailsWith<OAuthException> { runBlocking { source.fetch(URI("https://example.com/client.json")) } }
            assertTrue(tunnels.all { it.first.startsWith("CONNECT example.com:443 ") }, tunnels.toString())
            assertEquals("agent:s3cret", tunnels.last().second, tunnels.toString())
        } finally {
            server.close()
        }
    }
}
