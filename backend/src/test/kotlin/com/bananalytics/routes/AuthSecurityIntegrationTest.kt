package com.bananalytics.routes

import com.bananalytics.repositories.*
import com.bananalytics.support.TestDatabase
import com.bananalytics.support.TestDatabase.app
import com.bananalytics.support.api
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.junit.BeforeClass
import java.util.UUID
import kotlin.test.*

class AuthSecurityIntegrationTest {
    companion object {
        @BeforeClass @JvmStatic fun connect() = TestDatabase.connect()
    }
    @BeforeTest fun reset() = TestDatabase.reset()

    private fun invite(email: String = "invited@example.test", days: Int = 30): InvitationInfo {
        val admin = UserRepository.create("owner@example.test", "unused", "Owner")
        return InvitationRepository.create(email, app, "admin", UUID.fromString(admin.id), expiresInDays = days)
    }

    private suspend fun ApplicationTestBuilder.register(email: String, token: String? = null) =
        client.post("/api/v1/auth/register") {
            contentType(ContentType.Application.Json)
            setBody("""{"email":"$email","password":"test-password"${token?.let { ",\"invite_token\":\"$it\"" } ?: ""}}""")
        }

    @Test fun `registration without token never redeems invitations`() = testApplication {
        api()
        invite()
        val response = register("invited@example.test")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertNull(UserRepository.findByEmail("invited@example.test"))
        assertEquals(1L, TestDatabase.count("invitations"))
    }

    @Test fun `expired and unknown invitations are rejected by lookup and registration`() = testApplication {
        api()
        val expired = invite(days = -1)
        for (token in listOf(expired.token, "invalid")) {
            assertEquals(HttpStatusCode.NotFound, client.get("/api/v1/auth/invite/$token").status)
            assertEquals(HttpStatusCode.BadRequest, register("invited@example.test", token).status)
        }
        assertNull(UserRepository.findByEmail("invited@example.test"))
    }

    @Test fun `only the validated invitation is consumed and granted`() = testApplication {
        api()
        val invitation = invite()
        InvitationRepository.create("invited@example.test", TestDatabase.other, "viewer", UUID.fromString(UserRepository.findByEmail("owner@example.test")!!.id))
        assertEquals(HttpStatusCode.BadRequest, register("wrong@example.test", invitation.token).status)
        assertEquals(HttpStatusCode.Created, register("INVITED@example.test", invitation.token).status)
        val user = UUID.fromString(UserRepository.findByEmail("invited@example.test")!!.id)
        assertEquals("admin", AppAccessRepository.getUserRole(app, user))
        assertNull(AppAccessRepository.getUserRole(TestDatabase.other, user))
        assertNull(InvitationRepository.findValidByToken(invitation.token))
        assertEquals(1L, TestDatabase.count("invitations"))
    }

    @Test fun `testers cannot access analytics drafts or team data even by direct URL`() = testApplication {
        api()
        val session = TestDatabase.session("tester")
        for (path in listOf("events", "events/summary", "events/versions", "devices/stats", "sessions/overview", "crashes", "versions", "access")) {
            val response = client.get("/api/v1/apps/$app/$path") { cookie("session", session.toString()) }
            assertEquals(HttpStatusCode.Forbidden, response.status, path)
        }
        assertEquals(HttpStatusCode.OK, client.get("/api/v1/apps/$app/distribution") { cookie("session", session.toString()) }.status)
    }
}
