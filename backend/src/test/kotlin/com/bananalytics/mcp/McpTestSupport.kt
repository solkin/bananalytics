package com.bananalytics.mcp

import com.bananalytics.repositories.AccessTokenRepository
import com.bananalytics.repositories.AppAccessRepository
import com.bananalytics.repositories.TokenAccess
import com.bananalytics.repositories.UserRepository
import com.bananalytics.support.TestDatabase.app
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.assertEquals
import kotlin.test.fail

private val nextId = AtomicInteger(1)

/** A token for a fresh person holding [role] in the test app. */
internal fun mcpToken(role: String, access: TokenAccess = TokenAccess.READ): String {
    val user = UUID.fromString(UserRepository.create("$role-${UUID.randomUUID()}@example.test", "unused", role).id)
    AppAccessRepository.grantAccess(app, user, role)
    return AccessTokenRepository.create(user, role, access.scopes, null).accessToken
}

internal suspend fun ApplicationTestBuilder.rpc(
    token: String?,
    method: String,
    params: JsonObject = JsonObject(emptyMap()),
    configure: HttpRequestBuilder.() -> Unit = {}
): HttpResponse = client.post("/mcp") {
    token?.let { header(HttpHeaders.Authorization, "Bearer $it") }
    // HTTP/1.1 clients always send it; the test client does not.
    header(HttpHeaders.Host, "localhost")
    header(HttpHeaders.Accept, "application/json, text/event-stream")
    header("MCP-Protocol-Version", "2025-11-25")
    contentType(ContentType.Application.Json)
    setBody(buildJsonObject {
        put("jsonrpc", "2.0")
        put("id", nextId.getAndIncrement())
        put("method", method)
        put("params", params)
    }.toString())
    configure()
}

internal suspend fun ApplicationTestBuilder.result(token: String, method: String, params: JsonObject = JsonObject(emptyMap())): JsonObject {
    val response = rpc(token, method, params)
    assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
    return body["result"]?.jsonObject ?: fail("No result: $body")
}

/** Calls a tool; returns its text and whether it reported an error. */
internal suspend fun ApplicationTestBuilder.call(token: String, tool: String, arguments: JsonObject = JsonObject(emptyMap())): Pair<String, Boolean> {
    val result = result(token, "tools/call", buildJsonObject {
        put("name", tool)
        put("arguments", arguments)
    })
    val text = result["content"]!!.jsonArray.single().jsonObject["text"]!!.jsonPrimitive.content
    return text to (result["isError"]?.jsonPrimitive?.boolean ?: false)
}

/** Calls a tool that must succeed and parses its JSON result. */
internal suspend fun ApplicationTestBuilder.callOk(token: String, tool: String, arguments: JsonObject = JsonObject(emptyMap())): JsonElement {
    val (text, error) = call(token, tool, arguments)
    if (error) fail("$tool failed: $text")
    return Json.parseToJsonElement(text)
}

internal suspend fun ApplicationTestBuilder.toolNames(token: String): List<String> =
    result(token, "tools/list")["tools"]!!.jsonArray.map { it.jsonObject["name"]!!.jsonPrimitive.content }

/** Tool arguments; numbers and booleans stay JSON numbers and booleans. */
internal fun args(vararg pairs: Pair<String, Any>) = buildJsonObject {
    pairs.forEach { (key, value) ->
        when (value) {
            is Number -> put(key, value)
            is Boolean -> put(key, value)
            else -> put(key, value.toString())
        }
    }
}

internal fun JsonElement.field(name: String): String = jsonObject[name]!!.jsonPrimitive.content
