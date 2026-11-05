package com.bananalytics.mcp

import com.bananalytics.config.AppConfig
import com.bananalytics.repositories.*
import com.bananalytics.support.TestDatabase
import com.bananalytics.support.TestDatabase.app
import com.bananalytics.support.TestStorage
import com.bananalytics.support.api
import com.bananalytics.support.apkFixture
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.*
import org.junit.AfterClass
import org.junit.BeforeClass
import java.util.UUID
import kotlin.test.*

/** What an agent may set up, ship and manage, level by level. */
class McpManagementIntegrationTest {
    companion object {
        @BeforeClass @JvmStatic fun connect() { TestDatabase.connect(); TestStorage.start() }
        @AfterClass @JvmStatic fun stop() = TestStorage.stop()
    }
    @BeforeTest fun reset() { TestDatabase.reset(); TestStorage.objects.clear() }

    private val setupTools = listOf(
        "create_app", "rename_app", "create_api_key", "create_version", "update_version",
        "create_download_link", "request_upload"
    )
    private val manageTools = listOf(
        "invite_member", "update_member_role", "remove_member", "notify_testers",
        "revoke_api_key", "delete_version", "delete_crash_group"
    )

    /** What request_upload hands out: where to send the file and the header that authorizes it. */
    private data class Upload(val path: String, val authorization: String)

    private suspend fun ApplicationTestBuilder.upload(target: Upload, body: ByteArray): HttpResponse =
        client.put(target.path) {
            header(HttpHeaders.Authorization, target.authorization)
            setBody(body)
        }

    private suspend fun ApplicationTestBuilder.uploadLink(token: String, versionCode: Int, kind: String): Upload {
        val upload = callOk(token, "request_upload", args("app_id" to app, "version_code" to versionCode, "kind" to kind)).jsonObject
        assertEquals("PUT", upload.getValue("method").jsonPrimitive.content)
        val authorization = upload.getValue("headers").jsonObject.getValue("Authorization").jsonPrimitive.content
        // The token travels in the header only, never in the URL that access logs record.
        assertFalse(upload.getValue("url").jsonPrimitive.content.contains("bnu_"))
        assertTrue(upload.getValue("example").jsonPrimitive.content.contains(authorization))
        return Upload(upload.getValue("url").jsonPrimitive.content.removePrefix(AppConfig.baseUrl), authorization)
    }

    @Test fun `each access level offers its own tools`() = testApplication {
        api()
        val read = toolNames(mcpToken("admin"))
        assertTrue(read.containsAll(listOf("list_members", "list_api_keys")))
        assertTrue(read.none { it in setupTools || it in manageTools })

        val write = toolNames(mcpToken("admin", TokenAccess.WRITE))
        assertTrue(write.containsAll(setupTools))
        assertTrue(write.none { it in manageTools })

        val manage = mcpToken("admin", TokenAccess.MANAGE)
        assertTrue(toolNames(manage).containsAll(setupTools + manageTools))

        // Upload keys belong to CI secrets, so only a manage token may create one.
        val writer = mcpToken("admin", TokenAccess.WRITE)
        assertEquals("scope must be one of: sdk" to true, call(writer, "create_api_key", args("app_id" to app, "name" to "CI", "scope" to "upload")))
        val key = callOk(manage, "create_api_key", args("app_id" to app, "name" to "CI", "scope" to "upload"))
        assertEquals("upload", key.field("scope"))
        assertTrue(key.field("api_key").startsWith("bnn_"))
        val listed = callOk(manage, "list_api_keys", args("app_id" to app)).toString()
        assertTrue(listed.contains("\"CI\"") && !listed.contains(key.field("api_key")))
    }

    @Test fun `an agent creates an app and becomes its admin`() = testApplication {
        api()
        val token = mcpToken("viewer", TokenAccess.WRITE)
        val created = callOk(token, "create_app", args("name" to "Notes", "package_name" to "com.example.notes"))
        assertTrue(created.field("sdk_api_key").startsWith("bnn_"))
        val appId = created.field("id")
        assertNotNull(ApiKeyRepository.authenticate(created.field("sdk_api_key")))

        val apps = callOk(token, "list_apps").jsonArray
        assertEquals("admin", apps.single { it.field("id") == appId }.field("role"))
        assertEquals("Package name already exists" to true, call(token, "create_app", args("name" to "Again", "package_name" to "com.example.notes")))
        assertEquals("Notes 2", callOk(token, "rename_app", args("app_id" to appId, "name" to "Notes 2")).field("name"))
        // The viewer role in the test app still caps what the token does there.
        assertEquals("Admin access required" to true, call(token, "rename_app", args("app_id" to app, "name" to "Mine")))
    }

    @Test fun `a release is prepared and its files arrive through one-time links`() = testApplication {
        api()
        val token = mcpToken("admin", TokenAccess.WRITE)
        callOk(token, "create_version", args("app_id" to app, "version_code" to 7, "version_name" to "1.0"))
        assertEquals("Version 7 already exists" to true, call(token, "create_version", args("app_id" to app, "version_code" to 7)))
        assertEquals("Version 8 not found" to true, call(token, "request_upload", args("app_id" to app, "version_code" to 8, "kind" to "apk")))

        val mappingLink = uploadLink(token, 7, "mapping")
        val uploaded = upload(mappingLink, "com.example.Real -> a.b:\n".toByteArray())
        assertEquals(HttpStatusCode.OK, uploaded.status, uploaded.bodyAsText())
        assertEquals(HttpStatusCode.Unauthorized, upload(mappingLink, "again".toByteArray()).status)
        assertTrue(VersionRepository.findByAppAndVersionCode(app, 7)!!.hasMapping)

        assertEquals("No APK uploaded for this version" to true, call(token, "create_download_link", args("app_id" to app, "version_code" to 7)))
        assertEquals(HttpStatusCode.BadRequest, upload(uploadLink(token, 7, "apk"), "not a zip".toByteArray()).status)
        val apk = apkFixture(0)
        try {
            assertEquals(HttpStatusCode.OK, upload(uploadLink(token, 7, "apk"), apk.readBytes()).status)
        } finally { apk.delete() }
        assertTrue(VersionRepository.findByAppAndVersionCode(app, 7)!!.hasApk)

        callOk(token, "create_version", args("app_id" to app, "version_code" to 8))
        val fixture = apkFixture(0)
        try {
            val mismatch = upload(uploadLink(token, 8, "apk"), fixture.readBytes())
            assertEquals(HttpStatusCode.BadRequest, mismatch.status)
            assertTrue(mismatch.bodyAsText().contains("Version code mismatch"))
        } finally { fixture.delete() }

        val notes = callOk(token, "update_version", args("app_id" to app, "version_code" to 7, "release_notes" to "Fixes", "published_for_testers" to true))
        assertEquals("Fixes", notes.field("release_notes"))
        assertEquals("true", notes.field("published_for_testers"))
        val link = callOk(token, "create_download_link", args("app_id" to app, "version_code" to 7, "expires_in_hours" to 2))
        assertTrue(link.field("download_url").startsWith("${AppConfig.baseUrl}/api/v1/download/"))
    }

    @Test fun `an upload token works once, briefly, and only for an admin`() = testApplication {
        api()
        val token = mcpToken("admin", TokenAccess.WRITE)
        callOk(token, "create_version", args("app_id" to app, "version_code" to 7))

        val expired = uploadLink(token, 7, "mapping")
        TestDatabase.sql("UPDATE upload_tokens SET expires_at = NOW() - INTERVAL '1 second'")
        assertEquals(HttpStatusCode.Unauthorized, upload(expired, "x".toByteArray()).status)

        val demoted = uploadLink(token, 7, "mapping")
        TestDatabase.sql("UPDATE app_access SET role = 'viewer'")
        assertEquals(HttpStatusCode.Forbidden, upload(demoted, "x".toByteArray()).status)
        assertFalse(VersionRepository.findByAppAndVersionCode(app, 7)!!.hasMapping)
        assertEquals(HttpStatusCode.Unauthorized, upload(Upload("/api/v1/uploads", "Bearer bnu_unknown"), "x".toByteArray()).status)
        assertEquals(HttpStatusCode.Unauthorized, client.put("/api/v1/uploads") { setBody("x") }.status)
    }

    @Test fun `members are managed without ever losing the last admin`() = testApplication {
        api()
        val admin = mcpToken("admin", TokenAccess.MANAGE)
        UserRepository.create("known@example.test", "unused", null)

        val known = callOk(admin, "invite_member", args("app_id" to app, "email" to "known@example.test", "role" to "viewer"))
        assertEquals("active", known.field("status"))
        val invited = callOk(admin, "invite_member", args("app_id" to app, "email" to "New@Example.test", "role" to "tester"))
        assertEquals("invited", invited.field("status"))
        assertEquals("new@example.test", invited.field("email"))
        assertEquals("Enter a valid email address" to true, call(admin, "invite_member", args("app_id" to app, "email" to "nobody", "role" to "viewer")))
        assertEquals("User already has access" to true, call(admin, "invite_member", args("app_id" to app, "email" to "known@example.test", "role" to "admin")))

        val members = callOk(admin, "list_members", args("app_id" to app)).jsonArray
        assertEquals(setOf("active", "invited"), members.map { it.field("status") }.toSet())
        callOk(admin, "update_member_role", args("app_id" to app, "member_id" to invited.field("member_id"), "role" to "viewer"))
        callOk(admin, "remove_member", args("app_id" to app, "member_id" to invited.field("member_id")))
        callOk(admin, "remove_member", args("app_id" to app, "member_id" to known.field("member_id")))

        val self = callOk(admin, "list_members", args("app_id" to app)).jsonArray.single()
        assertEquals("Cannot remove the last admin" to true, call(admin, "remove_member", args("app_id" to app, "member_id" to self.field("id"))))
        assertEquals("Cannot remove the last admin" to true, call(admin, "update_member_role", args("app_id" to app, "member_id" to self.field("id"), "role" to "viewer")))
    }

    @Test fun `destructive tools need the admin role and remove what they say`() = testApplication {
        api()
        val viewer = mcpToken("viewer", TokenAccess.MANAGE)
        val admin = mcpToken("admin", TokenAccess.MANAGE)
        callOk(admin, "create_version", args("app_id" to app, "version_code" to 7))
        val group = UUID.randomUUID()
        TestDatabase.sql("""
            INSERT INTO crash_groups (id,app_id,fingerprint,exception_class,first_seen,last_seen,status)
            VALUES ('$group','$app','fp','java.lang.Error',NOW(),NOW(),'open')
        """.trimIndent())
        val key = callOk(admin, "create_api_key", args("app_id" to app, "name" to "Old build"))

        assertEquals("Admin access required" to true, call(viewer, "delete_version", args("app_id" to app, "version_code" to 7)))
        assertEquals("Admin access required" to true, call(viewer, "delete_crash_group", args("group_id" to group)))

        callOk(admin, "revoke_api_key", args("app_id" to app, "key_id" to key.field("id")))
        assertNull(ApiKeyRepository.authenticate(key.field("api_key")))
        assertEquals("Active API key not found" to true, call(admin, "revoke_api_key", args("app_id" to app, "key_id" to key.field("id"))))

        callOk(admin, "delete_crash_group", args("group_id" to group))
        assertEquals(0L, TestDatabase.count("crash_groups"))
        callOk(admin, "delete_version", args("app_id" to app, "version_code" to 7))
        assertNull(VersionRepository.findByAppAndVersionCode(app, 7))

        // Without SMTP nothing can be sent, and the agent is told so.
        assertEquals("Email is not configured on this server" to true, call(admin, "notify_testers", args("app_id" to app, "version_code" to 7)))
    }
}
