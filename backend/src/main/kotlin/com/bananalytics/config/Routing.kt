package com.bananalytics.config

import com.bananalytics.routes.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader("X-API-Key")
        allowCredentials = true
        
        // For development
        allowHost("localhost:3177")
        allowHost("localhost:3000")
        allowHost("127.0.0.1:3177")
        allowHost("127.0.0.1:3000")
    }

    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        route("/api/v1") {
            // Public routes
            authRoutes()
            
            // SDK routes (authenticated by API key)
            sdkRoutes()
            
            // Admin routes (authenticated by session)
            authenticated {
                appRoutes()
                crashRoutes()
                eventRoutes()
            }
        }
    }
}
