package com.bananalytics.support

import com.bananalytics.services.StorageService
import com.sun.net.httpserver.HttpServer
import java.io.ByteArrayOutputStream
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

object TestStorage {
    val objects = ConcurrentHashMap<String, ByteArray>()
    val requests = ConcurrentLinkedQueue<String>()
    private var server: HttpServer? = null

    fun start() {
        val local = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        local.createContext("/") { exchange ->
            val key = exchange.requestURI.path.removePrefix("/version-tests/")
            val received = exchange.requestBody.use { it.readBytes() }
            val body = if (exchange.requestHeaders.getFirst("Content-Encoding")?.contains("aws-chunked") == true)
                decodeChunks(received) else received
            requests.add("${exchange.requestMethod} $key")
            val response = when (exchange.requestMethod) {
                "PUT" -> { objects[key] = body; ByteArray(0) }
                "GET" -> objects[key]
                "POST" -> {
                    Regex("<Key>(.*?)</Key>").findAll(body.toString(Charsets.UTF_8))
                        .forEach { objects.remove(it.groupValues[1]) }
                    "<DeleteResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"/>".toByteArray()
                }
                else -> ByteArray(0)
            }
            if (exchange.requestMethod == "HEAD") exchange.sendResponseHeaders(200, -1)
            else {
                exchange.sendResponseHeaders(if (response == null) 404 else 200, response?.size?.toLong() ?: -1)
                response?.let { exchange.responseBody.write(it) }
            }
            exchange.close()
        }
        local.start()
        server = local
        StorageService.init("http://127.0.0.1:${local.address.port}", "test", "test", "version-tests")
    }

    fun stop() { server?.stop(0); server = null; objects.clear(); requests.clear() }

    private fun decodeChunks(body: ByteArray): ByteArray {
        val input = body.inputStream()
        val output = ByteArrayOutputStream()
        while (true) {
            val header = buildString {
                while (true) {
                    val byte = input.read()
                    check(byte >= 0) { "Incomplete S3 chunk header" }
                    if (byte == '\n'.code) break
                    if (byte != '\r'.code) append(byte.toChar())
                }
            }
            val size = header.substringBefore(';').toInt(16)
            if (size == 0) return output.toByteArray()
            output.write(input.readNBytes(size))
            check(input.read() == '\r'.code && input.read() == '\n'.code)
        }
    }
}
