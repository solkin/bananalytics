package com.bananalytics.config

import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json

/**
 * Installed at the routing root rather than on the application, so a route can
 * replace it with its own settings — the MCP endpoint needs the protocol's
 * JSON, which differs from the API's.
 */
fun Application.configureSerialization() {
    routing {
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = false
                isLenient = true
                ignoreUnknownKeys = true
                encodeDefaults = true
            })
        }
    }
}
