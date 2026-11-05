package com.bananalytics.routes

import com.bananalytics.config.OAuthException
import com.bananalytics.config.configureRouting
import com.bananalytics.config.configureSerialization
import com.bananalytics.config.configureStatusPages
import com.bananalytics.models.ClientMetadataDocument
import com.bananalytics.repositories.AccessTokenRepository
import com.bananalytics.repositories.SessionRepository
import com.bananalytics.repositories.UserRepository
import com.bananalytics.services.OAuthService
import com.bananalytics.support.TestDatabase
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.*
import org.junit.BeforeClass
import java.net.URI
import java.util.UUID
import kotlin.test.*

class OAuthIntegrationTest {
    companion object {
        @BeforeClass @JvmStatic fun connect() = TestDatabase.connect()

        private const val ISSUER = "http://localhost"
        private const val RESOURCE = "$ISSUER/mcp"
        private const val REDIRECT = "http://127.0.0.1:33418/callback"
        private const val METADATA_CLIENT = "https://agent.example/oauth/client.json"
        private const val VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-verifier"
    }
    @BeforeTest fun reset() = TestDatabase.reset()

    private var metadata: (URI) -> ClientMetadataDocument = { throw OAuthException("invalid_client", "unreachable") }

    private fun ApplicationTestBuilder.server() {
        application {
            configureSerialization()
            configureStatusPages()
            configureRouting(OAuthService(ISSUER, RESOURCE) { metadata(it) })
        }
    }

    private fun json(response: String) = Json.parseToJsonElement(response).jsonObject
    private fun JsonObject.string(name: String) = this[name]!!.jsonPrimitive.content

    private suspend fun ApplicationTestBuilder.register(body: String = """{"client_name":"Test Agent","redirect_uris":["$REDIRECT"]}""") =
        client.post("/api/v1/oauth/register") {
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    private suspend fun ApplicationTestBuilder.registeredClient(): String = json(register().bodyAsText()).string("client_id")

    private fun request(clientId: String, vararg overrides: Pair<String, String?>): JsonObject = buildJsonObject {
        val values = mutableMapOf<String, String?>(
            "response_type" to "code",
            "client_id" to clientId,
            "redirect_uri" to REDIRECT,
            "scope" to "mcp:read mcp:write",
            "state" to "xyz",
            "code_challenge" to OAuthService.s256(VERIFIER),
            "code_challenge_method" to "S256",
            "resource" to RESOURCE
        )
        overrides.forEach { (key, value) -> values[key] = value }
        values.forEach { (key, value) -> if (value != null) put(key, value) }
    }

    private suspend fun ApplicationTestBuilder.check(session: UUID, request: JsonObject) =
        client.post("/api/v1/oauth/authorize/check") {
            cookie("session", session.toString())
            contentType(ContentType.Application.Json)
            setBody(request.toString())
        }

    private suspend fun ApplicationTestBuilder.decide(session: UUID, request: JsonObject, approve: Boolean = true, access: String = "read"): String {
        val response = client.post("/api/v1/oauth/authorize") {
            cookie("session", session.toString())
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("request", request)
                put("approve", approve)
                put("access", access)
            }.toString())
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json(response.bodyAsText()).string("redirect_to")
    }

    private fun query(url: String): Parameters = parseQueryString(url.substringAfter('?'))

    private suspend fun ApplicationTestBuilder.token(vararg form: Pair<String, String>) =
        client.submitForm("/api/v1/oauth/token", Parameters.build { form.forEach { (key, value) -> append(key, value) } })

    private suspend fun ApplicationTestBuilder.exchange(clientId: String, code: String, verifier: String = VERIFIER) =
        token("grant_type" to "authorization_code", "code" to code, "redirect_uri" to REDIRECT,
            "client_id" to clientId, "code_verifier" to verifier, "resource" to RESOURCE)

    private suspend fun ApplicationTestBuilder.mcpStatus(accessToken: String): HttpStatusCode =
        client.post("/mcp") {
            header(HttpHeaders.Host, "localhost")
            header(HttpHeaders.Authorization, "Bearer $accessToken")
            header(HttpHeaders.Accept, "application/json, text/event-stream")
            contentType(ContentType.Application.Json)
            setBody("""{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}""")
        }.status

    /** A signed-in person; OAuth needs no access to any app. */
    private fun person(): Pair<UUID, UUID> {
        val user = UUID.fromString(UserRepository.create("p-${UUID.randomUUID()}@example.test", "unused", null).id)
        return user to SessionRepository.create(user)
    }

    /** Authorizes [clientId] for [session] and returns the token response. */
    private suspend fun ApplicationTestBuilder.authorize(clientId: String, access: String = "read", session: UUID = person().second): JsonObject {
        val code = query(decide(session, request(clientId), access = access))["code"]!!
        val response = exchange(clientId, code)
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json(response.bodyAsText())
    }

    @Test fun `discovery documents point clients from the resource to the authorization server`() = testApplication {
        server()
        val resource = json(client.get("/.well-known/oauth-protected-resource/mcp").bodyAsText())
        assertEquals(RESOURCE, resource.string("resource"))
        assertEquals(listOf(ISSUER), resource["authorization_servers"]!!.jsonArray.map { it.jsonPrimitive.content })
        assertEquals(resource, json(client.get("/.well-known/oauth-protected-resource").bodyAsText()))

        val server = json(client.get("/.well-known/oauth-authorization-server").bodyAsText())
        assertEquals(ISSUER, server.string("issuer"))
        assertEquals("$ISSUER/oauth/authorize", server.string("authorization_endpoint"))
        assertEquals(listOf("S256"), server["code_challenge_methods_supported"]!!.jsonArray.map { it.jsonPrimitive.content })
        assertEquals(listOf("none"), server["token_endpoint_auth_methods_supported"]!!.jsonArray.map { it.jsonPrimitive.content })
        assertTrue(server["client_id_metadata_document_supported"]!!.jsonPrimitive.boolean)

        val challenge = client.post("/mcp") { header(HttpHeaders.Host, "localhost") }.headers[HttpHeaders.WWWAuthenticate]
        assertEquals("Bearer resource_metadata=\"$ISSUER/.well-known/oauth-protected-resource/mcp\", scope=\"mcp:read mcp:write mcp:manage\"", challenge)
    }

    @Test fun `a registered client completes the code flow and rotates its refresh token`() = testApplication {
        server()
        val clientId = registeredClient()
        val (user, session) = person()

        // Native apps pick their loopback port at runtime.
        val onAnotherPort = request(clientId, "redirect_uri" to "http://127.0.0.1:51234/callback")
        val prompt = json(check(session, onAnotherPort).bodyAsText())["prompt"]!!.jsonObject
        assertEquals("Test Agent", prompt.string("client_name"))
        assertFalse(prompt["verified"]!!.jsonPrimitive.boolean)
        assertEquals("write", prompt.string("requested_access"))
        assertEquals("127.0.0.1", prompt.string("redirect_host"))

        val redirect = decide(session, request(clientId))
        assertTrue(redirect.startsWith("$REDIRECT?"))
        val params = query(redirect)
        assertEquals("xyz", params["state"])
        assertEquals(ISSUER, params["iss"])

        val issued = exchange(clientId, params["code"]!!)
        assertEquals("no-store", issued.headers[HttpHeaders.CacheControl])
        val tokens = json(issued.bodyAsText())
        // Write access needs the person's explicit consent, not just the client's ask.
        assertEquals("mcp:read", tokens.string("scope"))
        assertEquals("Bearer", tokens.string("token_type"))
        assertEquals(3600, tokens["expires_in"]!!.jsonPrimitive.int)
        assertEquals(HttpStatusCode.OK, mcpStatus(tokens.string("access_token")))
        assertTrue(AccessTokenRepository.findByUserId(user).isEmpty(), "OAuth tokens are not personal tokens")

        val refreshed = json(token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"), "client_id" to clientId).bodyAsText())
        assertNotEquals(tokens.string("refresh_token"), refreshed.string("refresh_token"))
        assertEquals(HttpStatusCode.OK, mcpStatus(refreshed.string("access_token")))

        // A retry right after rotation is refused but does not end the connection.
        val retry = token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"), "client_id" to clientId)
        assertEquals("invalid_grant", json(retry.bodyAsText()).string("error"))
        assertEquals(HttpStatusCode.OK, mcpStatus(refreshed.string("access_token")))

        // Later, the old token surfacing again means it leaked: the grant goes.
        TestDatabase.sql("UPDATE oauth_grants SET last_used_at = NOW() - INTERVAL '5 minutes'")
        val reuse = token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"), "client_id" to clientId)
        assertEquals(HttpStatusCode.BadRequest, reuse.status)
        assertEquals(HttpStatusCode.Unauthorized, mcpStatus(refreshed.string("access_token")))
        assertEquals(0L, TestDatabase.count("oauth_grants"))
    }

    @Test fun `access is granted only as far as both the person and the client go`() = testApplication {
        server()
        val clientId = registeredClient()
        assertEquals("mcp:read mcp:write", authorize(clientId, access = "write").string("scope"))

        val (_, session) = person()
        suspend fun granted(scope: String, access: String): String {
            val request = request(clientId, "scope" to scope)
            return json(exchange(clientId, query(decide(session, request, access = access))["code"]!!).bodyAsText()).string("scope")
        }
        suspend fun requested(scope: String): String =
            json(check(session, request(clientId, "scope" to scope)).bodyAsText())["prompt"]!!.jsonObject.string("requested_access")

        assertEquals("read", requested("mcp:read"))
        assertEquals("mcp:read", granted("mcp:read", access = "manage"))
        // Each level implies those below it, so asking for manage alone is asking for everything.
        assertEquals("manage", requested("mcp:manage"))
        assertEquals("mcp:manage mcp:read mcp:write", granted("mcp:manage", access = "manage"))
        assertEquals("mcp:read mcp:write", granted("mcp:read mcp:write mcp:manage", access = "write"))
        assertEquals("mcp:read", granted("mcp:manage", access = "read"))

        // An unknown level is refused rather than read as some default.
        val codes = TestDatabase.count("oauth_codes")
        val refused = client.post("/api/v1/oauth/authorize") {
            cookie("session", session.toString())
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("request", request(clientId, "scope" to "mcp:manage"))
                put("approve", true)
                put("access", "admin")
            }.toString())
        }
        assertEquals(HttpStatusCode.BadRequest, refused.status)
        assertEquals(codes, TestDatabase.count("oauth_codes"))
    }

    @Test fun `codes are single use and bound to their verifier, client and redirect`() = testApplication {
        server()
        val clientId = registeredClient()
        val otherClient = registeredClient()
        val (_, session) = person()
        val code = query(decide(session, request(clientId)))["code"]!!

        for (attempt in listOf(
            exchange(clientId, code, verifier = "x".repeat(43)),
            exchange(otherClient, code),
            token("grant_type" to "authorization_code", "code" to code, "redirect_uri" to "http://127.0.0.1:1/other",
                "client_id" to clientId, "code_verifier" to VERIFIER),
        )) {
            assertEquals("invalid_grant", json(attempt.bodyAsText()).string("error"))
        }
        assertEquals("invalid_grant", json(exchange(clientId, code, verifier = "short").bodyAsText()).string("error"))

        val tokens = json(exchange(clientId, code).bodyAsText())
        assertEquals(HttpStatusCode.OK, mcpStatus(tokens.string("access_token")))

        val replay = json(exchange(clientId, code).bodyAsText())
        assertEquals("invalid_grant", replay.string("error"))
        assertEquals(HttpStatusCode.Unauthorized, mcpStatus(tokens.string("access_token")))
    }

    @Test fun `unusable requests are shown to the person or returned to a trusted redirect`() = testApplication {
        server()
        val clientId = registeredClient()
        val (_, session) = person()

        // Not redirected: the client or its redirect URI cannot be trusted.
        for ((request, error) in listOf(
            request("bnc_unknown") to "invalid_client",
            request(clientId, "redirect_uri" to "https://evil.example/callback") to "invalid_request",
            request(clientId, "client_id" to null) to "invalid_request",
        )) {
            val response = check(session, request)
            assertEquals(error, json(response.bodyAsText()).string("error"), request.toString())
            assertTrue(response.status.value in 400..401)
        }

        // Redirected back with the error and the state.
        for ((request, error) in listOf(
            request(clientId, "response_type" to "token") to "unsupported_response_type",
            request(clientId, "code_challenge" to null) to "invalid_request",
            request(clientId, "code_challenge_method" to "plain") to "invalid_request",
            request(clientId, "resource" to "https://elsewhere.example/mcp") to "invalid_target",
        )) {
            val redirect = json(check(session, request).bodyAsText()).string("redirect_to")
            val params = query(redirect)
            assertEquals(error, params["error"], request.toString())
            assertEquals("xyz", params["state"])
            assertTrue(redirect.startsWith(REDIRECT))
        }
        assertEquals("access_denied", query(decide(session, request(clientId), approve = false))["error"])
        assertEquals(0L, TestDatabase.count("oauth_codes"))
        assertEquals(HttpStatusCode.Unauthorized, check(UUID.randomUUID(), request(clientId)).status)
    }

    @Test fun `registration accepts only public clients with safe redirect URIs`() = testApplication {
        server()
        for (body in listOf(
            """{"redirect_uris":[]}""",
            """{"redirect_uris":["javascript:alert(1)"]}""",
            """{"redirect_uris":["http://example.com/callback"]}""",
            """{"redirect_uris":["https://example.com/cb#fragment"]}""",
            """{"redirect_uris":["$REDIRECT"],"token_endpoint_auth_method":"client_secret_basic"}""",
            """{"redirect_uris":["$REDIRECT"],"grant_types":["client_credentials"]}""",
            """{not json""",
        )) {
            assertEquals(HttpStatusCode.BadRequest, register(body).status, body)
        }
        val native = json(register("""{"redirect_uris":["cursor://anysphere.cursor-retrieval/oauth/callback","https://claude.ai/api/mcp/auth_callback"]}""").bodyAsText())
        assertEquals("MCP client", native.string("client_name"))
        assertTrue(native.string("client_id").startsWith("bnc_"))

        // Registrations nobody used are swept by later ones.
        TestDatabase.sql("UPDATE oauth_clients SET created_at = NOW() - INTERVAL '8 days'")
        registeredClient()
        assertEquals(1L, TestDatabase.count("oauth_clients"))
    }

    @Test fun `a client identified by its metadata document is verified by its own domain`() = testApplication {
        server()
        metadata = { url ->
            assertEquals(METADATA_CLIENT, url.toString())
            ClientMetadataDocument(clientId = METADATA_CLIENT, clientName = "Agent", redirectUris = listOf(REDIRECT))
        }
        val (_, session) = person()
        val prompt = json(check(session, request(METADATA_CLIENT)).bodyAsText())["prompt"]!!.jsonObject
        assertTrue(prompt["verified"]!!.jsonPrimitive.boolean)
        assertEquals("Agent", prompt.string("client_name"))

        val code = query(decide(session, request(METADATA_CLIENT)))["code"]!!
        assertEquals(HttpStatusCode.OK, exchange(METADATA_CLIENT, code).status)

        metadata = { ClientMetadataDocument(clientId = "https://agent.example/other.json", redirectUris = listOf(REDIRECT)) }
        assertEquals("invalid_client", json(check(session, request(METADATA_CLIENT)).bodyAsText()).string("error"))
        assertEquals("invalid_client", json(check(session, request("https://agent.example/")).bodyAsText()).string("error"))
    }

    @Test fun `people see their connections and disconnecting ends the tokens`() = testApplication {
        server()
        val clientId = registeredClient()
        val (_, session) = person()
        val tokens = authorize(clientId, session = session)

        // Activity between refreshes shows through the access tokens' own use.
        TestDatabase.sql("UPDATE oauth_grants SET last_used_at = NOW() - INTERVAL '30 days'")
        assertEquals(HttpStatusCode.OK, mcpStatus(tokens.string("access_token")))
        val grants = Json.parseToJsonElement(client.get("/api/v1/oauth/grants") { cookie("session", session.toString()) }.bodyAsText()).jsonArray
        val grant = grants.single().jsonObject
        assertEquals("Test Agent", grant.string("client_name"))
        assertTrue(java.time.OffsetDateTime.parse(grant.string("last_used_at")).isAfter(java.time.OffsetDateTime.now().minusMinutes(1)))

        val (_, stranger) = person()
        assertEquals(HttpStatusCode.NotFound, client.delete("/api/v1/oauth/grants/${grant.string("id")}") { cookie("session", stranger.toString()) }.status)
        assertEquals(HttpStatusCode.NoContent, client.delete("/api/v1/oauth/grants/${grant.string("id")}") { cookie("session", session.toString()) }.status)
        assertEquals(HttpStatusCode.Unauthorized, mcpStatus(tokens.string("access_token")))
        val refresh = token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"), "client_id" to clientId)
        assertEquals("invalid_grant", json(refresh.bodyAsText()).string("error"))
    }

    @Test fun `the token endpoint validates the client, grant type and resource`() = testApplication {
        server()
        val clientId = registeredClient()
        val tokens = authorize(clientId)

        val unknown = token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"), "client_id" to "bnc_nobody")
        assertEquals(HttpStatusCode.Unauthorized, unknown.status)
        assertEquals("invalid_client", json(unknown.bodyAsText()).string("error"))
        assertEquals(listOf("no-store"), unknown.headers.getAll(HttpHeaders.CacheControl))
        assertEquals("unsupported_grant_type", json(token("grant_type" to "password", "client_id" to clientId).bodyAsText()).string("error"))
        assertEquals("invalid_request", json(token("client_id" to clientId).bodyAsText()).string("error"))
        assertEquals("invalid_target", json(token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"),
            "client_id" to clientId, "resource" to "https://elsewhere.example/mcp").bodyAsText()).string("error"))
        assertEquals("invalid_grant", json(token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"),
            "client_id" to clientId, "scope" to "mcp:write").bodyAsText()).string("error"))
        // Case and a trailing slash do not make a different resource.
        val narrowed = token("grant_type" to "refresh_token", "refresh_token" to tokens.string("refresh_token"),
            "client_id" to clientId, "resource" to "HTTP://LOCALHOST/mcp/")
        assertEquals(HttpStatusCode.OK, narrowed.status, narrowed.bodyAsText())
    }

    @Test fun `revoking a refresh token ends the grant, only for its own client`() = testApplication {
        server()
        val clientId = registeredClient()
        val tokens = authorize(clientId)
        val other = registeredClient()

        client.submitForm("/api/v1/oauth/revoke", parametersOf("token" to listOf(tokens.string("refresh_token")), "client_id" to listOf(other)))
        assertEquals(HttpStatusCode.OK, mcpStatus(tokens.string("access_token")))

        val revoked = client.submitForm("/api/v1/oauth/revoke", parametersOf("token" to listOf(tokens.string("refresh_token")), "client_id" to listOf(clientId)))
        assertEquals(HttpStatusCode.OK, revoked.status)
        assertEquals(HttpStatusCode.Unauthorized, mcpStatus(tokens.string("access_token")))
    }
}
