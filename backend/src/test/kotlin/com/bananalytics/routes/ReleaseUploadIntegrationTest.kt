package com.bananalytics.routes

import com.bananalytics.config.AppConfig
import com.bananalytics.models.*
import com.bananalytics.repositories.*
import com.bananalytics.services.CrashService
import com.bananalytics.support.*
import com.bananalytics.support.TestDatabase.app
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.io.asSource
import kotlinx.io.buffered
import org.junit.AfterClass
import org.junit.BeforeClass
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import kotlin.test.*

class ReleaseUploadIntegrationTest {
    companion object {
        @BeforeClass @JvmStatic fun connect() { TestDatabase.connect(); TestStorage.start() }
        @AfterClass @JvmStatic fun stop() = TestStorage.stop()
    }
    @BeforeTest fun reset() { TestDatabase.reset(); TestStorage.objects.clear(); TestStorage.requests.clear() }
    private fun fileBody(file: File, part: String) = MultiPartFormDataContent(formData {
        append(part, InputProvider(file.length()) { file.inputStream().asSource().buffered() }, Headers.build {
            append(HttpHeaders.ContentDisposition, "filename=file.$part")
        })
    })

    @Test fun `browser uploads accept more than fifty MiB and enforce configured limit with 413`() = testApplication {
        api()
        val session = TestDatabase.session("admin")
        val version = VersionRepository.findOrCreate(app, 1, "one")
        val file = File.createTempFile("apk-upload-", ".apk")
        try {
            RandomAccessFile(file, "rw").use { it.setLength(51L * 1024 * 1024) }
            val accepted = client.put("/api/v1/apps/$app/versions/${version.id}/apk") {
                cookie("session", session.toString()); setBody(fileBody(file, "apk"))
            }
            assertEquals(HttpStatusCode.OK, accepted.status, accepted.bodyAsText())
            assertEquals(file.length(), VersionRepository.findById(app, UUID.fromString(version.id))!!.apkSize)
            RandomAccessFile(file, "rw").use { it.setLength(AppConfig.maxApkBytes + 1024 * 1024) }
            val rejected = client.put("/api/v1/apps/$app/versions/${version.id}/apk") {
                cookie("session", session.toString()); setBody(fileBody(file, "apk"))
            }
            assertEquals(HttpStatusCode.PayloadTooLarge, rejected.status, rejected.bodyAsText())
            assertEquals(51L * 1024 * 1024, VersionRepository.findById(app, UUID.fromString(version.id))!!.apkSize)
        } finally { file.delete() }
    }

    @Test fun `CI publish accepts an APK larger than fifty MiB`() = testApplication {
        api()
        val key = ApiKeyRepository.create(app, "CI", null, ApiKeyRepository.SCOPE_UPLOAD).apiKey
        val file = apkFixture(51 * 1024 * 1024)
        try {
            val response = client.post("/api/v1/releases") {
                header("X-API-Key", key); setBody(fileBody(file, "apk"))
            }
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            assertEquals(file.length(), VersionRepository.findByAppAndVersionCode(app, 7)!!.apkSize)
        } finally { file.delete() }
    }

    @Test fun `failed version creation does not retain an unreferenced mapping`() {
        VersionRepository.findOrCreate(app, 1, "one")
        val mapping = File.createTempFile("mapping-rollback-", ".gz")
        try {
            java.util.zip.GZIPOutputStream(mapping.outputStream()).use { it.write("review.Original -> a:\n".toByteArray()) }
            assertFails { VersionRepository.create(app, 1, "duplicate", mapping) }
            assertEquals(emptySet(), TestStorage.objects.keys)
            assertEquals(1, TestStorage.requests.count { it.startsWith("PUT mappings/") })
        } finally { mapping.delete() }
    }

    @Test fun `failed mapping replacement keeps the previous mapping without retaining the upload`() {
        val mapping = File.createTempFile("mapping-rollback-", ".gz")
        try {
            java.util.zip.GZIPOutputStream(mapping.outputStream()).use { it.write("review.Original -> a:\n".toByteArray()) }
            val version = VersionRepository.create(app, 1, "one", mapping)
            val previousPath = VersionRepository.getMappingPath(app, 1)!!
            TestDatabase.sql("ALTER TABLE app_versions ADD CONSTRAINT reject_mapping_replacement CHECK (mapping_path = '$previousPath')")
            try {
                assertFails { VersionRepository.updateMapping(app, UUID.fromString(version.id), mapping) }
                assertEquals(previousPath, VersionRepository.getMappingPath(app, 1))
                assertEquals(setOf(previousPath), TestStorage.objects.keys)
            } finally {
                TestDatabase.sql("ALTER TABLE app_versions DROP CONSTRAINT reject_mapping_replacement")
            }
        } finally { mapping.delete() }
    }

    @Test fun `prepared mappings are reused and replacing a mapping changes cache identity`() = testApplication {
        api()
        val version = VersionRepository.findOrCreate(app, 1, "one")
        val versionId = UUID.fromString(version.id)
        val session = TestDatabase.session("admin")
        suspend fun upload(original: String): String {
            val file = File.createTempFile("mapping-", ".txt")
            try {
                file.writeText("$original -> a:\n    void crash() -> b\n")
                val response = client.put("/api/v1/apps/$app/versions/$versionId/mapping") {
                    cookie("session", session.toString()); setBody(fileBody(file, "mapping"))
                }
                assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
                return VersionRepository.getMappingPath(app, 1)!!
            } finally { file.delete() }
        }
        val environment = EnvironmentData("test.app", 1, "one", "device", 34, "Maker", "Phone", "RU", "en")
        fun submit() {
            CrashService.processCrashes(app, environment, listOf(CrashData(
                System.currentTimeMillis(), "main", "a: failure\n\tat a.b(SourceFile:1)", reportId = UUID.randomUUID().toString())))
        }
        val first = upload("review.Original")
        submit(); submit()
        assertEquals(1, TestStorage.requests.count { it == "GET $first" })
        assertTrue(CrashRepository.findCrashesByGroupId(UUID.fromString(CrashRepository.findGroupsByAppId(app).items.single().id))
            .items.all { it.stacktraceDecoded!!.contains("review.Original") })
        val second = upload("review.Replacement")
        assertNotEquals(first, second)
        submit()
        val group = UUID.fromString(CrashRepository.findGroupsByAppId(app).items.single().id)
        assertTrue(CrashRepository.findCrashesByGroupId(group).items.first().stacktraceDecoded!!.contains("review.Replacement"))
        assertEquals(1, TestStorage.requests.count { it == "GET $second" })
    }
}
