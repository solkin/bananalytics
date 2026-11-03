package com.bananalytics.routes

import com.bananalytics.config.BearerAuthentication
import com.bananalytics.config.getTokenPrincipal
import com.bananalytics.repositories.*
import com.bananalytics.support.TestDatabase
import com.bananalytics.support.api
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.*
import org.junit.BeforeClass
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.*

class AccessTokenIntegrationTest {
    companion object {
        @BeforeClass @JvmStatic fun connect() = TestDatabase.connect()
    }
    @BeforeTest fun reset() = TestDatabase.reset()

    private fun user(email: String) = UUID.fromString(UserRepository.create(email, "unused", null).id)

    private fun ApplicationTestBuilder.probe() {
        api()
        routing {
            route("/probe") {
                install(BearerAuthentication) { challenge = { mapOf("realm" to "test") } }
                get { call.respondText(call.getTokenPrincipal().user.email) }
            }
        }
    }

    private suspend fun ApplicationTestBuilder.createToken(session: UUID, body: String) =
        client.post("/api/v1/tokens") {
            cookie("session", session.toString())
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    @Test fun `a created token is returned once and listed only by prefix`() = testApplication {
        api()
        val session = TestDatabase.session("viewer")
        val response = createToken(session, """{"name":" Cursor ","access":"write","expires_in_days":30}""")
        assertEquals(HttpStatusCode.Created, response.status)
        val created = Json.parseToJsonElement(response.bodyAsText()).jsonObject
        val raw = created["access_token"]!!.jsonPrimitive.content
        assertTrue(raw.startsWith("bnp_"))
        val token = created["token"]!!.jsonObject
        assertEquals("Cursor", token["name"]!!.jsonPrimitive.content)
        assertEquals("mcp:read mcp:write", token["scope"]!!.jsonPrimitive.content)
        assertNotNull(token["expires_at"]!!.jsonPrimitive.contentOrNull)

        val listed = client.get("/api/v1/tokens") { cookie("session", session.toString()) }.bodyAsText()
        assertFalse(listed.contains(raw))
        assertTrue(listed.contains(raw.take(12)))
    }

    @Test fun `token creation validates its input`() = testApplication {
        api()
        val session = TestDatabase.session("viewer")
        for (body in listOf(
            """{"name":"  "}""",
            """{"name":"${"x".repeat(101)}"}""",
            """{"name":"a","access":"admin"}""",
            """{"name":"a","expires_in_days":0}""",
            """{"name":"a","expires_in_days":366}""",
            """{"name":""",
        )) {
            assertEquals(HttpStatusCode.BadRequest, createToken(session, body).status, body)
        }
        assertEquals(HttpStatusCode.Created, createToken(session, """{"name":"forever","expires_in_days":null}""").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/v1/tokens").status)
    }

    @Test fun `people cannot see or touch each other's tokens`() = testApplication {
        api()
        val owner = user("owner@example.test")
        val token = AccessTokenRepository.create(owner, "mine", AccessTokenRepository.scopesFor(false), null).token
        val stranger = TestDatabase.session("viewer")
        val listed = client.get("/api/v1/tokens") { cookie("session", stranger.toString()) }.bodyAsText()
        assertEquals("[]", listed)
        assertEquals(HttpStatusCode.NotFound, client.post("/api/v1/tokens/${token.id}/revoke") { cookie("session", stranger.toString()) }.status)
        assertEquals(HttpStatusCode.NotFound, client.delete("/api/v1/tokens/${token.id}") { cookie("session", stranger.toString()) }.status)
        assertEquals(1, AccessTokenRepository.findByUserId(owner).size)
    }

    @Test fun `only live tokens authenticate`() {
        val owner = user("owner@example.test")
        val read = AccessTokenRepository.scopesFor(false)
        val live = AccessTokenRepository.create(owner, "live", read, OffsetDateTime.now().plusDays(1))
        val expired = AccessTokenRepository.create(owner, "expired", read, OffsetDateTime.now().minusSeconds(1))
        val revoked = AccessTokenRepository.create(owner, "revoked", read, null)
        assertTrue(AccessTokenRepository.revoke(owner, UUID.fromString(revoked.token.id)))
        assertFalse(AccessTokenRepository.revoke(owner, UUID.fromString(revoked.token.id)))

        val principal = AccessTokenRepository.authenticate(live.accessToken)
        assertEquals("owner@example.test", principal?.user?.email)
        assertEquals(false, principal?.canWrite)
        assertNotNull(AccessTokenRepository.findByUserId(owner).single { it.name == "live" }.lastUsedAt)
        assertNull(AccessTokenRepository.authenticate(expired.accessToken))
        assertNull(AccessTokenRepository.authenticate(revoked.accessToken))
        assertNull(AccessTokenRepository.authenticate(live.accessToken + "x"))

        TestDatabase.sql("DELETE FROM users WHERE id = '$owner'")
        assertNull(AccessTokenRepository.authenticate(live.accessToken))
        assertEquals(0L, TestDatabase.count("access_tokens"))
    }

    @Test fun `bearer authentication challenges every request without a live token`() = testApplication {
        probe()
        val owner = user("owner@example.test")
        val raw = AccessTokenRepository.create(owner, "t", AccessTokenRepository.scopesFor(false), null).accessToken

        val missing = client.get("/probe")
        assertEquals(HttpStatusCode.Unauthorized, missing.status)
        assertEquals("Bearer realm=\"test\"", missing.headers[HttpHeaders.WWWAuthenticate])

        val session = TestDatabase.session("admin")
        for (header in listOf("Basic $raw", "Bearer ", "Bearer bnp_unknown", raw)) {
            val response = client.get("/probe") {
                header(HttpHeaders.Authorization, header)
                cookie("session", session.toString())
            }
            assertEquals(HttpStatusCode.Unauthorized, response.status, header)
        }
        val invalid = client.get("/probe") { header(HttpHeaders.Authorization, "Bearer bnp_unknown") }
        assertEquals("Bearer realm=\"test\", error=\"invalid_token\"", invalid.headers[HttpHeaders.WWWAuthenticate])

        for (scheme in listOf("Bearer", "bearer")) {
            val ok = client.get("/probe") { header(HttpHeaders.Authorization, "$scheme $raw") }
            assertEquals(HttpStatusCode.OK, ok.status)
            assertEquals("owner@example.test", ok.bodyAsText())
        }
    }
}
