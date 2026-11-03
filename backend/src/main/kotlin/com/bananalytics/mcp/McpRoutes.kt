package com.bananalytics.mcp

import com.bananalytics.config.AppConfig
import com.bananalytics.config.BearerAuthentication
import com.bananalytics.config.getTokenPrincipal
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.modelcontextprotocol.kotlin.sdk.server.DnsRebindingProtection
import io.modelcontextprotocol.kotlin.sdk.server.StreamableHttpServerTransport
import io.modelcontextprotocol.kotlin.sdk.types.McpJson
import org.slf4j.LoggerFactory
import java.net.URI

private val logger = LoggerFactory.getLogger("McpRoutes")

/**
 * The MCP endpoint, served as stateless Streamable HTTP: every POST carries one
 * exchange, answered as JSON, so no session state lives between requests and
 * any backend instance can serve any request.
 *
 * The SDK's own Ktor helper installs its JSON settings application-wide, which
 * would change every other API response; here they apply to this route only.
 */
fun Route.mcpRoutes() {
    val resource = AppConfig.mcpResourceUrl
    if (resource == null) {
        logger.warn("MCP endpoint disabled: BASE_URL must be an https:// address (or http://localhost)")
        return
    }
    val publicHost = URI(resource).host

    route("/mcp") {
        // Browsers send Origin; a page elsewhere must not reach the endpoint even
        // through DNS rebinding. Agents send no Origin and pass.
        install(DnsRebindingProtection) {
            allowedHosts = listOf(publicHost)
            allowedOrigins = listOf(AppConfig.baseUrl)
        }
        install(BearerAuthentication)
        install(ContentNegotiation) { json(McpJson) }

        post {
            val server = bananalyticsMcpServer(call.getTokenPrincipal())
            val transport = StreamableHttpServerTransport(
                StreamableHttpServerTransport.Configuration(enableJsonResponse = true)
            ).also { it.setSessionIdGenerator(null) }
            val session = server.createSession(transport)
            try {
                transport.handleRequest(null, call)
            } finally {
                // One request, one session: close it so nothing accumulates.
                session.close()
            }
        }
        // No server-initiated stream and no sessions to terminate.
        get { call.respond(HttpStatusCode.MethodNotAllowed) }
        delete { call.respond(HttpStatusCode.MethodNotAllowed) }
    }
}
