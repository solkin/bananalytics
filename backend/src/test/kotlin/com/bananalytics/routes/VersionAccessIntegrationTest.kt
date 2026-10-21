package com.bananalytics.routes

import com.bananalytics.config.configureRouting
import com.bananalytics.config.configureSerialization
import com.bananalytics.config.configureStatusPages
import com.bananalytics.models.AppVersionResponse
import com.bananalytics.repositories.*
import com.bananalytics.services.EmailService
import com.bananalytics.services.StorageService
import com.sun.net.httpserver.HttpServer
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import org.junit.AfterClass
import org.junit.Assume.assumeNotNull
import org.junit.BeforeClass
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.InetSocketAddress
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.test.*

class VersionAccessIntegrationTest {
    companion object {
        private val app = UUID.fromString("00000000-0000-0000-0000-000000000001")
        private val other = UUID.fromString("00000000-0000-0000-0000-000000000002")
        private val objects = ConcurrentHashMap<String, ByteArray>()
        private val storageRequests = ConcurrentLinkedQueue<String>()
        private var storage: HttpServer? = null
        private fun sql(value: String) = transaction { exec(value); Unit }

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

        @BeforeClass @JvmStatic fun connect() {
            val url = System.getenv("TEST_DATABASE_URL")
            assumeNotNull(url)
            require(url!!.endsWith("/bananalytics_test")) { "Use a disposable bananalytics_test database" }
            Database.connect(url, "org.postgresql.Driver", "bananalytics", System.getenv("TEST_DATABASE_PASSWORD") ?: "perf-local")
            sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
            sql(File("src/main/resources/db/init.sql").readText())
            File("src/main/resources/db/migrations").listFiles()!!.filter { it.extension == "sql" }
                .sortedBy { it.name }.forEach { sql(it.readText()) }

            // Exercise real storage calls against a local S3 stub, including streaming downloads.
            val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            server.createContext("/") { exchange ->
                val key = exchange.requestURI.path.removePrefix("/version-tests/")
                val received = exchange.requestBody.use { it.readBytes() }
                val body = if (exchange.requestHeaders.getFirst("Content-Encoding")?.contains("aws-chunked") == true)
                    decodeChunks(received) else received
                storageRequests.add("${exchange.requestMethod} $key")
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
                if (exchange.requestMethod == "HEAD") {
                    exchange.sendResponseHeaders(200, -1)
                } else {
                    exchange.sendResponseHeaders(if (response == null) 404 else 200, response?.size?.toLong() ?: -1)
                    response?.let { exchange.responseBody.write(it) }
                }
                exchange.close()
            }
            server.start()
            storage = server
            StorageService.init("http://127.0.0.1:${server.address.port}", "test", "test", "version-tests")
        }

        @AfterClass @JvmStatic fun stopStorage() { storage?.stop(0) }
    }

    private lateinit var ownVersion: AppVersionResponse
    private lateinit var otherVersion: AppVersionResponse
    private lateinit var adminSession: UUID
    private lateinit var viewerSession: UUID
    private lateinit var testerSession: UUID

    @BeforeTest fun reset() {
        sql("TRUNCATE apps, users RESTART IDENTITY CASCADE")
        sql("INSERT INTO apps (id,name,package_name) VALUES ('$app','Own','test.own'), ('$other','Other','test.other')")
        ownVersion = VersionRepository.findOrCreate(app, 1, "own")
        otherVersion = VersionRepository.findOrCreate(other, 1, "other")
        for (id in listOf(ownVersion.id, otherVersion.id)) {
            sql("UPDATE app_versions SET apk_path = 'apks/$id.apk', apk_size = 3, apk_filename = 'build.apk', mapping_path = 'mappings/$id.txt' WHERE id = '$id'")
        }
        fun session(role: String): UUID {
            val userId = UUID.fromString(UserRepository.create("$role@example.test", "unused", role).id)
            AppAccessRepository.grantAccess(app, userId, role)
            return SessionRepository.create(userId)
        }
        adminSession = session("admin")
        viewerSession = session("viewer")
        testerSession = session("tester")
        objects.clear()
        objects["apks/${ownVersion.id}.apk"] = byteArrayOf(1, 2, 3)
        objects["apks/${otherVersion.id}.apk"] = byteArrayOf(4, 5, 6)
        objects["mappings/${ownVersion.id}.txt"] = "own mapping".toByteArray()
        objects["mappings/${otherVersion.id}.txt"] = "other mapping".toByteArray()
        storageRequests.clear()
    }

    private fun ApplicationTestBuilder.api() {
        application {
            configureSerialization()
            configureStatusPages()
            configureRouting()
        }
    }

    private suspend fun ApplicationTestBuilder.versionRequest(
        method: HttpMethod, appId: UUID, versionId: String, suffix: String = "", session: UUID? = adminSession
    ): HttpResponse = client.request("/api/v1/apps/$appId/versions/$versionId$suffix") {
        this.method = method
        session?.let { cookie("session", it.toString()) }
        if (method == HttpMethod.Put && suffix in listOf("/apk", "/mapping")) {
            val part = suffix.removePrefix("/")
            setBody(MultiPartFormDataContent(formData {
                append(part, "uploaded $part".toByteArray(), Headers.build {
                    append(HttpHeaders.ContentDisposition, "filename=\"file.$part\"")
                })
            }))
        } else if (method == HttpMethod.Put || method == HttpMethod.Post) {
            contentType(ContentType.Application.Json)
            setBody(when (suffix) {
                "/notify-testers" -> """{"emails":[]}"""
                "/mute" -> """{"mute_crashes":false,"mute_events":false}"""
                else -> """{"release_notes":"updated","published_for_testers":true,"mute_crashes":true,"mute_events":true}"""
            })
        }
    }

    private val operations = listOf(
        HttpMethod.Put to "", HttpMethod.Put to "/mute", HttpMethod.Delete to "",
        HttpMethod.Put to "/mapping", HttpMethod.Get to "/mapping",
        HttpMethod.Put to "/apk", HttpMethod.Get to "/apk", HttpMethod.Delete to "/apk",
        HttpMethod.Post to "/download-link", HttpMethod.Post to "/notify-testers"
    )

    @Test fun `foreign and missing version IDs return 404 without database or storage effects`() = testApplication {
        api()
        val before = VersionRepository.findById(other, UUID.fromString(otherVersion.id))
        for (id in listOf(otherVersion.id, UUID.randomUUID().toString())) {
            for ((method, suffix) in operations) {
                val response = versionRequest(method, app, id, suffix)
                assertEquals(HttpStatusCode.NotFound, response.status, "$method $suffix ($id): ${response.bodyAsText()}")
            }
        }
        assertEquals(before, VersionRepository.findById(other, UUID.fromString(otherVersion.id)))
        assertTrue(storageRequests.isEmpty(), storageRequests.toString())
        assertEquals(0L, transaction { exec("SELECT COUNT(*) FROM download_tokens") { it.next(); it.getLong(1) } })
    }

    @Test fun `viewers and testers cannot read another app version through their own app`() = testApplication {
        api()
        for (session in listOf(viewerSession, testerSession)) {
            for (suffix in listOf("/apk", "/mapping")) {
                assertEquals(HttpStatusCode.NotFound, versionRequest(HttpMethod.Get, app, otherVersion.id, suffix, session).status)
                assertEquals(HttpStatusCode.OK, versionRequest(HttpMethod.Get, app, ownVersion.id, suffix, session).status)
            }
        }
    }

    @Test fun `authentication and app roles still protect owned versions`() = testApplication {
        api()
        for ((method, suffix) in operations) {
            assertEquals(HttpStatusCode.Unauthorized, versionRequest(method, app, ownVersion.id, suffix, null).status)
            assertEquals(if (method == HttpMethod.Get) HttpStatusCode.NotFound else HttpStatusCode.Forbidden,
                versionRequest(method, other, otherVersion.id, suffix).status)
            if (method != HttpMethod.Get) {
                for (session in listOf(viewerSession, testerSession)) {
                    assertEquals(HttpStatusCode.Forbidden, versionRequest(method, app, ownVersion.id, suffix, session).status)
                }
            }
        }
        assertTrue(storageRequests.isEmpty(), storageRequests.toString())
    }

    @Test fun `owned version update and legacy mute work without changing another app`() = testApplication {
        api()
        val before = VersionRepository.findById(other, UUID.fromString(otherVersion.id))
        assertEquals(HttpStatusCode.OK, versionRequest(HttpMethod.Put, app, ownVersion.id).status)
        val updated = VersionRepository.findById(app, UUID.fromString(ownVersion.id))!!
        assertEquals("updated", updated.releaseNotes)
        assertTrue(updated.publishedForTesters && updated.muteCrashes && updated.muteEvents)
        assertEquals(HttpStatusCode.OK, versionRequest(HttpMethod.Put, app, ownVersion.id, "/mute").status)
        val unmuted = VersionRepository.findById(app, UUID.fromString(ownVersion.id))!!
        assertFalse(unmuted.muteCrashes || unmuted.muteEvents)
        assertEquals(before, VersionRepository.findById(other, UUID.fromString(otherVersion.id)))
    }

    @Test fun `owned APK and mapping upload and download still work`() = testApplication {
        api()
        for (part in listOf("apk", "mapping")) {
            assertEquals(HttpStatusCode.OK, versionRequest(HttpMethod.Put, app, ownVersion.id, "/$part").status)
            val response = versionRequest(HttpMethod.Get, app, ownVersion.id, "/$part")
            assertEquals(HttpStatusCode.OK, response.status)
            assertEquals("uploaded $part", response.bodyAsText())
        }
        assertEquals("other mapping", objects["mappings/${otherVersion.id}.txt"]!!.toString(Charsets.UTF_8))
        assertContentEquals(byteArrayOf(4, 5, 6), objects["apks/${otherVersion.id}.apk"])
    }

    @Test fun `owned APK and version deletion leave the other app intact`() = testApplication {
        api()
        assertEquals(HttpStatusCode.NoContent, versionRequest(HttpMethod.Delete, app, ownVersion.id, "/apk").status)
        assertFalse(VersionRepository.findById(app, UUID.fromString(ownVersion.id))!!.hasApk)
        assertEquals(HttpStatusCode.NotFound, versionRequest(HttpMethod.Get, app, ownVersion.id, "/apk").status)
        assertEquals(HttpStatusCode.BadRequest, versionRequest(HttpMethod.Post, app, ownVersion.id, "/download-link").status)
        assertEquals(HttpStatusCode.NoContent, versionRequest(HttpMethod.Delete, app, ownVersion.id).status)
        assertNull(VersionRepository.findById(app, UUID.fromString(ownVersion.id)))
        assertNotNull(VersionRepository.findById(other, UUID.fromString(otherVersion.id)))
        assertContentEquals(byteArrayOf(4, 5, 6), objects["apks/${otherVersion.id}.apk"])
    }

    @Test fun `public links honor app ownership including mismatched legacy tokens`() = testApplication {
        api()
        val response = versionRequest(HttpMethod.Post, app, ownVersion.id, "/download-link")
        assertEquals(HttpStatusCode.Created, response.status)
        val url = Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("download_url").jsonPrimitive.content
        assertEquals(HttpStatusCode.OK, client.get(url).status)
        assertContentEquals(byteArrayOf(1, 2, 3), client.get(url).readRawBytes())
        val forged = DownloadTokenRepository.create(app, UUID.fromString(otherVersion.id))
        val expired = DownloadTokenRepository.create(app, UUID.fromString(ownVersion.id), -1)
        storageRequests.clear()
        for (token in listOf(forged.token, expired.token, "invalid")) {
            assertEquals(HttpStatusCode.NotFound, client.get("/api/v1/download/$token").status)
        }
        assertTrue(storageRequests.isEmpty(), storageRequests.toString())
    }

    @Test fun `owned notification retains SMTP and empty recipient behavior without sending mail`() = testApplication {
        api()
        assertEquals(if (EmailService.isConfigured) HttpStatusCode.OK else HttpStatusCode.BadRequest,
            versionRequest(HttpMethod.Post, app, ownVersion.id, "/notify-testers").status)
    }

    @Test fun `crash group version names come only from the app that owns the group`() = testApplication {
        api()
        val groupId = UUID.randomUUID()
        sql("INSERT INTO crash_groups (id,app_id,fingerprint,first_seen,last_seen) VALUES ('$groupId','$app','test',now(),now())")
        sql("INSERT INTO crashes (app_id,group_id,version_id,version_code,stacktrace_raw) VALUES ('$app','$groupId','${ownVersion.id}',1,'test')")
        val response = client.get("/api/v1/crash-groups/$groupId/versions") { cookie("session", adminSession.toString()) }
        assertEquals(HttpStatusCode.OK, response.status)
        val version = Json.parseToJsonElement(response.bodyAsText()).jsonArray.single().jsonObject
        assertEquals("own", version.getValue("version_name").jsonPrimitive.content)
        assertEquals(emptyList(), CrashRepository.getVersionCodesByGroup(other, groupId))
    }
}
